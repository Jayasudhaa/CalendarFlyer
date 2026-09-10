/**
 * server/utils/adminCredentials.js
 * Single source of truth for the site-wide super-admin login credentials
 * (POST /api/admin/login in server.js — NOT the per-org ADMIN_SECRET header
 * guard in routes/admin.js / routes/organizations.js, see utils/jwtSecret.js
 * for that file's own fail-loud pattern which this mirrors).
 *
 * Unlike JWT_SECRET, there is no safe "insecure dev fallback" for a login
 * username/password — a fallback here would just be a second, permanently
 * known password. Before this fix, an unset ADMIN_USERNAME/ADMIN_PASSWORD
 * meant `undefined === undefined`, so an empty-body POST to /api/admin/login
 * would authenticate as the site admin. So this always fails loudly (in
 * every environment, not just production) rather than warn-and-continue.
 */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_USERNAME and ADMIN_PASSWORD must both be set (non-empty) in the server .env before starting — ' +
    'they gate the site-wide super-admin login at POST /api/admin/login.'
  );
}

module.exports = { ADMIN_USERNAME, ADMIN_PASSWORD };
