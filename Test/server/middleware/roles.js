/**
 * server/middleware/roles.js
 * Per-organization role checks — Owner / Admin / Viewer. Layered on top of
 * authenticateToken (must run after it — needs req.user from the JWT).
 *
 * A user's stored `role` is normalized here so every legacy value still
 * resolves to one of the three current tiers, with no bulk data migration
 * needed:
 *   'owner'  -> owner    (see organizations.js's ensureOwnerAssigned() for
 *                         how existing orgs get one backfilled)
 *   'admin'  -> admin
 *   'viewer' -> viewer
 *   'guest'  -> viewer   (the tier this replaces — same "can look, can't
 *                         change anything sensitive" shape)
 *   anything else / missing -> viewer (fail closed, never fail open)
 */
function effectiveRole(user) {
  if (!user) return null;
  switch (user.role) {
    case 'owner':  return 'owner';
    case 'admin':  return 'admin';
    case 'viewer': return 'viewer';
    case 'guest':  return 'viewer';
    default:       return 'viewer';
  }
}

// requireRole('owner') / requireRole('owner', 'admin') — an allowlist of
// which effective roles may proceed. Anything not in the list is refused,
// including a role effectiveRole() couldn't resolve.
function requireRole(...allowed) {
  return (req, res, next) => {
    const role = effectiveRole(req.user);
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
        requiredRole: allowed,
      });
    }
    next();
  };
}

module.exports = { effectiveRole, requireRole };
