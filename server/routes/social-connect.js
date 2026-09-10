/**
 * server/routes/social-connect.js — "Connect with Facebook / Instagram /
 * WhatsApp" OAuth flows for Organization Settings.
 *
 * Before this file, Settings only had plain-text fields where an admin
 * pasted a Facebook Page ID + Page access token by hand (see
 * routes/organizations.js PUT /settings, which still exists unchanged —
 * that manual save path is kept as a fallback). This file replaces the
 * manual copy-paste with the real Meta OAuth flow: the admin clicks
 * Connect, logs into Facebook, picks their Page, and this backend fetches
 * the Page ID + Page access token itself instead of the admin hunting for
 * them in Graph API Explorer.
 *
 * ── Facebook + Instagram ─────────────────────────────────────────────────
 * Both use one Facebook Login for Business OAuth flow (redirect-based):
 *   1. Frontend calls GET /facebook/oauth-url (or /instagram/oauth-url —
 *      same flow, only the "purpose" differs, purely for which success
 *      message to show afterward) to get a Facebook dialog URL, then does
 *      a full-page redirect to it.
 *   2. Facebook redirects back to GET /facebook/callback with a `code`.
 *      This is a real browser navigation, not a fetch call, so it can't
 *      carry an Authorization header — the org_id instead travels inside
 *      `state`, a short-lived JWT signed with the same JWT_SECRET as login
 *      tokens (10 min expiry), which doubles as CSRF protection.
 *   3. The callback exchanges the code for a user token, exchanges that
 *      for a long-lived one, then calls /me/accounts to list every Page
 *      the admin manages — each entry already comes with its own Page
 *      access token and (if linked) its instagram_business_account.id, so
 *      no separate "look up the ID" step is needed.
 *   4. One Page → save immediately. Multiple Pages → stash the list
 *      server-side (pendingConnections, below) and send the admin to a
 *      picker in Settings; POST /facebook/finish saves whichever one they
 *      pick.
 *
 * Instagram never gets its own OAuth dialog — an Instagram Business
 * account only exists attached to a Facebook Page in the current Graph
 * API, so "Connect Instagram" runs the exact same Facebook flow and saves
 * whichever Page's linked IG account comes back.
 *
 * ── WhatsApp ──────────────────────────────────────────────────────────────
 * WhatsApp Business Platform doesn't use a redirect dialog — it uses Meta's
 * "Embedded Signup", a popup driven by the Facebook JavaScript SDK
 * (FB.login with a config_id created in the Meta App dashboard under
 * WhatsApp → Embedded Signup). The popup handles picking/creating a WABA,
 * verifying the phone number by OTP, and registering it — all inside
 * Meta's UI. When it finishes, the SDK hands the frontend an authorization
 * `code` plus the new `waba_id` and `phone_number_id`; the frontend posts
 * all three to POST /whatsapp/finish here, which exchanges the code for an
 * access token and saves the connection. See PremiumSettings.jsx for the
 * FB.login() call itself.
 *
 * ── What this needs before any of it works ───────────────────────────────
 * A Meta App with FACEBOOK_APP_ID / FACEBOOK_APP_SECRET /
 * FACEBOOK_OAUTH_REDIRECT_URI set in server/.env (and, for WhatsApp,
 * WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID). None of that exists yet as of this
 * writing — see the setup notes shared alongside this file for exactly
 * what to create in the Meta dashboard. Until FACEBOOK_APP_ID/SECRET are
 * set, /facebook/oauth-url and /instagram/oauth-url return a clear 400
 * instead of building a broken redirect, and GET /status (below) tells the
 * frontend to show "not configured yet" instead of a dead button.
 */

const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../utils/jwtSecret');
const { authenticateToken } = require('./auth');
const { getOrganization, updateOrganization, redactSocialAccounts } = require('../organizations');
const { sendServerError } = require('../utils/errors');

const router = express.Router();

const GRAPH_VERSION = 'v20.0';

