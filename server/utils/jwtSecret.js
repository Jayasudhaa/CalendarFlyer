/**
 * server/utils/jwtSecret.js
 * Single source of truth for the JWT signing secret. Every route that signs
 * or verifies a token (auth.js, routes/organizations.js's /me fallback,
 * etc.) must import JWT_SECRET from here rather than reading
 * process.env.JWT_SECRET with its own inline fallback — those had drifted
 * into different literal strings in different files, which only worked by
 * accident because JWT_SECRET has always been set in .env. If it were ever
 * unset in production, one route's tokens would silently fail verification
 * against another's fallback instead of failing loudly at startup.
 */
const DEV_FALLBACK = 'dev-only-insecure-jwt-secret-set-JWT_SECRET-in-env';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Fail loudly rather than silently signing production tokens with a
    // secret anyone can read in this file.
    throw new Error('JWT_SECRET is not set. Set it in the server .env before starting in production.');
  }
  console.warn('[AUTH] JWT_SECRET not set — using an insecure development-only fallback. Set JWT_SECRET in .env before deploying.');
}

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK;

module.exports = { JWT_SECRET };
