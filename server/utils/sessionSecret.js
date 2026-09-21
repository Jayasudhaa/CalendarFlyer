/**
 * server/utils/sessionSecret.js
 * Single source of truth for express-session's signing secret.
 *
 * Mirrors utils/jwtSecret.js's pattern exactly, for the same reason: this
 * secret was previously read inline as `process.env.SESSION_SECRET` with no
 * guard at all, unlike JWT_SECRET (utils/jwtSecret.js) and the site-admin
 * credentials (utils/adminCredentials.js), which both fail loudly in
 * production if unset. SESSION_SECRET backs the same class of thing those
 * do — the live POST /api/admin/login super-admin session, and the
 * req.session.isAuthenticated checks in routes/admin.js, routes/
 * organizations.js, and routes/rsvp.js — so it gets the same protection:
 * fail at startup in production rather than let express-session silently
 * sign cookies with an unset/insecure secret.
 */
const DEV_FALLBACK = 'dev-only-insecure-session-secret-set-SESSION_SECRET-in-env';

if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set. Set it on the server before starting in production.');
  }
  console.warn('[AUTH] SESSION_SECRET not set — using an insecure development-only fallback. Set SESSION_SECRET in .env before deploying.');
}

const SESSION_SECRET = process.env.SESSION_SECRET || DEV_FALLBACK;

module.exports = { SESSION_SECRET };
