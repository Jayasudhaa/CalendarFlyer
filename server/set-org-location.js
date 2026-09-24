/**
 * server/set-org-location.js — quick manual/one-off way to set (or
 * geocode) a single org's latitude/longitude, without needing
 * GOOGLE_MAPS_API_KEY configured yet. Useful for testing "orgs near me"
 * (routes/discover.js) before the real Google Maps key is set up --
 * migrate-geocode-orgs.js is the real bulk backfill once that key exists.
 *
 * Usage (run from server/):
 *   node set-org-location.js --subdomain=tnjayasudhaa
 *     -> geocodes the org's stored address via OpenStreetMap Nominatim
 *        (free, no key needed -- fine for occasional manual use, but NOT
 *        what production geocoding uses; that's Google Maps, see
 *        utils/geo.js and migrate-geocode-orgs.js)
 *   node set-org-location.js --subdomain=tnjayasudhaa --lat=37.7 --lng=-121.9
 *     -> sets exact coordinates directly, skipping geocoding entirely
 *        (use this if the org has no address on file yet, or Nominatim
 *        can't find it)
 */
require('dotenv').config();
const { getOrganizationBySubdomain, updateOrganization } = require('./organizations');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value;
  }
  return args;
}

async function geocodeViaNominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  // Nominatim's usage policy requires an identifying User-Agent for
  // occasional/manual use like this -- it is NOT meant for production
  // volume, which is exactly why utils/geo.js uses Google Maps instead.
  const resp = await fetch(url, { headers: { 'User-Agent': 'CalendarFly-dev-tool (one-off manual geocode)' } });
  const data = await resp.json();
  if (!data || !data[0]) return null;
  return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
}

async function main() {
  const { subdomain, lat, lng } = parseArgs();
  if (!subdomain) {
    console.error('Usage: node set-org-location.js --subdomain=<subdomain> [--lat=<lat> --lng=<lng>]');
    process.exit(1);
  }

  const org = await getOrganizationBySubdomain(subdomain);
  if (!org) {
    console.error(`No organization found with subdomain "${subdomain}".`);
    process.exit(1);
  }

  let latitude, longitude;
  if (lat !== undefined && lng !== undefined) {
    latitude = parseFloat(lat);
    longitude = parseFloat(lng);
  } else {
    // ZIP is preferred over the full address -- see routes/organizations.js's
    // PUT /settings for why.
    const input = (org.zip_code && org.zip_code.trim()) || org.address;
    if (!input || !input.trim()) {
      console.error(`"${org.name}" has no ZIP or address on file -- pass --lat/--lng directly instead, e.g.:\n  node set-org-location.js --subdomain=${subdomain} --lat=37.7 --lng=-121.9`);
      process.exit(1);
    }
    console.log(`Geocoding "${input}" via OpenStreetMap...`);
    const geo = await geocodeViaNominatim(input);
    if (!geo) {
      console.error(`Could not geocode "${input}". Try passing --lat/--lng directly.`);
      process.exit(1);
    }
    ({ latitude, longitude } = geo);
  }

  await updateOrganization(org.org_id, { latitude, longitude });
  console.log(`Done -- "${org.name}" (${subdomain}) is now at (${latitude}, ${longitude}).`);
  console.log('Reload /explore and allow location access (or type a nearby city/ZIP) to see it under "Recommended near you".');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
