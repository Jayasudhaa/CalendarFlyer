// routes/facebookAuth.js
//
// "Continue with Facebook" -- now wired into Settings > Social Media
// (see temple-calendar/src/components/SocialConnectButtons.jsx), not the
// standalone test page anymore. Mounted the same way as before:
//   app.use(require('./routes/facebookAuth'));
//
// Auth model: the Settings page is a logged-in SPA, so it can call
// GET /auth/facebook/start with its normal JWT Authorization header to get
// a ready-to-use Facebook login URL. That URL's `state` is itself a
// short-lived signed JWT carrying the organization id -- this is what
// survives the redirect round trip to Meta and back (a plain page
// navigation to Meta can't carry an Authorization header, so the org has
// to travel inside `state` instead). This also means these routes no
// longer depend on express-session at all for CSRF -- the signed JWT state
// *is* the CSRF protection, verified in the callback below.
//
// Requires: npm install express axios jsonwebtoken

const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./auth');
const { getOrganization, updateOrganization } = require('../organizations');
const { JWT_SECRET } = require('../utils/jwtSecret');
const {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPages,
} = require('../lib/facebookClient');

const router = express.Router();

// Where to send the browser back to after Meta redirects to our callback.
// In local dev the backend (this server) and the Vite frontend run on
// different ports, so a bare relative redirect would 404 against this
// server instead of landing back in the React app -- FRONTEND_URL covers
// that case. In production (single server, same origin) FRONTEND_URL is
// unset and the relative path resolves correctly on its own.
const FRONTEND_BASE = process.env.FRONTEND_URL || '';
function settingsRedirect(query) {
  return `${FRONTEND_BASE}/settings?tab=social&${query}`;
}

// --- Step 1: Settings page calls this (authenticated) to get the URL ---
router.get('/auth/facebook/start', authenticateToken, (req, res) => {
  try {
    const state = jwt.sign(
      { orgId: req.user.org_id, purpose: 'facebook_connect' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    res.json({ url: buildAuthorizeUrl(state) });
  } catch (err) {
    // buildAuthorizeUrl throws a specific, user-facing message (via
    // utils/socialConfig.js) when FACEBOOK_APP_ID/SECRET/REDIRECT_URI
    // aren't set -- surfaced here rather than falling through to a generic
    // 500, same reasoning as social-connect.js's equivalent routes.
    res.status(400).json({ error: err.message });
  }
});

// --- Step 2: Facebook redirects back here with ?code=...&state=... ---
router.get('/auth/facebook/callback', async (req, res) => {
  const { code, state, error, error_reason: errorReason } = req.query;

  if (error) {
    console.error('Facebook OAuth error:', error, errorReason);
    return res.redirect(settingsRedirect('fb=denied'));
  }

  let orgId;
  try {
    ({ orgId } = jwt.verify(state, JWT_SECRET));
  } catch (err) {
    console.error('Facebook OAuth state invalid or expired:', err.message);
    return res.redirect(settingsRedirect('fb=error'));
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const pages = await getManagedPages(longLived.access_token);

    if (!pages || pages.length === 0) {
      return res.redirect(settingsRedirect('fb=error'));
    }

    if (pages.length === 1) {
      await finishConnectingPage(orgId, pages[0]);
      return res.redirect(settingsRedirect(`fb=connected&page=${encodeURIComponent(pages[0].name)}`));
    }

    // Multiple Pages: show a minimal, server-rendered picker. Only names are
    // shown in the HTML -- the actual page access tokens travel inside a
    // second short-lived signed JWT (pickState), never sent to the browser
    // as plain text and never stored server-side either.
    const pickState = jwt.sign(
      { orgId, pages: pages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token })) },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    return res.send(renderPagePicker(pages, pickState));
  } catch (err) {
    console.error('Facebook OAuth callback failed:', err.response ? err.response.data : err.message);
    return res.redirect(settingsRedirect('fb=error'));
  }
});

// --- Step 3 (only if the admin manages more than one Page) ---
router.post('/auth/facebook/select-page', express.urlencoded({ extended: false }), async (req, res) => {
  const { pageId, pickState } = req.body;

  let orgId, pages;
  try {
    ({ orgId, pages } = jwt.verify(pickState, JWT_SECRET));
  } catch (err) {
    return res.status(400).send('That Page selection has expired. Please go back to Settings and reconnect.');
  }

  const chosen = (pages || []).find(p => p.id === pageId);
  if (!chosen) {
    return res.status(400).send('That Page selection is no longer valid. Please reconnect.');
  }

  await finishConnectingPage(orgId, chosen);
  return res.redirect(settingsRedirect(`fb=connected&page=${encodeURIComponent(chosen.name)}`));
});

// Real persistence: writes into this organization's own row, in the exact
// shape routes/organizations.js's redactSocialAccounts() already expects
// (connected = !!page_token) -- so Settings' existing "Connected" badge and
// Disconnect button (organization.social_accounts.facebook, already wired
// for the older manual-entry flow) pick this up with no frontend changes
// beyond swapping in the new Connect buttons.
async function finishConnectingPage(orgId, page) {
  const existingOrg = await getOrganization(orgId);
  const social = { ...((existingOrg && existingOrg.social_accounts) || {}) };
  social.facebook = {
    page_token: page.access_token,
    page_id: page.id,
    page_name: page.name || '',
    connected_at: new Date().toISOString(),
    connected_via: 'oauth',
  };
  await updateOrganization(orgId, { social_accounts: social });
}

function renderPagePicker(pages, pickState) {
  const options = pages
    .map(p => `<label style="display:block;margin:8px 0;"><input type="radio" name="pageId" value="${escapeHtml(p.id)}" required> ${escapeHtml(p.name)}</label>`)
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Choose a Page — CalendarFly</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:60px auto;">
  <h2>Which Page should CalendarFly post to?</h2>
  <form method="POST" action="/auth/facebook/select-page">
    <input type="hidden" name="pickState" value="${escapeHtml(pickState)}">
    ${options}
    <button type="submit" style="margin-top:16px;padding:10px 18px;">Connect this Page</button>
  </form>
</body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = router;
