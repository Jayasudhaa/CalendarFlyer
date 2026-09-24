/**
 * server/routes/events.js
 * Events API — uses existing calendarfly_events DynamoDB table
 *
 * Table schema:
 *   PK: event_id (String)
 *   GSI: org-index → org_id (String)
 *
 * Routes:
 *   GET    /api/events              — list events for this org (or public via subdomain)
 *   POST   /api/events              — create event (admin), enforces events_per_month limit
 *   PUT    /api/events/:event_id    — update event (admin)
 *   DELETE /api/events/:event_id    — delete event (admin), frees up one month's quota
 */

const express = require('express');
const router  = express.Router();
const { createEvent, getEventsByOrg, updateEvent, deleteEvent } = require('../events');
const { getOrganization, checkLimit, incrementUsage, decrementUsage } = require('../organizations');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');

// Resolves org_id for this request: prefer a logged-in user's org (JWT),
// fall back to the subdomain-resolved org (req.org, for public visitors).
// This lets the admin dashboard work on the bare domain while logged in,
// and public calendar pages work off the visited subdomain with no login.
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

router.get('/', optionalAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) {
      return res.status(404).json({ error: 'No organization found for this request' });
    }
    const events = await getEventsByOrg(org_id);
    res.json({ events });
  } catch (error) {
    console.error('[EVENTS] List error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!req.body.title || !req.body.date) {
      return res.status(400).json({ error: 'title and date are required' });
    }

    // Enforce the plan's events_per_month cap (checkLimit reads
    // org.limits/org.usage, both always current per-plan values --
    // see organizations.js's applyFeatureOverrides). Skipped only if the
    // org somehow didn't resolve, same as the rest of this route.
    const org = await getOrganization(org_id);
    if (org && !checkLimit(org, 'events', req.user && req.user.email)) {
      return res.status(403).json({
        error: `You've reached your plan's ${org.limits.events_per_month}-event monthly limit. Upgrade your plan to create more events.`,
      });
    }

    const event = await createEvent(org_id, req.body);

    // Don't count a de-duped event (createEvent found an identical one and
    // returned it unchanged) against the monthly limit -- nothing new was
    // actually created.
    if (org && !event.duplicate) {
      await incrementUsage(org_id, 'events').catch(err =>
        console.error('[EVENTS] Failed to increment usage:', err)
      );
    }

    res.json({ success: true, event, duplicate: !!event.duplicate });
  } catch (error) {
    console.error('[EVENTS] Create error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:event_id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    // Unlike POST, updateEvent() will happily SET title/date to an empty
    // string if asked (it only skips keys that are `undefined`, not empty
    // ones) — an edit that clears either field used to save silently and
    // then vanish from the calendar grid (nothing matches on title/date),
    // with no error shown to the admin. Only reject when the field is
    // actually being touched, so a partial update that leaves title/date
    // alone still works.
    if (req.body.title !== undefined && !String(req.body.title).trim()) {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    if (req.body.date !== undefined && !String(req.body.date).trim()) {
      return res.status(400).json({ error: 'date cannot be empty' });
    }

    const updated = await updateEvent(req.params.event_id, req.user.org_id, req.body);
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, event: updated });
  } catch (error) {
    console.error('[EVENTS] Update error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:event_id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ok = await deleteEvent(req.params.event_id, req.user.org_id);
    if (!ok) return res.status(404).json({ error: 'Event not found' });

    // Free up one month's quota -- a deleted event shouldn't keep counting
    // against events_per_month for the rest of the month (see
    // organizations.js's decrementUsage).
    await decrementUsage(req.user.org_id, 'events').catch(err =>
      console.error('[EVENTS] Failed to decrement usage:', err)
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[EVENTS] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
