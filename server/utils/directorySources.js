/**
 * server/utils/directorySources.js -- real, curated event sources from
 * Jayasudhaa's uploaded Bay Area directory (CalendarFly_Bay_Area_Source_
 * Directory.xlsx), for orgs that haven't signed up for CalendarFly but do
 * publish real, verifiable events (confirmed via eventSourceParser.js's
 * JSON-LD/ICS/platform-link/Devotee-platform detection -- see ROADMAP.md's
 * "Events strategy" section).
 *
 * Modeled the same way googlePlaces.js models unclaimed Google-sourced
 * orgs: synthesized org-shaped entries merged into GET /api/discover/nearby,
 * never written to the real `organizations` table -- these orgs never
 * signed up and shouldn't be counted, billed, or shown as claimable.
 *
 * One entry per EVENT rather than per organization -- several of these
 * presenters (Basant Bahar, Sahaja Yoga) run events at a different venue
 * each time, so a single org-level pin would misrepresent where most of
 * their events actually are. Each entry is geocoded from that specific
 * event's own venue address, and an event with no discoverable venue
 * (e.g. an online-only Meetup) is skipped rather than shown at a guessed
 * or borrowed location.
 */
const { testEventSource } = require('./eventSourceParser');
const { geocodeAddress, distanceMiles } = require('./geo');
const { getWebsiteImage } = require('./orgImages');

const SOURCES = [
  {
    name: 'Shiva-Vishnu Temple / HCCC (Livermore)',
    category: 'temple',
    url: 'https://www.livermoretemple.org/',
    // Devotee-platform event cards (see eventSourceParser.js) don't carry
    // a per-event address -- but this is one physical temple building, so
    // a single fallback address is actually correct here (unlike the
    // multi-venue presenters below).
    fallbackAddress: 'Hindu Community and Cultural Center, Livermore, CA',
  },
  { name: 'Bay Area Indian Cultural Society (BICS)', category: 'pan_india_association', url: 'https://bicsca.org/events' },
  { name: 'Basant Bahar', category: 'music_school', url: 'https://indianclassical.net/org/basant-bahar' },
  { name: 'Sahaja Yoga Meditation California', category: 'yoga_school', url: 'https://meditationca.org/free-guided-meditation-pleasanton-ca/' },
];

// Re-running testEventSource() (which can launch a headless browser) on
// every /nearby request would be far too slow for user-facing traffic.
// ROADMAP.md's events strategy calls for a real 24h re-check scheduler
// eventually; this in-memory cache is the honest stand-in until that's
// built -- same fail-open, best-effort spirit as googlePlaces.js's cache.
const TEST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const testCache = new Map(); // url -> { at, result }

const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geocodeCache = new Map(); // address -> { at, coords }

const RESULT_CACHE_TTL_MS = 60 * 60 * 1000; // distance math is cheap; only scrape+geocode is expensive
let cachedResult = null; // { at, entries }

async function cachedTestEventSource(url) {
  const hit = testCache.get(url);
  if (hit && Date.now() - hit.at < TEST_CACHE_TTL_MS) return hit.result;
  const result = await testEventSource(url);
  testCache.set(url, { at: Date.now(), result });
  return result;
}