// Permissions requested for the combined Facebook + Instagram connect flow.
// pages_manage_posts / instagram_content_publish / business_management need
// Meta App Review before they work for anyone other than the app's own
// admins/developers/testers (added under Meta App Dashboard → Roles) — see
// the setup notes. Until App Review is approved, "Connect with Facebook"
// only works for temples whose Facebook account has been added as a tester
// on the Meta App itself.
const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
].join(',');

// Holds Facebook Pages fetched mid-connect, for the rare admin who manages
// more than one Page, between the OAuth callback and them picking which one
// in the UI. In-memory rather than a DynamoDB table: the data is only ever
// needed for the next couple of minutes and never outlives this process on
// purpose. The one real cost of that: if App Runner is ever scaled to more
// than one instance, the picker's follow-up requests could land on a
// different instance than the one holding the entry and see "expired" even
// though it isn't — acceptable today at single-instance scale, worth
// revisiting (e.g. a short-TTL DynamoDB item) if that changes.
const pendingConnections = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [id, entry] of pendingConnections) {
    if (entry.createdAt < cutoff) pendingConnections.delete(id);
  }
}, 60 * 1000).unref();

// Paths this callback is allowed to send the browser back to after OAuth
// completes. Kept as a small allowlist (rather than trusting an arbitrary
// query param) so this can't be abused as an open redirect. '/social-media'
// is the standalone test page for the OAuth connect flow -- kept separate
// from '/settings' so testing it can never touch the working manual-entry
// flow there.
const ALLOWED_RETURN_PATHS = ['/settings', '/social-media'];
function settingsRedirectBase(returnTo) {
  const base = process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'https://calendarflyapp.com';
  const path = ALLOWED_RETURN_PATHS.includes(returnTo) ? returnTo : '/settings';
  return `${base.replace(/\/$/, '')}${path}`;
}

// Whether Facebook/Instagram OAuth (and, by extension, WhatsApp Embedded
// Signup, which reuses the same Meta App) is configured yet. Read by
// GET /status so the frontend can show "not connected yet" instead of a
// button that 400s.
function facebookConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET && process.env.FACEBOOK_OAUTH_REDIRECT_URI);
}
function whatsappSignupConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID);
}

router.get('/status', authenticateToken, (req, res) => {
  res.json({
    facebook_oauth_configured: facebookConfigured(),
    whatsapp_signup_configured: whatsappSignupConfigured(),
  });
});

// ── Facebook / Instagram — step 1: get the dialog URL ──────────────────────

