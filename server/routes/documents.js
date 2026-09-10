/**
 * server/routes/documents.js
 * "Connect" → Documents: a per-org document library, plus AI search over it.
 *
 * What this actually does (see the setup notes this shipped with for the
 * exact env vars and one-time steps — none of this works until they're in
 * place, and every route below fails with an honest error instead of fake
 * success when a piece isn't configured):
 *
 *  - Google connection: a per-org OAuth2 connection (Drive + Forms scopes,
 *    offline access) stored as org.social_accounts.google_docs.refresh_token
 *    — same secret-on-the-org-record pattern as the Facebook/Instagram/
 *    WhatsApp connections in organizations.js, and redacted the same way
 *    before any org object reaches a client (see redactSocialAccounts).
 *  - Create a new Google Form, or link an existing Drive file/Google Doc/
 *    Sheet/Form by its share link, or upload a local .xlsx/.docx directly.
 *  - Every linked/uploaded document's text is extracted and, when
 *    VOYAGE_API_KEY is set, embedded with Voyage AI for real semantic
 *    search — NOT fabricated. Without a Voyage key, documents still save
 *    and list, they just aren't searchable, and /search says so rather
 *    than pretending to search.
 *  - /search embeds the question, ranks stored documents by cosine
 *    similarity (a plain in-memory scan — fine at the size a single org's
 *    document library actually reaches, not built for millions of rows),
 *    pulls a compact REAL snapshot of this org's own events and sign-up
 *    sheets, and asks Claude (same anthropic client pattern as routes/
 *    chat.js) to answer using only that material — the prompt explicitly
 *    forbids inventing numbers or facts not present in what's handed to it.
 *
 * Auth: identical pattern to routes/signups.js's admin routes —
 * authenticateToken gives req.user.{org_id,role}; requireRole('owner',
 * 'admin') additionally gates anything that spends an external API call or
 * changes org-wide state (connecting Google, creating/uploading/deleting
 * documents). Any signed-in org member (Owner/Admin/Viewer) can list
 * documents and use search, same as RSVP viewing.
 */

const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Anthropic = require('@anthropic-ai/sdk');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { rateLimit } = require('express-rate-limit');

const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getOrganization, updateOrganization } = require('../organizations');
const { getEventsByOrg } = require('../events');
const { listSheetsForOrg } = require('../signups');
const { sendServerError } = require('../utils/errors');
const { JWT_SECRET } = require('../utils/jwtSecret');

const router = express.Router();

const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE || 'calendarfly_documents';
// Stored text is capped well under DynamoDB's 400KB item limit — a
// deliberate, honest simplification for v1 (whole-document embeddings, no
// chunking, no overflow-to-S3 for huge files). Good enough for the kind of
// documents a community org actually links; a very long document just gets
// searched/summarized on its first ~60k characters.
const MAX_TEXT_CHARS = 60000;

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || null;
const VOYAGE_MODEL = 'voyage-3-lite';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || null;
const GOOGLE_DOCS_REDIRECT_URI = process.env.GOOGLE_DOCS_REDIRECT_URI || null;

let dynamo = null;
function getDynamo() {
  if (!dynamo) {
    dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
    }));
  }
  return dynamo;
}

// Lazy-initialized — same reasoning as the xlsx/mammoth getters just below
// (and routes/chat.js's getAnthropic()): the Anthropic SDK throws
// synchronously if ANTHROPIC_API_KEY is missing, and this file is required
// at server boot (server.js mounts /api/documents), so an unguarded
// `new Anthropic(...)` here would take the ENTIRE app down, not just
// Documents — exactly the failure mode the comment below already describes
// for xlsx/mammoth, just not yet applied to this client.
let anthropic = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

// xlsx/mammoth are lazy-required (looked up the first time they're actually
// needed, not when this file is loaded) so a server that hasn't run
// `npm install` yet since this feature was added still starts up and serves
// every other route normally. Requiring them at the top of the file would
// throw the moment server.js loads this route — taking the ENTIRE app down,
// not just Documents — the first time someone touches an .xlsx/.docx path
// before that one-time setup step has run.
let XLSX = null;
function getXLSX() {
  if (XLSX) return XLSX;
  try {
    XLSX = require('xlsx');
    return XLSX;
  } catch {
    throw new Error("The server is missing its 'xlsx' package — run `npm install` in the server folder, then restart the server.");
  }
}
let mammothLib = null;
function getMammoth() {
  if (mammothLib) return mammothLib;
  try {
    mammothLib = require('mammoth');
    return mammothLib;
  } catch {
    throw new Error("The server is missing its 'mammoth' package — run `npm install` in the server folder, then restart the server.");
  }
}

