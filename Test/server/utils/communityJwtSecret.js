/**
 * server/utils/communityJwtSecret.js
 * Signing secret for community-member tokens (server/community-auth.js) —
 * deliberately NOT the same secret as utils/jwtSecret.js's admin JWT_SECRET.
 *
 * Community members (devotees verified by phone OTP — see community-auth.js)
 * and admin/staff accounts (routes/auth.js) are structurally separate trust
 * domains. If both token kinds were signed with the same secret,
 * `authenticateToken` (routes/auth.js) would happily verify a community
 * token's signature — it only checks the signature is valid, not what role
 * issued it — and every admin route that doesn't explicitly re-check
 * `req.user.role` would treat a devotee as a fully authenticated admin.
 * That's not a hypothetical: PUT /api/organizations/settings, for one,
 * trusts req.user.org_id with no role check at all today.
 *
 * Signing community tokens with a genuinely different secret makes that
 * class of bug structurally impossible instead of relying on every route,
 * present and future, to remember a role check: jwt.verify() fails outright
 * on a mismatched secret regardless of claims content.
 *
 * Derived from JWT_SECRET (SHA-256 with a fixed, distinguishing suffix)
 * rather than requiring a brand-new .env value — one less required setup
 * step, while still being bytes-different from JWT_SECRET itself.
 */
const crypto = require('crypto');
const { JWT_SECRET } = require('./jwtSecret');

const COMMUNITY_JWT_SECRET = crypto
  .createHash('sha256')
  .update(`${JWT_SECRET}:community-member-v1`)
  .digest('hex');

module.exports = { COMMUNITY_JWT_SECRET };