function buildFacebookOAuthUrl(org_id, purpose, returnTo) {
  if (!facebookConfigured()) {
    throw new Error('Facebook connection isn\'t set up on the server yet — FACEBOOK_APP_ID, FACEBOOK_APP_SECRET and FACEBOOK_OAUTH_REDIRECT_URI all need to be set in server/.env first.');
  }
  // Short-lived signed state carries the org_id (and which page to send the
  // browser back to) across the redirect (the callback is a plain browser
  // navigation, so it can't send an Authorization header) and doubles as
  // CSRF protection — the callback refuses anything whose state doesn't
  // verify against JWT_SECRET.
  const state = jwt.sign({ org_id, purpose, returnTo, nonce: uuidv4() }, JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: process.env.FACEBOOK_OAUTH_REDIRECT_URI,
    state,
    scope: FACEBOOK_SCOPES,
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

router.get('/facebook/oauth-url', authenticateToken, (req, res) => {
  try {
    res.json({ url: buildFacebookOAuthUrl(req.user.org_id, 'facebook', req.query.return_to) });
  } catch (err) {
    // Deliberate user-facing config text from buildFacebookOAuthUrl above
    // (e.g. "FACEBOOK_APP_ID ... need to be set in server/.env first") —
    // the org admin needs to see this even in production, so it isn't
    // gated behind NODE_ENV like utils/errors.js's sendServerError.
    res.status(400).json({ error: err.message });
  }
});

// Instagram Business accounts are always attached to a Facebook Page, so
// "Connect Instagram" is the identical dialog — only `purpose` differs, and
// that's used purely to pick the right success message after the callback.
router.get('/instagram/oauth-url', authenticateToken, (req, res) => {
  try {
    res.json({ url: buildFacebookOAuthUrl(req.user.org_id, 'instagram', req.query.return_to) });
  } catch (err) {
    // Same reasoning as /facebook/oauth-url above.
    res.status(400).json({ error: err.message });
  }
});

// ── Facebook / Instagram — step 2: Meta redirects back here ────────────────

async function savePageToOrg(org_id, page) {
  const existingOrg = await getOrganization(org_id);
  const social = { ...((existingOrg && existingOrg.social_accounts) || {}) };

  social.facebook = {
    page_token: page.access_token,
    page_id: page.id,
    page_name: page.name || '',
    connected_at: new Date().toISOString(),
    connected_via: 'oauth',
  };

  if (page.instagram_business_account && page.instagram_business_account.id) {
    social.instagram = {
      account_id: page.instagram_business_account.id,
      username: page.instagram_business_account.username || '',
      connected_at: new Date().toISOString(),
      connected_via: 'oauth',
    };
  }

  await updateOrganization(org_id, { social_accounts: social });
}

router.get('/facebook/callback', async (req, res) => {
  // Default until the signed state is decoded below (early failures --
  // missing code, bad state -- have no returnTo to trust yet, so they fall
  // back to Settings same as always).
  let redirectUrl = settingsRedirectBase();
  const fail = (message) => res.redirect(`${redirectUrl}?social_error=${encodeURIComponent(message)}`);

  try {
    const { code, state, error, error_description } = req.query;
    if (error) return fail(error_description || error);
    if (!code || !state) return fail('Facebook did not return an authorization code — please try connecting again.');

    let decoded;
    try {
      decoded = jwt.verify(state, JWT_SECRET);
    } catch (e) {
      return fail('This connection link expired — please click Connect again.');
    }
    const { org_id, purpose, returnTo } = decoded;
    redirectUrl = settingsRedirectBase(returnTo);
    if (!org_id) return fail('This connection link is invalid — please click Connect again.');

    // Step 1: authorization code → short-lived user access token.
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: process.env.FACEBOOK_OAUTH_REDIRECT_URI,
      code,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error?.message || 'Facebook rejected the authorization code.');

    // Step 2: exchange for a long-lived user token (~60 days) — Page tokens
    // minted from a long-lived user token in step 3 inherit its long life
    // (Facebook Pages actually never expire a Page token derived this way,
    // in practice). Not fatal if this step fails; fall back to the
    // short-lived token rather than aborting the whole connection.
    let userToken = tokenData.access_token;
    const exchangeParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: userToken,
    });
    const longRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${exchangeParams.toString()}`);
    const longData = await longRes.json();
    if (longRes.ok && longData.access_token) userToken = longData.access_token;

    // Step 3: list every Page this admin manages, with each Page's own
    // access token and linked Instagram Business account (if any) already
    // attached — no separate ID lookup needed.
    const fields = 'id,name,access_token,instagram_business_account{id,username}';
    const pagesRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=${fields}&access_token=${encodeURIComponent(userToken)}`);
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok || pagesData.error) throw new Error(pagesData.error?.message || 'Could not list your Facebook Pages.');
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return fail('No Facebook Pages found on that account — you need to be an admin of a Facebook Page to connect it.');
    }

    if (pages.length === 1) {
      await savePageToOrg(org_id, pages[0]);
      return res.redirect(`${redirectUrl}?connected=${purpose === 'instagram' ? 'instagram' : 'facebook'}`);
    }

    // More than one Page — stash them and let the admin pick in Settings.
    const connect_id = uuidv4();
    pendingConnections.set(connect_id, { org_id, purpose, pages, createdAt: Date.now() });
    return res.redirect(`${redirectUrl}?select_page=${connect_id}&platform=${purpose}`);
  } catch (err) {
    console.error('[SOCIAL CONNECT] Facebook callback failed:', err.message);
    return fail(err.message);
  }
});

