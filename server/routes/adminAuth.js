/**
 * server/routes/adminAuth.js
 * Site-wide super-admin login/logout/status — POST /api/admin/login,
 * POST /api/admin/logout, GET /api/admin/status.
 *
 * Extracted out of server.js so it follows the same "one feature, one
 * routes/*.js file" pattern as everything else in this app — these three
 * routes used to sit inline in server.js right alongside its CORS/session/
 * helmet setup, the one place in the app that didn't follow that pattern.
 *
 * This is a DIFFERENT thing from routes/admin.js (platform-owner
 * analytics). That file's routes consume the req.session.isAuthenticated
 * this one sets (guarded there by its own superAdminGuard); this file is
 * just the login/logout/status endpoints themselves. Both get mounted at
 * /api/admin in server.js and don't share any route paths, so there's no
 * collision.
 */
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require('../utils/adminCredentials');

const router = express.Router();

// Same rate-limiting pattern/library as routes/auth.js's loginLimiter —
// this is the site-wide super-admin login, an even higher-value
// brute-force target than a per-org login. Keyed by username+IP (rather
// than IP alone) so a distributed attempt against this one account still
// gets throttled, matching loginLimiter's per-account keying in auth.js.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const username = req.body && req.body.username ? String(req.body.username).toLowerCase().trim() : '';
    return `${username}:${ipKeyGenerator(req.ip)}`;
  },
  message: { success: false, error: 'Too many login attempts — please wait a few minutes and try again.' },
});

router.post('/login', adminLoginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    req.session.user = { username, displayName: 'Site Admin' };
    return res.json({ success: true, user: req.session.user });
  }

  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/status', (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

module.exports = router;
