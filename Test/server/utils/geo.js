/**
 * server/utils/geo.js — geocoding + distance math for the "orgs near me"
 * Community Radar / Explore recommendation (Phase 1.5 of the personalization
 * plan; Phase 1 was the Community Passport identity in identity-auth.js).
 *
 * Nothing in this app tracked org coordinates before this -- organizations.js
 * only ever stored a free-text `address` string. Geocoding source is Google
 * Maps Geocoding API (chosen explicitly over other providers), which needs
 * a billed Google Cloud API key in GOOGLE_MAPS_API_KEY. Without that key set,
 * geocodeAddress() logs a warning and returns null rather than throwing --
 * an org simply won't get lat/lng and stays invisible to "near me" (fails
 * closed, same pattern as an unresolvable org in routes/radar.js) without
 * blocking the address save itself.
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Turn a free-text address into { latitude, longitude }, or null if it
 * can't be geocoded (no key configured, address too vague, API error, etc).
 * Never throws -- callers should treat this as best-effort.
 */
async function geocodeAddress(address) {
  const trimmed = (address || '').toString().trim();
  if (!trimmed) return null;

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[GEO] GOOGLE_MAPS_API_KEY not set -- skipping geocode for:', trimmed);
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${GOOGLE_MAPS_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== 'OK' || !data.results || !data.results[0]) {
      console.warn(`[GEO] Geocode failed for "${trimmed}": ${data.status}${data.error_message ? ' -- ' + data.error_message : ''}`);
      return null;
    }

    const loc = data.results[0].geometry.location;
    return { latitude: loc.lat, longitude: loc.lng };
  } catch (err) {
    console.error('[GEO] Geocode request failed:', err.message);
    return null;
  }
}

/**
 * Great-circle distance in miles between two lat/lng points (haversine).
 * DynamoDB has no native geo-query support, and this app's org count is
 * small enough that a scan + in-memory filter (see routes/discover.js) is
 * simpler and cheaper than standing up a geohash GSI for it.
 */
function distanceMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius, miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = { geocodeAddress, distanceMiles, GOOGLE_MAPS_API_KEY };