// ── Facebook / Instagram — step 3 (multi-Page admins only) ─────────────────

router.get('/facebook/pending/:connect_id', authenticateToken, (req, res) => {
  const pending = pendingConnections.get(req.params.connect_id);
  if (!pending) return res.status(404).json({ error: 'This connection has expired — please click Connect again.' });
  if (pending.org_id !== req.user.org_id) return res.status(403).json({ error: 'Not authorized for this connection.' });
  res.json({
    platform: pending.purpose,
    pages: pending.pages.map(p => ({
      id: p.id,
      name: p.name,
      has_instagram: !!(p.instagram_business_account && p.instagram_business_account.id),
    })),
  });
});

router.post('/facebook/finish', authenticateToken, async (req, res) => {
  try {
    const { connect_id, page_id } = req.body;
    const pending = pendingConnections.get(connect_id);
    if (!pending) return res.status(400).json({ error: 'This connection has expired — please click Connect again.' });
    if (pending.org_id !== req.user.org_id) return res.status(403).json({ error: 'Not authorized for this connection.' });

    const page = pending.pages.find(p => p.id === page_id);
    if (!page) return res.status(400).json({ error: 'That Page was not part of this connection — please click Connect again.' });

    await savePageToOrg(pending.org_id, page);
    pendingConnections.delete(connect_id);

    const updated = await getOrganization(pending.org_id);
    res.json({ success: true, social_accounts: redactSocialAccounts(updated) });
  } catch (err) {
    console.error('[SOCIAL CONNECT] Facebook finish failed:', err.message);
    sendServerError(res, err);
  }
});

// ── WhatsApp — Embedded Signup ──────────────────────────────────────────────
// See the file header. The frontend drives the popup itself (FB.login with
// WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID); this endpoint only runs once that
// popup has finished and handed back a code + the new WABA/phone IDs.

router.post('/whatsapp/finish', authenticateToken, async (req, res) => {
  try {
    const { code, waba_id, phone_number_id } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing authorization code from WhatsApp signup — please try connecting again.' });
    if (!waba_id || !phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp signup finished without a business account or phone number — please try connecting again.' });
    }

    // Embedded Signup's code is exchanged the same way a redirect-flow code
    // is (step 1 above) — except there's no redirect_uri, since the JS SDK
    // popup never navigates the browser away.
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      code,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) throw new Error(tokenData.error?.message || 'Meta rejected the WhatsApp signup code.');

    const org_id = req.user.org_id;
    const existingOrg = await getOrganization(org_id);
    const social = { ...((existingOrg && existingOrg.social_accounts) || {}) };
    social.whatsapp = {
      token: tokenData.access_token,
      phone_id: phone_number_id,
      waba_id,
      connected_at: new Date().toISOString(),
      connected_via: 'embedded_signup',
      // This token comes from exchanging Embedded Signup's code, not from a
      // Business Manager System User — Meta doesn't document a fixed
      // expiry for it, but unlike the manual test tokens from the WhatsApp
      // Manager dashboard (the ~24h ones fixed earlier this session), it
      // isn't a short-lived test token either. If sends ever start failing
      // with an auth error again, generating a permanent System User token
      // in Meta Business Settings is the fix that never needs refreshing.
    };
    const updated = await updateOrganization(org_id, { social_accounts: social });
    res.json({ success: true, social_accounts: redactSocialAccounts(updated) });
  } catch (err) {
    console.error('[SOCIAL CONNECT] WhatsApp finish failed:', err.message);
    // Deliberate user-facing text — "Meta rejected the WhatsApp signup
    // code." above — the admin needs to see why the connect attempt
    // failed, so this isn't gated behind NODE_ENV.
    res.status(500).json({ error: err.message });
  }
});

