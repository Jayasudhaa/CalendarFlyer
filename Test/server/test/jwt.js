/**
 * test/jwt.js — signs a test JWT the same way real login does, using the
 * same JWT_SECRET module every route's authenticateToken middleware
 * verifies against (see utils/jwtSecret.js) — so a test request's
 * Authorization header is indistinguishable from a real logged-in admin's.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/jwtSecret');

function signTestToken(overrides = {}) {
  return jwt.sign(
    { user_id: 'user-test', org_id: 'org-test', role: 'admin', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = { signTestToken };