// ── Google OAuth (Drive + Forms, offline access) ────────────────────────────
// Deliberately separate from the GOOGLE_CLIENT_ID "Sign in with Google" flow
// in routes/auth.js — that one only verifies identity (no client secret, no
// Drive/Forms scopes). This is a full authorization-code exchange, so it
// needs its own GOOGLE_CLIENT_SECRET and a redirect URI registered on the
// same OAuth client in Google Cloud Console.
function getOAuthClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_DOCS_REDIRECT_URI) return null;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DOCS_REDIRECT_URI);
}

async function saveGoogleDocsConnection(org_id, refreshToken) {
  const org = await getOrganization(org_id);
  const social_accounts = { ...((org && org.social_accounts) || {}) };
  social_accounts.google_docs = {
    refresh_token: refreshToken,
    connected_via: 'oauth',
    connected_at: Date.now(),
  };
  await updateOrganization(org_id, { social_accounts });
}

async function clearGoogleDocsConnection(org_id) {
  const org = await getOrganization(org_id);
  const social_accounts = { ...((org && org.social_accounts) || {}) };
  delete social_accounts.google_docs;
  await updateOrganization(org_id, { social_accounts });
}

async function getAccessTokenForOrg(org) {
  const refreshToken = org && org.social_accounts && org.social_accounts.google_docs && org.social_accounts.google_docs.refresh_token;
  const oauth2Client = getOAuthClient();
  if (!refreshToken || !oauth2Client) return null;
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { token } = await oauth2Client.getAccessToken();
  return token || null;
}

// Creates a brand-new, blank Google Form (just a title — no questions added
// automatically) and hands back both the edit link (for the admin to build
// the form) and the public responder link (to share once it's ready).
async function createGoogleForm(accessToken, title) {
  const res = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ info: { title } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Failed to create the Google Form');
  return {
    formId: data.formId,
    editUrl: `https://docs.google.com/forms/d/${data.formId}/edit`,
    responderUri: data.responderUri || null,
  };
}

// A Google Sheet/Doc/Slides file has no downloadable binary — it has to be
// exported as a plain format. Anything else (an actual .xlsx/.docx sitting
// in Drive) gets downloaded as bytes and parsed the same way an uploaded
// file would be.
const GOOGLE_NATIVE_EXPORTS = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

async function fetchDriveFileText(accessToken, fileId) {
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  if (!metaRes.ok) {
    throw new Error((meta.error && meta.error.message) || "Couldn't read that Drive file — check the link, and that it's accessible to the Google account you connected.");
  }

  let text;
  if (GOOGLE_NATIVE_EXPORTS[meta.mimeType]) {
    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(GOOGLE_NATIVE_EXPORTS[meta.mimeType])}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    text = await exportRes.text();
  } else {
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    text = await extractTextFromBuffer(buffer, meta.mimeType, meta.name);
  }
  return { name: meta.name, mimeType: meta.mimeType, text };
}

// Accepts a bare Drive file ID or any of Drive's usual share-link shapes.
function parseDriveFileId(input) {
  const trimmed = (input || '').trim();
  const patterns = [/\/d\/([a-zA-Z0-9_-]{15,})/, /[?&]id=([a-zA-Z0-9_-]{15,})/];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;
  return null;
}

