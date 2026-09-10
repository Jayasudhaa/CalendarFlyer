/**
 * server/utils/resetToken.js
 * Pure crypto for the forgot-password flow — no Express, no DynamoDB, so
 * this can be unit tested directly (see resetToken.test.js).
 *
 * Same "signed JWT instead of a DB-stored token" trick as email
 * verification (see EMAIL_VERIFY_EXPIRES_IN in routes/auth.js), but reset
 * tokens need one more property verification tokens don't: single-use.
 * A verify-email link can safely be clicked twice (verifying is
 * idempotent). A reset-password link must NOT still work after the
 * password has already been reset with it — otherwise anyone who
 * intercepted an old email (or the user's own browser history/cache)
 * could rewind a later password change.
 *
 * Rather than a database table just to mark one token "used" (with its own
 * cleanup/expiry problem), the token itself carries a `pwf` claim — an
 * HMAC-SHA256 "password fingerprint" of the user's CURRENT password_hash
 * at the moment the token was minted. Verifying recomputes the same HMAC
 * from the user's *current* password_hash and requires a match. Since
 * resetting the password changes password_hash, the fingerprint the old
 * token carries stops matching the instant it's used once — no revocation
 * list needed, and the token becomes worthless the moment it's redeemed.
 *
 * IMPORTANT: the raw password_hash itself must never appear in the JWT
 * payload. JWT payloads are base64url-encoded, not encrypted — anyone with
 * the link (e.g. anyone with read access to the recipient's inbox) could
 * decode it and read the real bcrypt hash. The HMAC fingerprint is
 * one-way: it proves "the password hasn't changed since" without
 * revealing what the hash actually is.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('./jwtSecret');

const RESET_PASSWORD_PURPOSE = 'reset-password';
const RESET_TOKEN_EXPIRES_IN = '1h';
// 16 hex chars (64 bits) of the HMAC — plenty to prevent collision between
// two different password hashes while keeping the JWT payload small; this
// is a freshness check, not a secret value that needs full-length HMAC.
const FINGERPRINT_LENGTH = 16;

function passwordFingerprint(passwordHash) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(String(passwordHash || ''))
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);
}

/**
 * Signs a password-reset token for `user`. `user` needs `user_id` and
 * `password_hash` (the CURRENT hash — used only to derive the one-way
 * fingerprint, never stored in the token itself).
 */
function createResetToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      purpose: RESET_PASSWORD_PURPOSE,
      pwf: passwordFingerprint(user.password_hash),
    },
    JWT_SECRET,
    { expiresIn: RESET_TOKEN_EXPIRES_IN }
  );
}

/**
 * Verifies `token` against `currentPasswordHash` (the user's password_hash
 * as it stands right now, looked up fresh from the DB by the caller —
 * NOT decoded from the token). Returns { valid: true, user_id } on
 * success, or { valid: false, reason } on any failure. `reason` is for
 * logging only ('malformed', 'expired', 'wrong_purpose', 'already_used')
 * — callers must never echo it verbatim back to an API response, since
 * distinguishing "expired" from "already used" from "tampered" to an
 * outside caller would leak information about account state.
 */
function verifyResetToken(token, currentPasswordHash) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'malformed' };
  }

  if (!decoded || decoded.purpose !== RESET_PASSWORD_PURPOSE || !decoded.user_id) {
    return { valid: false, reason: 'wrong_purpose' };
  }

  const expectedFingerprint = passwordFingerprint(currentPasswordHash);
  if (decoded.pwf !== expectedFingerprint) {
    // The password on file has changed since this token was minted —
    // either this exact token already succeeded once, or the password was
    // changed some other way (e.g. change-password) in the meantime.
    // Either way, this token no longer represents a valid reset request.
    return { valid: false, reason: 'already_used' };
  }

  return { valid: true, user_id: decoded.user_id };
}

module.exports = {
  createResetToken,
  verifyResetToken,
  // Exported for tests only — not part of the module's real API surface.
  __passwordFingerprint: passwordFingerprint,
};
