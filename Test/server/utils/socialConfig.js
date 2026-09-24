/**
 * server/utils/socialConfig.js
 * Fail-clear config getters for the Facebook/Instagram OAuth connect flow
 * (routes/facebookAuth.js, routes/instagramAuth.js, lib/facebookClient.js,
 * lib/instagramClient.js).
 *
 * Unlike utils/jwtSecret.js / utils/sessionSecret.js / utils/
 * adminCredentials.js, this does NOT throw at server startup — Facebook/
 * Instagram connect being unconfigured is a normal, low-stakes state for a
 * fresh deployment (the rest of the app works fine without it), so
 * crashing the whole server over it would be disproportionate the way it
 * is for JWT_SECRET/SESSION_SECRET/admin credentials.
 *
 * Instead, getFacebookConfig()/getInstagramConfig() throw a clear, specific
 * error the moment code actually tries to use the flow (building the OAuth
 * URL, or exchanging a code) — caught by the existing try/catch in each
 * route and surfaced as a real 400 with a real message, instead of what
 * happened before this file existed: lib/facebookClient.js and lib/
 * instagramClient.js read process.env directly at module-load time, so a
 * missing var silently became the literal string "undefined" baked into
 * the OAuth URL, and the resulting failure only showed up several steps
 * later as a confusing rejection from Facebook/Instagram's own servers —
 * exactly the kind of slow-to-diagnose bug this session hit more than
 * once with these routes.
 */

function getFacebookConfig() {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI } = process.env;
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET || !FACEBOOK_REDIRECT_URI) {
    throw new Error(
      'Facebook connect is not configured on the server — FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, ' +
      'and FACEBOOK_REDIRECT_URI must all be set in the environment before "Connect with Facebook" will work.'
    );
  }
  return { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI };
}

function getInstagramConfig() {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = process.env;
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET || !INSTAGRAM_REDIRECT_URI) {
    throw new Error(
      'Instagram connect is not configured on the server — INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, ' +
      'and INSTAGRAM_REDIRECT_URI must all be set in the environment before "Connect with Instagram" will work.'
    );
  }
  return { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI };
}

module.exports = { getFacebookConfig, getInstagramConfig };
