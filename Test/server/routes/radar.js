/**
 * server/routes/radar.js
 * Community Radar — the cross-org "discoverable events" feed.
 *
 * One route: GET /api/radar. Public, no auth (same trust level as any
 * org's own public calendar) — this is meant to be found, that's the point.
 *
 * Deliberately dumb ranking for phase 1: soonest-first, optionally filtered
 * by org category. No geo/interest scoring yet -- that needs data
 * (org lat/lng, a follow graph) this app doesn't collect yet. Wiring that in
 * is a follow-up once there's real usage to rank on, not a blocker to
 * shipping the one thing that actually matters first: one event, one
 * Discoverability setting, no separate submission pipeline.
 *
 * Every event returned already passed two independent gates before it can
 * appear here:
 *   1. events.js#getRadarEvents only reads discoverability = 'radar' rows
 *      via radar-index -- an event stays 'org_only' (the default) unless an
 *      admin explicitly opts it in.
 *   2. Below, past events and events whose organization no longer resolves
 *      are dropped. A deleted/unresolvable org fails CLOSED (excluded), not
 *      open -- same reasoning as the photos.js privacy fix earlier: an
 *      unresolvable parent should never make something more visible than an
 *      resolvable one would.
 */

const express = require('express');
const router = express.Router();
const { getRadarEvents } = require('../events');
const { getOrganization } = require('../organizations');

function todayIso() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', matches events.js's date format
}

router.get('/', async (req, res) => {
  try {
    const requestedLimit = req.query.limit === undefined ? 60 : Number(req.query.limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return res.status(400).json({ error: 'Limit must be a positive whole number.' });
    }
    const limit = Math.min(requestedLimit, 200);
    const categoryFilter = req.query.category ? String(req.query.category).toLowerCase() : null;

    const events = await getRadarEvents(todayIso(), { limit });

    // One getOrganization call per distinct org, not per event -- a
    // popular org with many radar events shouldn't mean redundant lookups.
    const orgCache = new Map();
    async function loadOrg(org_id) {
      if (!orgCache.has(org_id)) {
        orgCache.set(org_id, await getOrganization(org_id).catch(() => null));
      }
      return orgCache.get(org_id);
    }

    const enriched = [];
    for (const event of events) {
      const org = await loadOrg(event.org_id);
      if (!org) continue; // org deleted/unresolvable — fail closed, see header comment

      if (categoryFilter && (org.category || '').toLowerCase() !== categoryFilter) continue;

      enriched.push({
        event_id: event.event_id,
        title: event.title,
        description: event.description || '',
        date: event.date,
        time: event.time || null,
        type: event.type || null,
        image_url: event.image_url || null,
        location: event.location || null,
        org: {
          org_id: org.org_id,
          name: org.name,
          subdomain: org.subdomain,
          category: org.category || null,
          address: org.address || '',
          logo_url: org.logo_url || null,
          primary_color: org.primary_color || '#ea580c',
        },
      });
    }

    res.json({ events: enriched, as_of: todayIso() });
  } catch (err) {
    console.error('[RADAR] Failed to load feed:', err);
    res.status(500).json({ error: 'Could not load Community Radar right now.' });
  }
});

module.exports = router;
