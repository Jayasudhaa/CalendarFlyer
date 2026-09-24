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
const { authenticateToken } = require('./auth');
const { getOrganization, updateOrganization, redactSocialAccounts } = require('../organizations');
const { sendServerError } = require('../utils/errors');

const router = express.Router();

const GRAPH_VERSION = 'v20.0';

// Whether this app's shared Meta App credentials are set -- WhatsApp
// Embedded Signup (below) is the only thing left in this file that needs
// them; the Facebook/Instagram OAuth-dialog flow that used to live here
// was retired in favor of routes/facebookAuth.js + routes/instagramAuth.js,
// which are configured independently (see utils/socialConfig.js).
function facebookConfigured() {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
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

// Facebook/Instagram OAuth-dialog connect flow (oauth-url/callback/pending/
// finish) that used to live here was retired — routes/facebookAuth.js and
// routes/instagramAuth.js are the live implementation now (see
// SocialConnectButtons.jsx). It shared FACEBOOK_APP_ID/SECRET with
// WhatsApp Embedded Signup below but owned its own FACEBOOK_OAUTH_REDIRECT_URI,
// which is why removing it also means that var is no longer read anywhere
// and can come out of server/.env.

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
