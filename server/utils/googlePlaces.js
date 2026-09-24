/**
 * server/utils/googlePlaces.js — best-effort backfill of real, unclaimed
 * organizations (temples, restaurants, cultural associations, etc.) from
 * Google Places (New) Text Search, for the Explore page's "Organizations
 * near you" (see routes/discover.js). Added because early on this platform
 * has very few orgs signed up -- rather than that section showing almost
 * nothing, real places Google already knows about (which anyone could
 * search for themselves anyway) fill the gap until real orgs join.
 *
 * Deliberately NOT used for "Happening near you" -- Google doesn't expose
 * a public events index to third parties (no "Google Events API"), and
 * Eventbrite's public search API is deprecated / Meetup's requires manual
 * approval, so events stay real-data-only rather than mixing in anything
 * fabricated or scraped.
 *
 * Uses the same GOOGLE_MAPS_API_KEY as geo.js's geocoding -- requires
 * "Places API (New)" to be enabled on that same Google Cloud project.
 * If the key is missing, that API isn't enabled, or a request errors or
 * times out, this fails closed (returns []) -- same "never block the
 * page, just show fewer results" pattern as geocodeAddress().
 *
 * Field mask note: this now requests `websiteUri` (upgrades the Text
 * Search call from the "Pro" SKU to the pricier "Enterprise" SKU -- an
 * explicit, approved cost tradeoff so unclaimed Places orgs can show a
 * real picture, pulled from that website via utils/orgImages.js, same as
 * directory-sourced orgs) plus `primaryType`/`types` (still Basic-tier
 * fields, no added cost) so restaurants can be cuisine-tagged. Deliberately
 * NOT requesting `photos` -- that's the even pricier "Enterprise +
 * Atmosphere" SKU and would need a server-side photo-media proxy to avoid
 * putting this API key in a browser-visible <img> URL; revisit if
 * website-pulled images turn out too thin.
 */

const { getWebsiteImage } = require('./orgImages');
const { cuisineFromPlaceType } = require('./cuisineTags');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_TIMEOUT_MS = 8000;

// One text query per app category that maps to a physical kind of place
// Google can actually find (see utils/organizationCategories.js for the
// full taxonomy). Categories with no real "venue" to search for --
// mela/fair organizers, and the generic community/nonprofit/other
// buckets -- are skipped on purpose: a text search for "nonprofit near
// me" returns noise, not signal.
const CATEGORY_QUERIES = {
  temple: 'Hindu temple',
  dance_school: 'Indian dance school',
  music_school: 'Indian music school',
  yoga_school: 'yoga studio',
  restaurant: 'Indian restaurant',
  grocery: 'Indian grocery store',
  telugu_association: 'Telugu association',
  kannada_koota: 'Kannada Koota',
  tamil_sangam: 'Tamil Sangam',
  malayalee_association: 'Malayalee association',
  bengali_association: 'Bengali association',
  odisha_association: 'Odia association',
  hindi_association: 'Hindi speaking association',
  gujarati_association: 'Gujarati Samaj',
  marathi_association: 'Marathi Mandal',
  punjabi_association: 'Punjabi cultural association',
  pan_india_association: 'Indian cultural association',
};

// In-memory cache so repeat visits/searches from the same neighborhood
// don't re-bill Google every time -- keyed by rounded lat/lng (~1.1km
// buckets) + radius. Good enough for this app's current single-instance
// scale; a multi-instance production deploy would want a shared cache
// (DynamoDB/Redis) instead, but this already cuts real-world call volume
// by orders of magnitude versus none at all.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const cache = new Map();

function cacheKey(lat, lng, radius) {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
}

async function searchOneCategory(category, query, lat, lng, radiusMiles) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        // Enterprise-tier field mask -- websiteUri is what lets us pull a
        // real image for these orgs (see header comment); primaryType/
        // types are free Basic-tier fields, added here for cuisine
        // tagging. Still no `photos`/ratings (Enterprise + Atmosphere).
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.websiteUri,places.primaryType,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(radiusMiles * 1609.34, 50000), // meters; Google caps at 50km
          },
        },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.warn(`[PLACES] "${query}" failed: ${resp.status} ${(data && data.error && data.error.message) || ''}`);
      return [];
    }
    return (data.places || [])
      .map((p) => ({
        place_id: p.id,
        name: (p.displayName && p.displayName.text) || query,
        category,
        latitude: p.location && p.location.latitude,
        longitude: p.location && p.location.longitude,
        website: p.websiteUri || null,
        cuisine_tags: category === 'restaurant' ? cuisineFromPlaceType(p.primaryType, p.types) : [],
      }))
      .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number');
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[PLACES] "${query}" timed out after ${PLACES_TIMEOUT_MS}ms`);
    } else {
      console.error(`[PLACES] "${query}" request failed:`, err.message);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Returns real, unclaimed places from Google near (lat, lng), one best-
 * effort result set per category in CATEGORY_QUERIES, deduped by place id.
 * Never throws -- a missing key, a disabled API, or a bad request just
 * means an empty backfill, not a broken page.
 */
async function searchGooglePlacesOrgs(lat, lng, radiusMiles) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[PLACES] GOOGLE_MAPS_API_KEY not set -- skipping Google org backfill');
    return [];
  }

  const key = cacheKey(lat, lng, radiusMiles);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.results;
  }

  let results = [];
  try {
    const batches = await Promise.all(
      Object.entries(CATEGORY_QUERIES).map(([category, query]) =>
        searchOneCategory(category, query, lat, lng, radiusMiles))
    );
    const seen = new Set();
    for (const batch of batches) {
      for (const place of batch) {
        if (seen.has(place.place_id)) continue;
        seen.add(place.place_id);
        results.push(place);
      }
    }
    // Resolve each place's own website into a real logo image (see
    // utils/orgImages.js) once per 12h cache window rather than per
    // request -- results get cached below same as everything else here.
    results = await Promise.all(results.map(async (p) => ({
      ...p,
      logo_url: await getWebsiteImage(p.website),
    })));
  } catch (err) {
    console.error('[PLACES] Google org backfill failed:', err.message);
    results = [];
  }

  cache.set(key, { at: Date.now(), results });
  return results;
}

module.exports = { searchGooglePlacesOrgs };
