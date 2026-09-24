/**
 * server/utils/cuisineTags.js — the cuisine taxonomy used to filter
 * restaurant orgs by "food preference" on the Explore page.
 *
 * Two very different sources feed cuisine_tags, with very different
 * precision:
 *   - Real, signed-up restaurant orgs self-tag from CUISINE_TAGS in their
 *     org settings (see routes/organizations.js) -- as precise as the
 *     owner wants to be (can pick South Indian AND North Indian, etc).
 *   - Google-Places-backfilled restaurants (unclaimed, see
 *     utils/googlePlaces.js) get whatever cuisineFromPlaceType() can infer
 *     from Google's own `primaryType`/`types` fields -- Google has no
 *     regional Indian breakdown (no "south_indian_restaurant" type
 *     exists), so any Indian restaurant Google returns just gets
 *     'indian_other' until/unless it signs up and self-tags for real.
 *     This is an honest limitation, not a bug -- same "skip rather than
 *     guess" philosophy as the rest of this pipeline.
 */

const CUISINE_TAGS = [
  { key: 'south_indian', label: 'South Indian' },
  { key: 'north_indian', label: 'North Indian' },
  { key: 'gujarati', label: 'Gujarati' },
  { key: 'punjabi', label: 'Punjabi' },
  { key: 'bengali', label: 'Bengali' },
  { key: 'indian_other', label: 'Indian (other)' },
  { key: 'chinese', label: 'Chinese' },
  { key: 'italian', label: 'Italian' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'thai', label: 'Thai' },
  { key: 'mediterranean', label: 'Mediterranean / Middle Eastern' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'bakery_cafe', label: 'Bakery / Café' },
];

const CUISINE_KEYS = CUISINE_TAGS.map((t) => t.key);

// Google Places (New) primaryType/types -> our tag. Only restaurant-ish
// types are listed; anything else (or no match) yields no tag.
const PLACES_TYPE_TO_CUISINE = {
  indian_restaurant: 'indian_other',
  chinese_restaurant: 'chinese',
  italian_restaurant: 'italian',
  mexican_restaurant: 'mexican',
  thai_restaurant: 'thai',
  mediterranean_restaurant: 'mediterranean',
  middle_eastern_restaurant: 'mediterranean',
  vegetarian_restaurant: 'vegetarian',
  vegan_restaurant: 'vegan',
  bakery: 'bakery_cafe',
  cafe: 'bakery_cafe',
  coffee_shop: 'bakery_cafe',
};

/** Best-effort cuisine tag(s) from a Google Places result's own type data. */
function cuisineFromPlaceType(primaryType, types) {
  if (primaryType && PLACES_TYPE_TO_CUISINE[primaryType]) return [PLACES_TYPE_TO_CUISINE[primaryType]];
  if (Array.isArray(types)) {
    for (const t of types) {
      if (PLACES_TYPE_TO_CUISINE[t]) return [PLACES_TYPE_TO_CUISINE[t]];
    }
  }
  return [];
}

module.exports = { CUISINE_TAGS, CUISINE_KEYS, cuisineFromPlaceType };
