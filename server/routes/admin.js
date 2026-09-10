/**
 * server/routes/admin.js
 * Platform-owner-only analytics: who's using CalendarFly and how.
 *
 * Guarded the same way as organizations.js's /list route — site-wide admin
 * session (POST /api/admin/login) OR the ADMIN_SECRET header. This is
 * intentionally separate from the per-org authenticateToken middleware:
 * any tenant admin passing that check must never be able to see every
 * other org's data, only the platform owner should.
 */
const express = require('express');
const router = express.Router();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, QueryCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const OpenAI = require('openai');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);
const { getSettings, saveSettings, KNOWN_CATEGORIES } = require('../utils/aiSettingsStore');
const { getOrganization, updateOrganization, PLAN_FEATURES } = require('../organizations');
const { sendServerError } = require('../utils/errors');

let openai = null;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}
let s3 = null;
function getS3() {
  if (!s3) {
    s3 = new S3Client({ region: process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2' });
  }
  return s3;
}

function superAdminGuard(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const provided = req.headers['x-admin-secret'] || req.query.secret;
    if (provided === secret) {
      return next();
    }
  }
  // A specific org staff account can also get platform-owner access
  // through its own regular login, with no separate site-admin login or
  // ADMIN_SECRET needed -- set PLATFORM_ADMIN_EMAILS (comma-separated) in
  // .env to the address(es) that should get this. Checked last since
  // most requests here come through the session or ADMIN_SECRET path
  // above.
  const platformAdminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (platformAdminEmails.length) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../utils/jwtSecret');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.email && platformAdminEmails.includes(String(decoded.email).toLowerCase())) {
          return next();
        }
      } catch (e) { /* invalid/expired token -- fall through to 401 below */ }
    }
  }
  return res.status(401).json({ error: 'Unauthorized - Admin login required' });
}