// Tells the frontend what to pass to FB.init()/FB.login() for the WhatsApp
// popup. FACEBOOK_APP_ID and the signup config_id aren't secret (they're
// visible in the browser the moment the popup opens either way) — serving
// them from here avoids also having to duplicate them into the frontend's
// separate VITE_-prefixed build-time env just for this one button.
router.get('/whatsapp/config', authenticateToken, (req, res) => {
  res.json({
    appId: process.env.FACEBOOK_APP_ID || null,
    configId: process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || null,
    configured: whatsappSignupConfigured(),
  });
});

// ── Look up a Facebook Page by its public URL, without OAuth ─────────────
// Replaces the "Connect with Facebook" redirect button (dropped -- it
// needs Meta App Review-adjacent dashboard config -- App Domains, Website
// Site URL, Valid OAuth Redirect URIs -- that kept breaking in practice).
// An admin now just pastes their Page's facebook.com link; this resolves
// it against the Graph API using our own app credentials (an "app access
// token", FACEBOOK_APP_ID + "|" + FACEBOOK_APP_SECRET -- valid for reading
// PUBLIC data about any node, no per-user login required) and hands back
// the Page's real id/name so Settings can show a genuine "found this page"
// status instead of blindly trusting whatever the admin typed.
//
// Note this only confirms the Page exists and what it's called -- it does
// NOT grant permission to post to it. Actually posting via Broadcast still
// needs a Page access token (the "Page Access Token" field alongside this
// one), since that requires the Page's own admin to have granted
// pages_manage_posts, which a public lookup can never provide.
function extractFacebookPageRef(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return null;

  // Bare id or username (no URL) -- pass through as-is.
  if (!/^https?:\/\//i.test(raw) && !raw.includes('facebook.com')) {
    return raw.replace(/^@/, '');
  }

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (!/(^|\.)facebook\.com$/i.test(url.hostname.replace(/^www\./, ''))) return null;

    // https://www.facebook.com/profile.php?id=61593100335914
    const idParam = url.searchParams.get('id');
    if (idParam) return idParam;

    // https://www.facebook.com/SomePageName(/...)
    const segment = url.pathname.split('/').filter(Boolean)[0];
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    return null;
  }
}

router.post('/facebook/lookup-page', authenticateToken, async (req, res) => {
  const ref = extractFacebookPageRef(req.body && req.body.page_url);
  if (!ref) {
    return res.status(400).json({ error: "That doesn't look like a Facebook Page link. Paste the full facebook.com URL for your Page." });
  }
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return res.status(500).json({ error: 'Facebook lookup is not configured on the server yet (FACEBOOK_APP_ID/SECRET missing).' });
  }

  try {
    const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(ref)}?fields=id,name,link,picture.type(large)&access_token=${encodeURIComponent(appToken)}`;
    const gRes = await fetch(url);
    const data = await gRes.json();

    if (!gRes.ok || data.error) {
      const msg = (data.error && data.error.message) || 'Facebook could not find a Page at that link.';
      // Temporary: surface code/type/subcode too while we're debugging why
      // this keeps failing -- these aren't secret, just diagnostic detail
      // Meta's API attaches to the error (e.g. code 190 = bad app token,
      // code 100 = bad parameter/unsupported node). Safe to drop once this
      // is working reliably.
      console.error('[SOCIAL] facebook/lookup-page Graph API error:', JSON.stringify(data.error));
      return res.status(400).json({
        error: msg,
        debug: data.error ? { code: data.error.code, type: data.error.type, error_subcode: data.error.error_subcode } : null,
      });
    }
    if (!data.id || !data.name) {
      return res.status(400).json({ error: "That link didn't resolve to a Facebook Page." });
    }

    res.json({
      id: data.id,
      name: data.name,
      link: data.link || null,
      picture: (data.picture && data.picture.data && data.picture.data.url) || null,
    });
  } catch (err) {
    console.error('[SOCIAL] facebook/lookup-page error:', err.message);
    res.status(500).json({ error: 'Could not reach Facebook to verify that Page — please try again.' });
  }
});

module.exports = router;
