// routes/instagramAuth.js
//
// "Continue with Instagram" -- wired into Settings > Social Media (see
// temple-calendar/src/components/SocialConnectButtons.jsx). Mounted the
// same way as before: app.use(require('./routes/instagramAuth'));
//
// Same auth model as routes/facebookAuth.js: the Settings page calls
// GET /auth/instagram/start (with its JWT) to get a login URL whose `state`
// is a short-lived signed JWT carrying the organization id -- no
// express-session dependency for CSRF, the signed state covers it.
//
// Requires: npm install express axios jsonwebtoken

const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./auth');
const { getOrganization, updateOrganization } = require('../organizations');
const { JWT_SECRET } = require('../utils/jwtSecret');
const {
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getProfile,
} = require('../lib/instagramClient');

const router = express.Router();

const FRONTEND_BASE = process.env.FRONTEND_URL || '';
function settingsRedirect(query) {
  return `${FRONTEND_BASE}/settings?tab=social&${query}`;
}

// --- Step 1: Settings page calls this (authenticated) to get the URL ---
router.get('/auth/instagram/start', authenticateToken, (req, res) => {
  try {
    const state = jwt.sign(
      { orgId: req.user.org_id, purpose: 'instagram_connect' },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    res.json({ url: buildAuthorizeUrl(state) });
  } catch (err) {
    // buildAuthorizeUrl throws a specific, user-facing message (via
    // utils/socialConfig.js) when INSTAGRAM_APP_ID/SECRET/REDIRECT_URI
    // aren't set -- surfaced here rather than falling through to a generic
    // 500, same reasoning as routes/facebookAuth.js's equivalent route.
    res.status(400).json({ error: err.message });
  }
});

// --- Step 2: Instagram redirects back here with ?code=...&state=... ---
router.get('/auth/instagram/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(settingsRedirect('ig=denied'));
  }

  let orgId;
  try {
    ({ orgId } = jwt.verify(state, JWT_SECRET));
  } catch (err) {
    console.error('Instagram OAuth state invalid or expired:', err.message);
    return res.redirect(settingsRedirect('ig=error'));
  }

  try {
    const shortLived = await exchangeCodeForShortLivedToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000);
    // Deliberately fetches "me", not shortLived.user_id directly -- see
    // lib/instagramClient.js's getProfile for why (that user_id isn't
    // reliably an ID graph.instagram.com will resolve by itself).
    const profile = await getProfile(shortLived.user_id, longLived.access_token);

    await saveInstagramConnection(orgId, {
      igUserId: profile.id,
      username: profile.username,
      accountType: profile.account_type,
      accessToken: longLived.access_token,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });

    return res.redirect(settingsRedirect(`ig=connected&handle=${encodeURIComponent(profile.username)}`));
  } catch (err) {
    console.error('Instagram OAuth callback failed:', err.response ? err.response.data : err.message);
    return res.redirect(settingsRedirect('ig=error'));
  }
});

// Real persistence, same shape organizations.js's redactSocialAccounts()
// already expects (connected = !!account_id) -- so Settings' existing
// "Connected" badge picks this up automatically. access_token/
// token_expires_at are extra fields alongside the standard ones, used by
// lib/instagramClient.js's publish functions later -- redactSocialAccounts
// never sends them back to the browser (it only echoes account_id/
// username/connected_via), same protection the Facebook Page token gets.
async function saveInstagramConnection(orgId, connection) {
  const existingOrg = await getOrganization(orgId);
  const social = { ...((existingOrg && existingOrg.social_accounts) || {}) };
  social.instagram = {
    account_id: connection.igUserId,
    username: connection.username,
    connected_at: new Date().toISOString(),
    connected_via: 'oauth',
    access_token: connection.accessToken,
    token_expires_at: connection.tokenExpiresAt,
    account_type: connection.accountType,
  };
  await updateOrganization(orgId, { social_accounts: social });
}

module.exports = router;