function extractTextFromBufferSync(buffer, mimeType, filename) {
  const isXlsx = (mimeType && mimeType.includes('spreadsheet')) || /\.xlsx?$/i.test(filename || '');
  if (isXlsx) {
    const xlsx = getXLSX();
    const wb = xlsx.read(buffer, { type: 'buffer' });
    return wb.SheetNames.map((name) => `# ${name}\n${xlsx.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n');
  }
  return null; // signals "not an xlsx — try the async docx path, or fall back to plain text"
}

// mammoth's extractRawText is async; kept as its own function so callers
// that already know they don't have a .docx (the xlsx/plain-text paths)
// don't need to be async themselves.
async function extractTextFromBuffer(buffer, mimeType, filename) {
  const xlsxText = extractTextFromBufferSync(buffer, mimeType, filename);
  if (xlsxText !== null) return xlsxText;
  const isDocx = (mimeType && mimeType.includes('wordprocessingml')) || /\.docx$/i.test(filename || '');
  if (isDocx) {
    const { value } = await getMammoth().extractRawText({ buffer });
    return value;
  }
  // .csv, .txt, or anything else text-shaped — best effort.
  return buffer.toString('utf8');
}

// ── Voyage AI embeddings ─────────────────────────────────────────────────
async function voyageEmbed(texts, inputType) {
  if (!VOYAGE_API_KEY) {
    throw new Error("Semantic search isn't set up yet — add a VOYAGE_API_KEY to the server's .env.");
  }
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || data.detail || 'Embedding request failed');
  return data.data.map((d) => d.embedding);
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

// ── Document storage ─────────────────────────────────────────────────────
async function saveDocument({ org_id, type, title, text, url, mime_type, created_by }) {
  const doc_id = `doc-${crypto.randomUUID()}`;
  const trimmedText = (text || '').slice(0, MAX_TEXT_CHARS);
  let embedding = null;
  if (VOYAGE_API_KEY && trimmedText.trim()) {
    try {
      const [vec] = await voyageEmbed([trimmedText], 'document');
      embedding = vec;
    } catch (err) {
      // Document still saves and is listable — it just won't come up in
      // semantic search until re-linked. Never block on this.
      console.error('[documents] Embedding failed for', title, err.message);
    }
  }
  const item = {
    doc_id, org_id, type,
    title: title || 'Untitled document',
    url: url || null,
    mime_type: mime_type || null,
    text: trimmedText,
    embedding,
    created_at: Date.now(),
    created_by: created_by || null,
  };
  await getDynamo().send(new PutCommand({ TableName: DOCUMENTS_TABLE, Item: item }));
  return item;
}

// Never send the full extracted text or the embedding vector to the client.
function publicDoc(d) {
  return {
    doc_id: d.doc_id,
    type: d.type,
    title: d.title,
    url: d.url,
    mime_type: d.mime_type,
    created_at: d.created_at,
    created_by: d.created_by,
    excerpt: (d.text || '').slice(0, 220),
    searchable: !!d.embedding,
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// A search call spends a Voyage embedding + a Claude call, so it gets its
// own per-IP limit — same rateLimit pattern as routes/rsvp.js's rsvpLimiter.
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many searches from this network — please wait a few minutes and try again.' },
});

// ── Status ───────────────────────────────────────────────────────────────
router.get('/google/status', authenticateToken, async (req, res) => {
  try {
    const org = await getOrganization(req.user.org_id);
    const connected = !!(org && org.social_accounts && org.social_accounts.google_docs && org.social_accounts.google_docs.refresh_token);
    return res.json({
      googleConfigured: !!getOAuthClient(),
      voyageConfigured: !!VOYAGE_API_KEY,
      googleConnected: connected,
    });
  } catch (err) {
    return sendServerError(res, err, 'Failed to load connection status');
  }
});

// ── Connect / disconnect Google ─────────────────────────────────────────
// GET (not a redirect) because it's called via fetch with the bearer token
// — a plain browser navigation to a protected route can't carry that
// header, so the frontend fetches this URL, then navigates the browser to
// the Google consent page itself.
router.get('/google/connect', authenticateToken, requireRole('owner', 'admin'), (req, res) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    return res.status(501).json({ error: "Google Drive/Forms isn't configured on the server yet — GOOGLE_CLIENT_SECRET and GOOGLE_DOCS_REDIRECT_URI need to be set." });
  }
  const state = jwt.sign({ org_id: req.user.org_id, purpose: 'google-docs-connect' }, JWT_SECRET, { expiresIn: '10m' });
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces a refresh_token even on a reconnect
    scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/forms.body'],
    state,
  });
  return res.json({ url });
});

// Google redirects the browser straight here — no Authorization header
// available, so the signed `state` (minted above, scoped to one org, 10-min
// expiry) is what stands in for auth on this one request.
router.get('/google/callback', async (req, res) => {
  const FRONTEND = process.env.FRONTEND_URL || '';
  const back = (params) => res.redirect(`${FRONTEND}/signups-admin?tab=documents&${params}`);

  const { code, state, error: oauthError } = req.query;
  if (oauthError) return back('google=error');

  const oauth2Client = getOAuthClient();
  if (!oauth2Client || !code || !state) return back('google=error');

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
  } catch {
    return back('google=error');
  }
  if (payload.purpose !== 'google-docs-connect' || !payload.org_id) return back('google=error');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      // Google only issues a refresh_token on first consent (prompt=consent
      // above should guarantee this) — without one there's nothing to store
      // and every later Forms/Drive call would silently have nothing to work with.
      return back('google=error&reason=no_refresh_token');
    }
    await saveGoogleDocsConnection(payload.org_id, tokens.refresh_token);
    return back('google=connected');
  } catch (err) {
    console.error('[documents] Google OAuth callback failed:', err);
    return back('google=error');
  }
});

router.post('/google/disconnect', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    await clearGoogleDocsConnection(req.user.org_id);
    return res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err, 'Failed to disconnect Google');
  }
});

// ── Create / link / upload documents ────────────────────────────────────
router.post('/forms', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const { title } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Give the form a title.' });
  try {
    const org = await getOrganization(req.user.org_id);
    const accessToken = await getAccessTokenForOrg(org);
    if (!accessToken) return res.status(400).json({ error: 'Connect your Google account first.' });
    const { editUrl, responderUri } = await createGoogleForm(accessToken, title.trim());
    const doc = await saveDocument({
      org_id: req.user.org_id,
      type: 'google_form',
      title: title.trim(),
      url: editUrl,
      mime_type: 'application/vnd.google-apps.form',
      text: `Google Form: ${title.trim()}`, // brand new & empty — nothing else to index yet
      created_by: req.user.email || req.user.user_id,
    });
    return res.status(201).json({ document: publicDoc(doc), url: editUrl, responderUri });
  } catch (err) {
    return sendServerError(res, err, 'Failed to create the Google Form');
  }
});

router.post('/drive-link', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const { url, title } = req.body || {};
  const fileId = parseDriveFileId(url);
  if (!fileId) return res.status(400).json({ error: "Couldn't find a Drive file ID in that link — paste the file's share link, or its ID directly." });
  try {
    const org = await getOrganization(req.user.org_id);
    const accessToken = await getAccessTokenForOrg(org);
    if (!accessToken) return res.status(400).json({ error: 'Connect your Google account first.' });
    const { name, mimeType, text } = await fetchDriveFileText(accessToken, fileId);
    const doc = await saveDocument({
      org_id: req.user.org_id,
      type: 'drive_file',
      title: (title && title.trim()) || name,
      url: `https://drive.google.com/file/d/${fileId}/view`,
      mime_type: mimeType,
      text,
      created_by: req.user.email || req.user.user_id,
    });
    return res.status(201).json({ document: publicDoc(doc) });
  } catch (err) {
    return sendServerError(res, err, err.message || 'Failed to link that Drive file');
  }
});

