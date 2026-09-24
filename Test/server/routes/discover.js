/**
 * server/routes/discover.js — "Recommended near you" for the Community
 * Radar / Explore passport page (Phase 1.5 of the personalization plan --
 * see server/identity-auth.js's header for Phase 1, the identity itself).
 *
 * GET /api/discover/nearby?lat=&lng=&radius=15&interests=music,yoga
 *   or  ?address=<free text>&radius=15&interests=...  (geocoded server-side,
 *       so the Google Maps API key never has to reach the browser)
 *
 * Public, no auth -- same trust level as /api/radar. Ranks by:
 *   1. distance -- must be within `radius` miles (default 15, capped 50).
 *      Only orgs with a geocoded address (see routes/organizations.js's
 *      PUT /settings and migrate-geocode-orgs.js) can appear at all; an org
 *      that's never been geocoded is excluded, not treated as "anywhere".
 *   2. interest overlap -- orgs don't have their own tag list yet, so this
 *      uses org.category as a weak stand-in (CATEGORY_TO_INTERESTS below).
 *      Real per-org tagging is a natural follow-up once there's usage to
 *      justify it, not a blocker to shipping distance-based discovery,
 *      which is the part that actually needed new data this app never
 *      collected before (org coordinates).
 *
 * Each org carries its next few upcoming events so the passport page can
 * show "what's happening" without a per-org round trip.
 */
const express = require('express');
const router = express.Router();
const { listOrganizations } = require('../organizations');
const { getEventsByOrg } = require('../events');
const { geocodeAddress, distanceMiles } = require('../utils/geo');

// Weak proxy from an org's own category to the interest tags (see
// identity-auth.js's INTEREST_OPTIONS) it's closest to -- see header above.
const CATEGORY_TO_INTERESTS = {
  temple: ['spiritual'],
  gurudwara: ['spiritual'],
  mosque: ['spiritual'],
  church: ['spiritual'],
  cultural_association: ['arts-culture', 'language'],
  community_center: ['kids-family', 'arts-culture'],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10); // matches events.js's date format
}

router.get('/nearby', async (req, res) => {
  try {
    let lat = parseFloat(req.query.lat);
    let lng = parseFloat(req.query.lng);

    if ((Number.isNaN(lat) || Number.isNaN(lng)) && req.query.address) {
      const geo = await geocodeAddress(String(req.query.address));
      if (!geo) {
        return res.status(400).json({ error: "Couldn't find that location. Try a more specific city or ZIP." });
      }
      lat = geo.latitude;
      lng = geo.longitude;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'A location (lat/lng or address) is required.' });
    }

    const requestedRadius = req.query.radius === undefined ? 15 : Number(req.query.radius);
    if (!Number.isFinite(requestedRadius) || requestedRadius <= 0) {
      return res.status(400).json({ error: 'Radius must be a positive number of miles.' });
    }
    const radius = Math.min(requestedRadius, 50);
    const interests = String(req.query.interests || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const allOrgs = await listOrganizations();
    const today = todayIso();

    const withDistance = allOrgs
      .filter((org) => typeof org.latitude === 'number' && typeof org.longitude === 'number')
      .map((org) => ({ org, miles: distanceMiles(lat, lng, org.latitude, org.longitude) }))
      .filter(({ miles }) => miles <= radius);

    const enriched = await Promise.all(withDistance.map(async ({ org, miles }) => {
      const orgInterests = CATEGORY_TO_INTERESTS[org.category] || [];
      const matchCount = interests.length
        ? orgInterests.filter((t) => interests.includes(t)).length
        : 0;

      let events = [];
      try {
        const all = await getEventsByOrg(org.org_id);
        events = (all || [])
          .filter((e) => e.discoverability === 'radar' && e.type !== 'panchang' && e.date && e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
          .map((e) => ({
            event_id: e.event_id, title: e.title, date: e.date,
            time: e.time || null, image_url: e.image_url || null,
          }));
      } catch (err) {
        console.error(`[DISCOVER] Failed to load events for ${org.org_id}:`, err.message);
      }

      return {
        org_id: org.org_id,
        name: org.name,
        subdomain: org.subdomain,
        category: org.category || null,
        logo_url: org.logo_url || null,
        primary_color: org.primary_color || '#ea580c',
        distance_miles: Math.round(miles * 10) / 10,
        interest_match: matchCount,
        upcoming_events: events,
      };
    }));

    enriched.sort((a, b) => {
      if (b.interest_match !== a.interest_match) return b.interest_match - a.interest_match;
      return a.distance_miles - b.distance_miles;
    });

    res.json({ orgs: enriched.slice(0, 20), as_of: today, origin: { lat, lng } });
  } catch (err) {
    console.error('[DISCOVER] Failed to load nearby orgs:', err);
    res.status(500).json({ error: 'Could not load nearby organizations right now.' });
  }
});

module.exports = router;