async function scanAll(tableName) {
  let items = [];
  let ExclusiveStartKey;
  do {
    const result = await dynamodb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items = items.concat(result.Items || []);
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// created_at is stored inconsistently across the codebase — Date.now() (number)
// in some places, new Date().toISOString() (string) in others. Normalize both.
function toMs(t) {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const parsed = Date.parse(t);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

router.get('/stats', superAdminGuard, async (req, res) => {
  try {
    const [orgs, users, events] = await Promise.all([
      scanAll('calendarfly_organizations'),
      scanAll('calendarfly_users'),
      scanAll('calendarfly_events'),
    ]);

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const since7 = now - 7 * DAY;
    const since30 = now - 30 * DAY;

    const organizations_by_category = {};
    const organizations_by_plan = {};
    let signups_last_7_days = 0;
    let signups_last_30_days = 0;

    const orgList = orgs.map(o => {
      const createdMs = toMs(o.created_at);
      const categoryKey = o.category || 'not set';
      const planKey = o.plan || 'free';
      organizations_by_category[categoryKey] = (organizations_by_category[categoryKey] || 0) + 1;
      organizations_by_plan[planKey] = (organizations_by_plan[planKey] || 0) + 1;
      if (createdMs && createdMs >= since7) signups_last_7_days++;
      if (createdMs && createdMs >= since30) signups_last_30_days++;
      return {
        org_id: o.org_id,
        name: o.name,
        subdomain: o.subdomain,
        category: o.category || null,
        plan: planKey,
        created_at: createdMs,
        onboarding_completed: o.onboarding_completed !== false,
        suspended: !!o.suspended,
        feature_overrides: o.feature_overrides || {},
        users_count: 0,
        events_count: 0,
        last_login_at: null,
        signup_email: null,
      };
    });

    const orgById = {};
    orgList.forEach(o => { orgById[o.org_id] = o; });

    // Earliest-created user per org stands in for "the email that signed up"
    // — orgs don't store an email themselves, only their users do.
    const earliestUserMsByOrg = {};

    users.forEach(u => {
      const o = orgById[u.org_id];
      if (!o) return;
      o.users_count++;
      const lastLogin = toMs(u.last_login_at);
      if (lastLogin && (!o.last_login_at || lastLogin > o.last_login_at)) {
        o.last_login_at = lastLogin;
      }
      const userCreatedMs = toMs(u.created_at);
      const earliestSoFar = earliestUserMsByOrg[u.org_id];
      if (u.email && (earliestSoFar === undefined || (userCreatedMs != null && userCreatedMs < earliestSoFar))) {
        earliestUserMsByOrg[u.org_id] = userCreatedMs != null ? userCreatedMs : Infinity;
        o.signup_email = u.email;
      }
    });

    let events_created_last_7_days = 0;
    let events_created_last_30_days = 0;
    events.forEach(e => {
      const o = orgById[e.org_id];
      if (o) o.events_count++;
      const createdMs = toMs(e.created_at);
      if (createdMs && createdMs >= since7) events_created_last_7_days++;
      if (createdMs && createdMs >= since30) events_created_last_30_days++;
    });

    orgList.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    res.json({
      totals: {
        organizations: orgs.length,
        users: users.length,
        events: events.length,
      },
      signups_last_7_days,
      signups_last_30_days,
      events_created_last_7_days,
      events_created_last_30_days,
      organizations_by_category,
      organizations_by_plan,
      organizations: orgList,
    });
  } catch (error) {
    console.error('[ADMIN] Stats error:', error);
    res.status(500).json({ error: 'Failed to load platform stats' });
  }
});

// ── Users & Access (super admin only) ────────────────────────────────────
// Platform-wide user management: see every user across every tenant,
// manually verify an account (bypasses email delivery — useful when SES
// isn't configured yet, e.g. local/dev, or a real email just didn't land),
// and per-org controls (suspend a tenant entirely, or override individual
// feature flags regardless of plan).

// GET /api/admin/users — every user, across every org, with org context.
router.get('/users', superAdminGuard, async (req, res) => {
  try {
    const [users, orgs] = await Promise.all([
      scanAll('calendarfly_users'),
      scanAll('calendarfly_organizations'),
    ]);
    const orgById = {};
    orgs.forEach(o => { orgById[o.org_id] = o; });

    const userList = users.map(u => {
      const org = orgById[u.org_id];
      return {
        user_id: u.user_id,
        email: u.email,
        display_name: u.display_name || null,
        role: u.role || 'admin',
        email_verified: u.email_verified !== false, // grandfathered accounts (no field) count as verified
        created_at: toMs(u.created_at),
        last_login_at: toMs(u.last_login_at),
        org_id: u.org_id,
        org_name: org ? org.name : '(deleted org)',
        org_subdomain: org ? org.subdomain : null,
        org_suspended: !!(org && org.suspended),
      };
    });
    userList.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    res.json({ users: userList });
  } catch (error) {
    console.error('[ADMIN] Users list error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// POST /api/admin/users/:user_id/verify — manually mark an account's email
// verified. Same effect as the user clicking their emailed link, without
// needing that email to actually arrive (SES unconfigured, spam-filtered,
// user mistyped the address then fixed it in the DB by hand, etc).
router.post('/users/:user_id/verify', superAdminGuard, async (req, res) => {
  try {
    await dynamodb.send(new UpdateCommand({
      TableName: 'calendarfly_users',
      Key: { user_id: req.params.user_id },
      UpdateExpression: 'SET email_verified = :v, email_verified_at = :t',
      ExpressionAttributeValues: { ':v': true, ':t': Date.now() },
    }));
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN] Verify user error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
});

// POST /api/admin/organizations/:org_id/suspend — block a tenant from
// signing in. Checked in POST /api/auth/login; an already-issued token for
// an existing session keeps working until it expires (same lazy-check
// tradeoff as trial expiry — no session-revocation list exists in this
// app), so this is a "stop new logins" switch, not an instant kill switch.
router.post('/organizations/:org_id/suspend', superAdminGuard, async (req, res) => {
  try {
    const updated = await updateOrganization(req.params.org_id, { suspended: true });
    res.json({ success: true, organization: updated });
  } catch (error) {
    console.error('[ADMIN] Suspend org error:', error);
    res.status(500).json({ error: 'Failed to suspend organization' });
  }
});

router.post('/organizations/:org_id/reactivate', superAdminGuard, async (req, res) => {
  try {
    const updated = await updateOrganization(req.params.org_id, { suspended: false });
    res.json({ success: true, organization: updated });
  } catch (error) {
    console.error('[ADMIN] Reactivate org error:', error);
    res.status(500).json({ error: 'Failed to reactivate organization' });
  }
});

// PUT /api/admin/organizations/:org_id/features — set one feature override
// for an org (true/false), or clear it back to plan default (null). Merged
// on top of the plan's normal PLAN_FEATURES by organizations.js's
// applyFeatureOverrides() every time the org is read, so this survives
// plan changes and never needs re-applying.
const OVERRIDABLE_FEATURES = Object.keys(PLAN_FEATURES.enterprise);

router.put('/organizations/:org_id/features', superAdminGuard, async (req, res) => {
  const { feature, enabled } = req.body || {};
  if (!OVERRIDABLE_FEATURES.includes(feature)) {
    return res.status(400).json({ error: `feature must be one of: ${OVERRIDABLE_FEATURES.join(', ')}` });
  }
  if (enabled !== null && typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be true, false, or null (to clear the override)' });
  }
  try {
    const org = await getOrganization(req.params.org_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // org.feature_overrides is the raw stored map — applyFeatureOverrides()
    // only rewrites the computed org.features on read, it never touches this
    // field, so it's always safe to read and patch directly.
    const currentOverrides = { ...(org.feature_overrides || {}) };
    if (enabled === null) {
      delete currentOverrides[feature];
    } else {
      currentOverrides[feature] = enabled;
    }

    const updated = await updateOrganization(req.params.org_id, { feature_overrides: currentOverrides });
    res.json({ success: true, organization: updated });
  } catch (error) {
    console.error('[ADMIN] Feature override error:', error);
    res.status(500).json({ error: 'Failed to update feature override' });
  }
});

// Delete every item a QueryCommand on org-index turns up for one table, in
// batches of 25 (BatchWriteCommand's hard limit) — shared by the org-delete
// route below for both calendarfly_users and calendarfly_events, which both
// carry that GSI.
async function deleteAllByOrgIndex(tableName, keyName, org_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
  }));
  const items = result.Items || [];
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await dynamodb.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ DeleteRequest: { Key: { [keyName]: item[keyName] } } })),
      },
    }));
  }
  return items.length;
}