router.post('/upload', authenticateToken, requireRole('owner', 'admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const { originalname, mimetype, buffer } = req.file;
  const isXlsx = /\.xlsx?$/i.test(originalname) || (mimetype || '').includes('spreadsheet');
  const isDocx = /\.docx$/i.test(originalname) || (mimetype || '').includes('wordprocessingml');
  if (!isXlsx && !isDocx) {
    return res.status(400).json({ error: 'Only .xlsx, .xls, or .docx files are supported right now.' });
  }
  try {
    const text = await extractTextFromBuffer(buffer, mimetype, originalname);
    const doc = await saveDocument({
      org_id: req.user.org_id,
      type: isXlsx ? 'upload_xlsx' : 'upload_docx',
      title: originalname,
      text,
      created_by: req.user.email || req.user.user_id,
    });
    return res.status(201).json({ document: publicDoc(doc) });
  } catch (err) {
    return sendServerError(res, err, 'Failed to process that file');
  }
});

// ── List / delete ────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await getDynamo().send(new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: 'org-index',
      KeyConditionExpression: 'org_id = :org_id',
      ExpressionAttributeValues: { ':org_id': req.user.org_id },
      ScanIndexForward: false,
    }));
    return res.json({ documents: (result.Items || []).map(publicDoc) });
  } catch (err) {
    return sendServerError(res, err, 'Failed to load documents');
  }
});

