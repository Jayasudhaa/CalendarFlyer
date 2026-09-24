/**
 * server/migrate-geocode-orgs.js — one-time backfill: geocode every existing
 * org's address so "orgs near me" (routes/discover.js) can find them.
 *
 * Only new/edited addresses get geocoded automatically going forward (see
 * routes/organizations.js's PUT /settings) -- orgs that set their address
 * before that hook existed have no latitude/longitude yet. This script
 * finds those, geocodes them via Google Maps, and saves the coordinates.
 * Safe to re-run: it skips any org that already has both fields set.
 *
 * Requires GOOGLE_MAPS_API_KEY in server/.env (a billed Google Cloud key --
 * see server/utils/geo.js). Without it, every geocode attempt is skipped
 * and logged, nothing crashes.
 *
 * Run once from server/: node migrate-geocode-orgs.js
 */
require('dotenv').config();
const { listOrganizations, updateOrganization } = require('./organizations');
const { geocodeAddress, GOOGLE_MAPS_API_KEY } = require('./utils/geo');

async function main() {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is not set in server/.env -- add it, then re-run this script.');
    process.exit(1);
  }

  const orgs = await listOrganizations();
  const needsGeocode = orgs.filter((org) => {
    const hasCoords = typeof org.latitude === 'number' && typeof org.longitude === 'number';
    const hasSomethingToGeocode = (org.zip_code && org.zip_code.trim()) || (org.address && org.address.trim());
    return !hasCoords && hasSomethingToGeocode;
  });

  console.log(`${orgs.length} organizations total, ${needsGeocode.length} need geocoding.`);

  let succeeded = 0;
  let failed = 0;

  for (const org of needsGeocode) {
    // ZIP is preferred over the full address -- see routes/organizations.js's
    // PUT /settings for why (simpler to geocode reliably, less precise
    // than a full street address, which a 15-mile radius doesn't need).
    const input = (org.zip_code && org.zip_code.trim()) || org.address;
    process.stdout.write(`Geocoding "${org.name}" (${input})... `);
    const geo = await geocodeAddress(input);
    if (geo) {
      await updateOrganization(org.org_id, { latitude: geo.latitude, longitude: geo.longitude });
      console.log(`OK (${geo.latitude}, ${geo.longitude})`);
      succeeded++;
    } else {
      console.log('FAILED -- left ungeocoded, will not appear in "near me" until its address is re-saved or this script re-run.');
      failed++;
    }
    // Google's Geocoding API allows ~50 requests/sec, but there's no rush
    // here and this is a one-off script -- a small pause is politer than a
    // burst, and keeps us well clear of any per-second quota either way.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. ${succeeded} geocoded, ${failed} failed, ${orgs.length - needsGeocode.length} already had coordinates.`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
