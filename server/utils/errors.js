/**
 * server/utils/errors.js
 * Shared helper for sending a caught error back to the client.
 *
 * Before this fix, ~40 route handlers across the codebase did
 * `res.status(500).json({ error: err.message })` (or a close variant)
 * directly inside their own try/catch — leaking raw internal error text
 * (including AWS SDK error strings, stack-adjacent detail, etc.) to
 * whoever called the API, in every environment including production.
 *
 * sendServerError() centralizes the same production-vs-dev gating that
 * utils/jwtSecret.js and the global error handler in server.js use:
 * always log the full error server-side, but only echo err.message back
 * to the client when NODE_ENV !== 'production'. In production the client
 * gets a generic message instead.
 */
function sendServerError(res, err, fallbackMessage = 'Something went wrong', status = 500) {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd ? fallbackMessage : ((err && err.message) || fallbackMessage);
  return res.status(status).json({ error: message });
}

module.exports = { sendServerError };