router.delete('/:doc_id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const existing = await getDynamo().send(new GetCommand({ TableName: DOCUMENTS_TABLE, Key: { doc_id: req.params.doc_id } }));
    if (!existing.Item || existing.Item.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    await getDynamo().send(new DeleteCommand({ TableName: DOCUMENTS_TABLE, Key: { doc_id: req.params.doc_id } }));
    return res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err, 'Failed to delete that document');
  }
});

// ── AI semantic search + summary/recommendations ────────────────────────
router.post('/search', authenticateToken, searchLimiter, async (req, res) => {
  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Type a question or a few keywords to search for.' });
  if (!VOYAGE_API_KEY) {
    return res.status(501).json({ error: "Semantic search isn't set up yet — add a VOYAGE_API_KEY to the server's .env to enable it." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(501).json({ error: 'AI summaries need ANTHROPIC_API_KEY set on the server.' });
  }

  try {
    const org_id = req.user.org_id;
    const [queryEmbedding] = await voyageEmbed([query.trim()], 'query');

    const docsResult = await getDynamo().send(new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: 'org-index',
      KeyConditionExpression: 'org_id = :o',
      ExpressionAttributeValues: { ':o': org_id },
    }));
    const searchableDocs = (docsResult.Items || []).filter((d) => d.embedding);
    const ranked = searchableDocs
      .map((d) => ({ doc: d, score: cosineSimilarity(queryEmbedding, d.embedding) }))
      .sort((a, b) => b.score - a.score)
      .filter((r) => r.score > 0.2)
      .slice(0, 5);

    // Real, compact app-data context — nothing fabricated. Just this org's
    // own upcoming events and sign-up sheets, the same rows the Connect and
    // Analytics pages already show.
    const [events, sheets] = await Promise.all([
      getEventsByOrg(org_id).catch(() => []),
      listSheetsForOrg(org_id).catch(() => []),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 15);

    const appDataSummary = [
      `Upcoming events (${upcoming.length} shown):`,
      ...upcoming.map((e) => `- ${e.title} — ${e.date}${e.type ? ` (${e.type})` : ''}`),
      '',
      `Sign-up sheets (${sheets.length}):`,
      ...sheets.map((s) => `- ${s.title} [${s.type}] for event date ${s.event_date}`),
    ].join('\n');

    const docContext = ranked.length
      ? ranked.map((r, i) => `[Document ${i + 1}: "${r.doc.title}"]\n${(r.doc.text || '').slice(0, 3000)}`).join('\n\n---\n\n')
      : '(No linked document matched this question closely enough to include.)';

    const system = "You are the Connect assistant for a community organization on CalendarFly. Answer the admin's question using ONLY the app data and documents provided — never invent numbers, names, dates, or facts that aren't present in the material given. If the answer truly isn't in there, say so plainly instead of guessing. Respond with a short SUMMARY paragraph, then a RECOMMENDATIONS section with 2-4 concrete, actionable bullet points — include a recommendation only if the data actually supports it.";
    const userMessage = `QUESTION: ${query.trim()}\n\nAPP DATA:\n${appDataSummary}\n\nLINKED DOCUMENTS:\n${docContext}`;

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    const answer = (response.content || []).find((b) => b.type === 'text');

    return res.json({
      answer: (answer && answer.text) || 'No answer generated.',
      sources: ranked.map((r) => ({ doc_id: r.doc.doc_id, title: r.doc.title, type: r.doc.type, score: Math.round(r.score * 100) / 100 })),
      // Surfaced by the frontend right next to the answer — this is a
      // generated summary, not a verified fact sheet, so it's labeled every
      // time rather than trusted at face value.
      disclaimer: 'This summary is AI-generated from your linked documents and app data. It may be incomplete or inaccurate — double-check anything important.',
    });
  } catch (err) {
    return sendServerError(res, err, 'Search failed');
  }
});

module.exports = router;