async function cachedGeocode(address) {
  if (!address) return null;
  const hit = geocodeCache.get(address);
  if (hit && Date.now() - hit.at < GEOCODE_CACHE_TTL_MS) return hit.coords;
  const coords = await geocodeAddress(address);
  if (coords) geocodeCache.set(address, { at: Date.now(), coords });
  return coords;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ---- Date/time extraction -----------------------------------------------

// Reads the LOCAL wall-clock time straight out of an ISO string (e.g.
// "2026-10-03T16:00:00-07:00") rather than through `new Date()`, which
// would reinterpret it in the server's own timezone and could shift the
// displayed time by hours.
function isoStartToDateTime(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
  if (!m) return { date: null, time: null };
  const [, date, hh, mm] = m;
  let hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return { date, time: `${hour}:${mm} ${ampm}` };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

// Best-effort extraction of a "Month Day, Year" (with optional ordinal
// suffix) from free-form event text like a temple site's own listing --
// e.g. "Saturday, September 26th, 2026, 9:30 AM to 1:00 PM" or "Every
// Sunday - 3.30 PM to 5 PM, starting September 13, 2026". Returns null
// rather than a guess when no clear date is found; an event with an
// unparseable date is skipped downstream, never shown with a wrong one.
function extractDateFromText(text) {
  if (!text) return null;
  const re = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i;
  const m = re.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractTimeFromText(text) {
  if (!text) return null;
  const m = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i.exec(text);
  return m ? m[1].toUpperCase().replace(/\s+/g, ' ') : null;
}

// ---- Normalizing a testEventSource() result into candidate events -------

function eventsFromJsonLd(result, today) {
  return (result.jsonldEvents || [])
    .map((ev) => {
      const { date, time } = isoStartToDateTime(ev.startDate);
      if (!date || date < today) return null;
      return {
        title: ev.title || 'Event',
        date,
        time,
        location: ev.location || null,
        geocodeAddress: ev.fullAddress || ev.location || null,
        source_url: ev.url || null,
        description: '',
      };
    })
    .filter(Boolean);
}

function eventsFromHtml(result, today) {
  return (result.htmlEvents || [])
    .map((ev) => {
      const date = extractDateFromText(ev.dateText);
      if (!date || date < today) return null;
      return {
        title: ev.title,
        date,
        time: extractTimeFromText(ev.dateText),
        location: null,
        geocodeAddress: null, // no per-event venue on this platform -- source.fallbackAddress covers it
        source_url: null,
        description: ev.dateText || '',
      };
    })
    .filter(Boolean);
}

// Max events shown per org card -- matches the real-org "upcoming_events"
// convention in discover.js (.slice(0, 3)).
const MAX_EVENTS_PER_ENTRY = 5;

async function buildDirectoryEntries() {
  const today = todayIso();
  // Grouped by (source, resolved venue) -- a single fixed-location org
  // (e.g. a temple with 30 upcoming events) should be ONE org card with
  // several events, exactly like a real signed-up org; a multi-venue
  // presenter whose events land at genuinely different coordinates should
  // still show as separate cards, one per real location. Grouping by the
  // geocoded lat/lng (rather than always 1-event-per-entry or always
  // 1-entry-per-source) gets both right without special-casing either.
  const groups = new Map(); // key -> { name, category, sourceUrl, latitude, longitude, events: [] }

  for (const source of SOURCES) {
    let testResult;
    try {
      testResult = await cachedTestEventSource(source.url);
    } catch (err) {
      console.error(`[DIRECTORY] testEventSource failed for ${source.name}:`, err.message);
      continue;
    }
    if (!testResult || !testResult.ok) continue;

    const events = [
      ...eventsFromJsonLd(testResult, today),
      ...eventsFromHtml(testResult, today),
    ].sort((a, b) => a.date.localeCompare(b.date));

    for (const ev of events) {
      const addressToGeocode = ev.geocodeAddress || source.fallbackAddress || null;
      if (!addressToGeocode) continue; // e.g. an online-only Meetup -- nothing to place "near you"
      const coords = await cachedGeocode(addressToGeocode);
      if (!coords) continue;

      const key = `${slugify(source.name)}|${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          name: source.name,
          category: source.category,
          sourceUrl: source.url,
          latitude: coords.latitude,
          longitude: coords.longitude,
          events: [],
        });
      }
      groups.get(key).events.push(ev);
    }
  }

  const entries = [];
  for (const [key, group] of groups.entries()) {
    const events = group.events
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, MAX_EVENTS_PER_ENTRY);
    // Pulled straight from the source's own website (og:image, or a
    // favicon as a last resort) -- see utils/orgImages.js. Cached there
    // per URL, so the handful of groups that share one source (a
    // multi-venue presenter like Basant Bahar) only trigger one real
    // fetch. Reused as the event banner image too -- these orgs don't
    // have a per-event photo, and a real logo beats the plain gradient.
    const logoUrl = await getWebsiteImage(group.sourceUrl);
    entries.push({
      org_id: `directory:${key.replace(/[^a-z0-9.,|-]/g, '')}`,
      name: group.name,
      subdomain: null,
      category: group.category,
      logo_url: logoUrl,
      primary_color: '#ea580c',
      latitude: group.latitude,
      longitude: group.longitude,
      upcoming_events: events.map((ev, i) => ({
        event_id: `directory-${key}-${i}`.replace(/[^a-z0-9.,|-]/g, ''),
        title: ev.title,
        date: ev.date,
        time: ev.time,
        image_url: logoUrl,
        location: ev.location,
        description: ev.description,
        source_url: ev.source_url || group.sourceUrl,
      })),
      // Card-level link target for the org tile itself (OrgCard has no
      // per-event context) -- the first/soonest event's own source, or
      // the org's own site.
      source_url: (events[0] && events[0].source_url) || group.sourceUrl,
    });
  }
  return entries;
}

async function getDirectoryOrgs(lat, lng, radius) {
  if (!cachedResult || Date.now() - cachedResult.at > RESULT_CACHE_TTL_MS) {
    const entries = await buildDirectoryEntries();
    cachedResult = { at: Date.now(), entries };
  }
  return cachedResult.entries
    .map((entry) => ({ entry, miles: distanceMiles(lat, lng, entry.latitude, entry.longitude) }))
    .filter(({ miles }) => miles <= radius)
    .map(({ entry, miles }) => ({ ...entry, distance_miles: Math.round(miles * 10) / 10 }));
}

module.exports = { getDirectoryOrgs };
