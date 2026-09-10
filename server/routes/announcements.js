/**
 * server/routes/announcements.js
 * Small admin-authored announcements shown on the public calendar's
 * "Announcements" panel (temple-calendar/src/PublicCalendar.jsx →
 * NewsFeedPanel). Mirrors the "reference photos" convention in
 * flyerRoutes.js: a small capped array of records stored directly on the
 * organization's DynamoDB record via getOrganization()/updateOrganization()
 * — no dedicated table needed at this scale.
 *
 * Mounted at /api/announcements (a dedicated top-level mount, not nested
 * under /api/organizations) because the public frontend calls the bare
 * path '/api/announcements'.
 *
 *   GET    /api/announcements      — PUBLIC. Never errors out to visitors.
 *   POST   /api/announcements      — admin-only. { message }
 *   DELETE /api/announcements/:id  — admin-only.
 */

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getOrganization, updateOrganization } = require('../organizations');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { sendServerError } = require('../utils/errors');

const MAX_ANNOUNCEMENTS  = 20;
const MAX_MESSAGE_LENGTH = 500;

// Same convention as routes/events.js: prefer a logged-in user's org (JWT),
// fall back to the subdomain/?org=-resolved org (req.org, for public
// visitors) — see tenantMiddleware in server.js for how req.org gets set.
function resolveOrgId(req) {
  if (req.user && req.user.org_id) return req.user.org_id;
  if (req.org && req.org.org_id) return req.org.org_id;
  return null;
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  authenticateToken(req, res, (err) => next()); // ignore auth errors, just proceed without req.user
}

// Appends `entry` to `existing` and caps the result at `max` most-recent
// entries — pure so the cap-at-20 behavior can be unit-tested directly
// without touching DynamoDB (same rationale as signups.js's
// earlyAccessUntil/isLockedForViewer exports).
function appendAnnouncement(existing, entry, max = MAX_ANNOUNCEMENTS) {
  return [...(Array.isArray(existing) ? existing : []), entry].slice(-max);
}

router.get('/', optionalAuth, async (req, res) => {
  // Public read for anonymous visitors — never leak org-resolution failures
  // to them, just show an empty list.
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.json({ announcements: [] });

    const org = await getOrganization(org_id);
    const list = (org && org.announcements) || [];
    // Most-recent-first for display; map in `body`/`date` aliases so the
    // existing NewsFeedPanel (which renders a.title||a.subject + a.body +
    // a.date) shows the message text instead of blank cards.
    const announcements = [...list].reverse().map(a => ({
      ...a,
      body: a.message,
      date: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : undefined,
    }));
    return res.json({ announcements });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] List error:', err);
    // Still never error out to a public visitor.
    return res.json({ announcements: [] });
  }
});

router.post('/', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'No organization found for this account' });

    const message = String((req.body && req.body.message) || '').trim();
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }

    const org = await getOrganization(org_id);
    const announcement = { id: uuidv4(), message, created_at: Date.now() };
    const announcements = appendAnnouncement((org && org.announcements) || [], announcement);
    await updateOrganization(org_id, { announcements });

    console.log(`[ANNOUNCEMENTS] Created for org: ${org_id}`);
    return res.json({ announcement, announcements: [...announcements].reverse() });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Create error:', err);
    return sendServerError(res, err);
  }
});

router.delete('/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'No organization found for this account' });

    const org = await getOrganization(org_id);
    const existing = (org && org.announcements) || [];
    const announcements = existing.filter(a => a.id !== req.params.id);
    await updateOrganization(org_id, { announcements });

    console.log(`[ANNOUNCEMENTS] Deleted ${req.params.id} for org: ${org_id}`);
    return res.json({ deleted: req.params.id, announcements: [...announcements].reverse() });
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Delete error:', err);
    return sendServerError(res, err);
  }
});

module.exports = router;
module.exports.appendAnnouncement = appendAnnouncement;