// DELETE /api/admin/organizations/:org_id — permanently remove a test/
// unwanted tenant: the org record itself, every user in it, and every
// event it owns. Irreversible, so the request body must echo the org's
// exact subdomain back as `confirm_subdomain` — a fat-fingered click on
// the wrong row can't destroy a real org's data this way. RSVP responses
// and any S3-hosted flyers/logos/reference photos are NOT cleaned up (no
// org-scoped index to find them by), so those become orphaned storage —
// acceptable for clearing out test orgs, worth knowing before deleting an
// org that actually generated real assets.
router.delete('/organizations/:org_id', superAdminGuard, async (req, res) => {
  const { org_id } = req.params;
  const { confirm_subdomain } = req.body || {};
  try {
    const org = await getOrganization(org_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!confirm_subdomain || confirm_subdomain !== org.subdomain) {
      return res.status(400).json({ error: 'confirm_subdomain must exactly match the organization\'s subdomain' });
    }

    const [usersDeleted, eventsDeleted] = await Promise.all([
      deleteAllByOrgIndex('calendarfly_users', 'user_id', org_id),
      deleteAllByOrgIndex('calendarfly_events', 'event_id', org_id),
    ]);

    await dynamodb.send(new DeleteCommand({
      TableName: 'calendarfly_organizations',
      Key: { org_id },
    }));

    console.log(`[ADMIN] Deleted org ${org_id} (${org.subdomain}): ${usersDeleted} users, ${eventsDeleted} events`);
    res.json({ success: true, users_deleted: usersDeleted, events_deleted: eventsDeleted });
  } catch (error) {
    console.error('[ADMIN] Delete org error:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// ── AI Image Generation Settings (super admin only) ─────────────────────
// The system prompt / guardrails / per-org-type prompt config used by
// POST /api/generate-image. Only ever readable or editable through this
// superAdminGuard-protected pair of routes — never exposed to org users.
router.get('/ai-settings', superAdminGuard, (req, res) => {
  try {
    return res.json(getSettings());
  } catch (error) {
    console.error('[ADMIN] ai-settings GET error:', error);
    return res.status(500).json({ error: 'Failed to load AI settings' });
  }
});

router.put('/ai-settings', superAdminGuard, (req, res) => {
  const { systemPrompt, blockedTerms, categories } = req.body || {};

  if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
    return res.status(400).json({ error: 'systemPrompt must be a string' });
  }
  if (blockedTerms !== undefined) {
    if (!Array.isArray(blockedTerms) || blockedTerms.some(t => typeof t !== 'string')) {
      return res.status(400).json({ error: 'blockedTerms must be an array of strings' });
    }
  }
  if (categories !== undefined) {
    if (typeof categories !== 'object' || categories === null || Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories must be an object' });
    }
    for (const [key, val] of Object.entries(categories)) {
      if (!KNOWN_CATEGORIES.includes(key)) {
        return res.status(400).json({ error: `Unknown category "${key}"` });
      }
      if (val.requiredContext !== undefined) {
        if (!Array.isArray(val.requiredContext) || val.requiredContext.some(t => typeof t !== 'string')) {
          return res.status(400).json({ error: `${key}.requiredContext must be an array of strings` });
        }
      }
      if (val.styleSuffix !== undefined && typeof val.styleSuffix !== 'string') {
        return res.status(400).json({ error: `${key}.styleSuffix must be a string` });
      }
      if (val.posterStyleSuffix !== undefined && typeof val.posterStyleSuffix !== 'string') {
        return res.status(400).json({ error: `${key}.posterStyleSuffix must be a string` });
      }
      if (val.referenceStyleSuffix !== undefined && typeof val.referenceStyleSuffix !== 'string') {
        return res.status(400).json({ error: `${key}.referenceStyleSuffix must be a string` });
      }
      if (val.label !== undefined && typeof val.label !== 'string') {
        return res.status(400).json({ error: `${key}.label must be a string` });
      }
      if (val.examples !== undefined && typeof val.examples !== 'string') {
        return res.status(400).json({ error: `${key}.examples must be a string` });
      }
    }
  }

  try {
    const saved = saveSettings({ systemPrompt, blockedTerms, categories });
    return res.json(saved);
  } catch (error) {
    console.error('[ADMIN] ai-settings PUT error:', error);
    return res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// ── Stock Image Library generator (super admin only) ─────────────────────
// Generates a single background-style image (same guardrails/style suffix
// used by the temple category in /api/generate-image) and uploads it
// straight into the shared curated S3 library at
// temple-images/library/<category>/ — the same place server/routes/
// imageLibrary.js lists images from for every org's "Library" stock tab.
// Kept super-admin-only because that library is shared across ALL tenants;
// letting any org contribute to it would make it impossible to moderate.
const LIBRARY_CATEGORIES = ['Deities', 'Festivals', 'Flowers', 'Rangoli', 'General', 'States'];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
}

router.post('/library-image', superAdminGuard, async (req, res) => {
  const { prompt, category } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'A prompt describing the image is required.' });
  }
  if (!LIBRARY_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${LIBRARY_CATEGORIES.join(', ')}` });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server.' });
  }
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    return res.status(500).json({ error: 'S3_BUCKET_NAME not configured on server.' });
  }

  try {
    const moderation = await getOpenAI().moderations.create({ input: prompt });
    if (moderation.results[0]?.flagged) {
      const cats = Object.entries(moderation.results[0].categories).filter(([, v]) => v).map(([k]) => k).join(', ');
      return res.status(400).json({ error: `Prompt flagged as inappropriate (${cats}).`, blocked: true });
    }
  } catch (modErr) {
    console.error('[ADMIN] library-image moderation error (continuing):', modErr.message);
  }

  // Same background-style suffix + global system prompt used for every
  // temple-category image, so library stock stays visually consistent with
  // anything an org generates themselves — plain artwork, no baked-in text.
  const settings = getSettings();
  const styleSuffix = settings.categories.temple?.styleSuffix || '';
  const safePrompt = `${prompt.trim()}${styleSuffix} ${settings.systemPrompt}`;

  try {
    console.log(`[ADMIN] Generating library image (category=${category}):`, prompt.slice(0, 80));
    const response = await getOpenAI().images.generate({
      model: 'gpt-image-1',
      prompt: safePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const b64 = response.data[0]?.b64_json;
    const imgUrl = response.data[0]?.url;
    let buffer, contentType = 'image/png';
    if (b64) {
      buffer = Buffer.from(b64, 'base64');
    } else if (imgUrl) {
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
      contentType = imgRes.headers.get('content-type') || 'image/png';
    } else {
      throw new Error('No image returned from API');
    }

    const region = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    const key = `temple-images/library/${category}/${slugify(prompt)}-${Date.now()}.${ext}`;

    await getS3().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
      Metadata: { generatedFrom: 'admin-library-generator' },
    }));

    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log(`[ADMIN] Saved library image: ${key}`);
    return res.json({ url, key, category });
  } catch (err) {
    console.error('[ADMIN] library-image error:', err.message);
    if (err.message?.includes('content_policy') || err.message?.includes('safety system')) {
      return res.status(400).json({ error: 'Request declined due to content policy. Please revise the prompt.', blocked: true });
    }
    return sendServerError(res, err, 'Image generation failed');
  }
});

module.exports = router;
