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
 *   1. distance -- must be within `radius` miles (default 15, capped 60).
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
const { searchGooglePlacesOrgs } = require('../utils/googlePlaces');
const { getDirectoryOrgs } = require('../utils/directorySources');

// Weak proxy from an org's own category to the interest tags (see
// identity-auth.js's INTEREST_OPTIONS) it's closest to -- see header above.
const CATEGORY_TO_INTERESTS = {
  temple: ['spiritual'],
  gurudwara: ['spiritual'],
  mosque: ['spiritual'],
  church: ['spiritual'],
  cultural_association: ['arts-culture', 'language'],
  community_center: ['kids-family', 'arts-culture'],
  dance_school: ['dance', 'arts-culture'],
  music_school: ['music', 'arts-culture'],
  yoga_school: ['yoga'],
  restaurant: ['food'],
  grocery: ['food'],
  telugu_association: ['language', 'arts-culture'],
  kannada_koota: ['language', 'arts-culture'],
  tamil_sangam: ['language', 'arts-culture'],
  malayalee_association: ['language', 'arts-culture'],
  bengali_association: ['language', 'arts-culture'],
  odisha_association: ['language', 'arts-culture'],
  hindi_association: ['language', 'arts-culture'],
  gujarati_association: ['language', 'arts-culture'],
  marathi_association: ['language', 'arts-culture'],
  punjabi_association: ['language', 'arts-culture'],
  pan_india_association: ['arts-culture'],
  mela_fair_organizer: ['arts-culture', 'kids-family'],
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
    const radius = Math.min(requestedRadius, 60);
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
            // location/description added so the "Happening near you" card
            // on the Explore page (which reuses this same upcoming_events
            // data -- see PublicRadarPage.jsx) can show the venue and
            // build a real "Add to calendar" link, same as /api/radar's
            // events already do.
            location: e.location || null, description: e.description || '',
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
        cuisine_tags: org.cuisine_tags || [],
        primary_color: org.primary_color || '#ea580c',
        distance_miles: Math.round(miles * 10) / 10,
        interest_match: matchCount,
        upcoming_events: events,
      };
    }));

    // Real, unclaimed places from Google fill the gap while few orgs have
    // actually signed up yet (see utils/googlePlaces.js) -- skip a Google
    // result that's essentially the same physical place as a real org
    // already above (same building/block) so nothing shows up twice.
    let combined = enriched;
    try {
      const googlePlaces = await searchGooglePlacesOrgs(lat, lng, radius);
      const isDuplicateOfRealOrg = (place) => withDistance.some(({ org }) =>
        distanceMiles(place.latitude, place.longitude, org.latitude, org.longitude) < 0.1);

      const googleEnriched = googlePlaces
        .filter((place) => !isDuplicateOfRealOrg(place))
        .map((place) => {
          const miles = distanceMiles(lat, lng, place.latitude, place.longitude);
          const orgInterests = CATEGORY_TO_INTERESTS[place.category] || [];
          const matchCount = interests.length
            ? orgInterests.filter((t) => interests.includes(t)).length
            : 0;
          return {
            org_id: `google:${place.place_id}`,
            name: place.name,
            subdomain: null,
            category: place.category,
            logo_url: place.logo_url || null,
            cuisine_tags: place.cuisine_tags || [],
            primary_color: '#ea580c',
            distance_miles: Math.round(miles * 10) / 10,
            interest_match: matchCount,
            upcoming_events: [],
            // No CalendarFly calendar page exists for a place that hasn't
            // signed up -- the card links here instead of /calendar so it
            // doesn't 404 (see PublicRadarPage.jsx's NearbyOrgs).
            maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          };
        })
        .filter(({ distance_miles }) => distance_miles <= radius);

      combined = [...enriched, ...googleEnriched];
    } catch (err) {
      console.error('[DISCOVER] Google org backfill failed, showing signed-up orgs only:', err.message);
    }

    // Real events from orgs that haven't signed up for CalendarFly but do
    // publish verifiable events on their own site or a linked ticketing
    // platform (see utils/directorySources.js and ROADMAP.md's "Events
    // strategy" section). Modeled the same way as the Google backfill
    // above -- synthesized, unclaimed, never written to the real orgs
    // table -- so it gets the same "no Follow button, opens the real
    // source instead of /calendar" treatment on the frontend.
    try {
      const directoryOrgs = await getDirectoryOrgs(lat, lng, radius);
      // Dedupe against real, signed-up orgs only (withDistance still has
      // their coordinates in scope here) -- if one of these directory
      // sources ever signs up for real, its own listing should win rather
      // than showing both. Google Places results are out of scope by this
      // point, but a park/community-center venue essentially never
      // collides with a Google business listing in practice.
      const directoryEnriched = directoryOrgs
        .filter((place) => !withDistance.some(({ org }) =>
          distanceMiles(place.latitude, place.longitude, org.latitude, org.longitude) < 0.1))
        .map((place) => {
          const orgInterests = CATEGORY_TO_INTERESTS[place.category] || [];
          const matchCount = interests.length
            ? orgInterests.filter((t) => interests.includes(t)).length
            : 0;
          return { ...place, interest_match: matchCount };
        });
      combined = [...combined, ...directoryEnriched];
    } catch (err) {
      console.error('[DISCOVER] Directory event sources failed, showing everything else:', err.message);
    }

    // A flat top-20 across everything let one dense category (e.g. dance
    // schools in a dance-heavy suburb) crowd out every other category --
    // temples, yoga studios, language associations, etc. could all get
    // shut out even though real matches existed nearby. Grouping by
    // category and keeping only each one's 5 closest matches guarantees
    // every category that has anything nearby gets a fair showing.
    const byCategory = new Map();
    for (const o of combined) {
      const key = o.category || 'other';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(o);
    }
    let capped = [];
    for (const list of byCategory.values()) {
      // An org with real, known upcoming events (a signed-up org that's
      // actually posted something, or a verified directory/event-source
      // match -- see utils/directorySources.js) is worth showing ahead of
      // an eventless Google Places placeholder (upcoming_events always
      // []) even if the placeholder happens to be a bit closer -- "what's
      // happening near you" is the point, not just "what exists near you".
      // Distance still breaks ties within each group.
      list.sort((a, b) => {
        const aHas = (a.upcoming_events || []).length > 0;
        const bHas = (b.upcoming_events || []).length > 0;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.distance_miles - b.distance_miles;
      });
      capped = capped.concat(list.slice(0, 5));
    }
    capped.sort((a, b) => {
      if (b.interest_match !== a.interest_match) return b.interest_match - a.interest_match;
      return a.distance_miles - b.distance_miles;
    });

    res.json({ orgs: capped, as_of: today, origin: { lat, lng } });
  } catch (err) {
    console.error('[DISCOVER] Failed to load nearby orgs:', err);
    res.status(500).json({ error: 'Could not load nearby organizations right now.' });
  }
});

module.exports = router;
