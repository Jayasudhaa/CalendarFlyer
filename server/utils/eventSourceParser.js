/**
 * server/utils/eventSourceParser.js — best-effort event discovery for an
 * organization's own website (see ROADMAP.md's "Events strategy" section).
 * Looks for the two structured-data signals a real event page usually
 * carries: JSON-LD Event markup (schema.org -- what most WordPress/
 * Squarespace/Wix event pages already embed for Google's own rich
 * results) and an ICS calendar export link. Deliberately no headless
 * browser and no HTML DOM library yet -- schema.org markup exists
 * specifically to be read by crawlers, so it's normally present in the
 * raw HTML a plain fetch returns, and a lightweight regex scan is enough
 * to find out whether this approach actually surfaces real events on
 * real org sites before investing in a full HTML parser dependency.
 *
 * Never throws -- a bad URL, a timeout, a site that blocks bots, or an
 * unparseable page all just mean "nothing found here", the same
 * fail-open pattern as geo.js and googlePlaces.js.
 */

const FETCH_TIMEOUT_MS = 10000;
// Below this raw-HTML size, a real page almost always means the site
// renders its actual content with JavaScript (React/Next.js, Wix, some
// Squarespace templates) -- a plain fetch never runs that JS, so it only
// ever sees the empty shell. That's a different problem than "no
// structured data" and is why a small page with nothing found triggers
// the headless-browser fallback below rather than just being reported as
// a dead end.
const LIKELY_JS_RENDERED_THRESHOLD = 5000;
const RENDER_TIMEOUT_MS = 20000;
let puppeteerModule = null;
function getPuppeteer() {
  if (!puppeteerModule) puppeteerModule = require('puppeteer');
  return puppeteerModule;
}

/**
 * Renders a page with a real (headless) browser and returns the resulting
 * HTML -- for sites whose event listings only appear after JavaScript
 * runs, which a plain fetch can never see. Slower and heavier than
 * fetchHtml() (a browser launch + real page load, ~seconds not
 * milliseconds), so it's only used as a fallback, never the first attempt.
 * Never throws -- if Chromium fails to launch or the page errors, this
 * returns null and the caller just reports "nothing found" as before.
 */
async function fetchRenderedHtml(url) {
  let browser = null;
  try {
    const puppeteer = getPuppeteer();
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; CalendarFlyBot/0.1; +https://calendarflyer.com)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: RENDER_TIMEOUT_MS });
    const html = await page.content();
    // Diagnostic only -- a short slice of the rendered page's visible text,
    // so a caller can tell "the page really is this bare" apart from
    // "something (cookie wall, bot block, slow widget) kept content from
    // loading" without that requiring a separate manual visit to the site.
    let textSample = null;
    try {
      textSample = await page.evaluate(() => document.body.innerText.trim().slice(0, 400));
    } catch {
      // ignore -- textSample stays null
    }
    // Some org sites are built on shared platforms whose event-card markup
    // is consistent even though the page has no JSON-LD. "Devotee" is one
    // such platform (seen on Livermore Temple, likely used by other
    // temples too) -- its React build gives each event card a class name
    // like `devotee_eventTitle__<hash>` and `devotee_nameDate__<hash>`.
    // The hash suffix changes per build/deploy, so we match on the
    // "contains" prefix rather than an exact class name. Read directly
    // from the live DOM (not the serialized HTML string) since that's far
    // more reliable than regexing React-rendered markup.
    let platformCardEvents = [];
    try {
      platformCardEvents = await page.evaluate(() => {
        const blocks = Array.from(document.querySelectorAll('[class*="nameDate__"]'));
        return blocks.map((block) => {
          const titleEl = block.querySelector('[class*="eventTitle__"]');
          const ps = Array.from(block.querySelectorAll('p'))
            .map((p) => p.textContent.trim())
            .filter(Boolean);
          const title = titleEl ? titleEl.textContent.trim() : (ps[0] || null);
          const dateText = ps.filter((t) => t !== title).join(' | ') || null;
          return { title, dateText };
        }).filter((e) => e.title);
      });
    } catch {
      platformCardEvents = [];
    }
    return { html, textSample, platformCardEvents };
  } catch (err) {
    console.error(`[EVENT-SOURCE] Headless render failed for ${url}:`, err.message);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** Runs the JSON-LD + ICS scan against a chunk of HTML, filling `result`. */
function scanHtmlForEvents(html, result) {
  const ldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRegex.exec(html))) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue; // malformed JSON-LD block -- skip it, keep scanning others
    }
    const found = [];
    findEventsInJsonLd(data, found);
    for (const ev of found) {
      // schema.org Event.location is often a Place object with its own
      // postalAddress -- keep that (not just the venue's display name) so
      // a caller can actually geocode where this is, rather than passing
      // an ambiguous bare name like "Community Center" to a geocoder.
      let locationName = null;
      let fullAddress = null;
      if (typeof ev.location === 'object' && ev.location) {
        locationName = ev.location.name || null;
        const addr = ev.location.address;
        if (typeof addr === 'string') {
          fullAddress = addr;
        } else if (addr && typeof addr === 'object') {
          fullAddress = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter(Boolean).join(', ') || null;
        }
      } else if (typeof ev.location === 'string') {
        locationName = ev.location;
      }
      result.jsonldEvents.push({
        title: ev.name || null,
        startDate: ev.startDate || null,
        endDate: ev.endDate || null,
        location: locationName,
        fullAddress: fullAddress || locationName,
        url: ev.url || null,
      });
    }
  }

  const icsRegex = /<(?:a|link)[^>]+href=["']([^"']+\.ics[^"']*)["']/gi;
  const seen = new Set();
  while ((m = icsRegex.exec(html))) {
    const href = m[1];
    if (!seen.has(href)) {
      seen.add(href);
      result.icsLinks.push(href);
    }
  }
}

// Small orgs very often don't mark up their OWN site, but they do sell
// tickets or list RSVPs through a platform that always does: Eventbrite's
// individual event pages carry proper schema.org Event JSON-LD (even
// though Eventbrite's location-search API was shut off in 2020 -- that's
// a different endpoint), and Meetup/Facebook Events pages usually do too.
// So rather than hand-writing a scraper for each org's own homepage
// (fragile, breaks on redesign), it's far more scalable to notice a link
// TO one of these platforms and test that page instead.
const KNOWN_PLATFORM_HOST_RE = /(^|\.)(eventbrite\.com|meetup\.com|facebook\.com)$/i;

function findKnownPlatformLinks(html, pageUrl) {
  const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  const found = new Set();
  let m;
  while ((m = hrefRegex.exec(html))) {
    let abs;
    try {
      abs = new URL(m[1], pageUrl);
    } catch {
      continue;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
    if (!KNOWN_PLATFORM_HOST_RE.test(abs.hostname)) continue;
    // A bare facebook.com/events index or a Meetup group's home page
    // (rather than one specific event) is too generic to be worth
    // following -- only chase links that look like one specific listing.
    if (/facebook\.com$/i.test(abs.hostname) && !/\/events\//i.test(abs.pathname)) continue;
    found.add(abs.toString());
  }
  return Array.from(found).slice(0, 3); // cap follow-through per source
}

const EVENT_TYPES = new Set([
  'Event', 'MusicEvent', 'TheaterEvent', 'Festival', 'DanceEvent',
  'EducationEvent', 'SocialEvent', 'ExhibitionEvent', 'SportsEvent',
  'ReligiousEvent', 'EventSeries', 'FoodEvent', 'ComedyEvent', 'BusinessEvent',
]);

function findEventsInJsonLd(node, found) {
  if (Array.isArray(node)) {
    node.forEach((n) => findEventsInJsonLd(n, found));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const rawType = node['@type'];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  if (types.some((t) => EVENT_TYPES.has(t))) found.push(node);
  Object.values(node).forEach((v) => findEventsInJsonLd(v, found));
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarFlyBot/0.1; +https://calendarflyer.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    const html = await resp.text();
    return { ok: resp.ok, status: resp.status, html };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tests one event-source URL (the "Test Source" step of the events
 * strategy). Returns whatever JSON-LD events and/or ICS links were found
 * in the page's raw HTML, or an `error` string explaining why nothing
 * was -- a non-2xx response, a timeout, or a page with neither signal.
 */
async function testEventSource(url) {
  const result = {
    url, ok: false, httpStatus: null, jsonldEvents: [], icsLinks: [], error: null,
    // Diagnostic -- htmlLength is the PLAIN-fetch size (before any render
    // fallback), so it's still visible even when rendering fixes things,
    // as a record of which sites actually needed it.
    htmlLength: 0,
    rendered: false,
    renderedHtmlLength: null,
    renderedTextSample: null,
    platformLinksFollowed: [],
    // Events found via a known site-builder's own DOM structure (e.g. the
    // "Devotee" temple platform) rather than JSON-LD/ICS. These are real
    // but heuristically scraped -- no guaranteed ISO dates -- so they're
    // kept separate from jsonldEvents and should go through an admin
    // review step before publishing, same as ROADMAP.md's review-queue plan.
    htmlEvents: [],
  };
  try {
    const { ok, status, html } = await fetchHtml(url);
    result.ok = ok;
    result.httpStatus = status;
    result.htmlLength = html ? html.length : 0;
    if (!ok) {
      result.error = `HTTP ${status}`;
      return result;
    }

    scanHtmlForEvents(html, result);
    let bestHtml = html; // widest HTML we've seen so far -- for platform-link scanning below

    // Plain fetch found nothing AND the page was suspiciously small --
    // likely a JS-rendered site the plain fetch never actually saw. Try
    // again with a real headless browser before giving up.
    if (result.jsonldEvents.length === 0 && result.icsLinks.length === 0
        && result.htmlLength < LIKELY_JS_RENDERED_THRESHOLD) {
      const renderResult = await fetchRenderedHtml(url);
      if (renderResult) {
        result.rendered = true;
        result.renderedHtmlLength = renderResult.html ? renderResult.html.length : 0;
        result.renderedTextSample = renderResult.textSample || null;
        scanHtmlForEvents(renderResult.html, result);
        bestHtml = renderResult.html; // client-rendered links (e.g. a JS-inserted
                                       // Eventbrite button) only exist in this version
        if (renderResult.platformCardEvents && renderResult.platformCardEvents.length > 0) {
          result.htmlEvents.push(...renderResult.platformCardEvents.map((e) => ({ ...e, source: 'devotee-platform' })));
        }
      }
    }

    if (result.jsonldEvents.length === 0 && result.icsLinks.length === 0 && result.htmlEvents.length === 0) {
      const platformLinks = findKnownPlatformLinks(bestHtml, url);
      for (const link of platformLinks) {
        try {
          const { ok: linkOk, html: linkHtml } = await fetchHtml(link);
          result.platformLinksFollowed.push({ url: link, ok: linkOk });
          if (linkOk) scanHtmlForEvents(linkHtml, result);
        } catch (err) {
          result.platformLinksFollowed.push({ url: link, ok: false, error: err.message });
        }
      }
    }

    if (result.jsonldEvents.length === 0 && result.icsLinks.length === 0 && result.htmlEvents.length === 0) {
      result.error = result.rendered
        ? 'No JSON-LD Event markup or ICS link found, even after rendering the page or following linked ticketing platforms'
        : 'No JSON-LD Event markup or ICS link found in the page HTML or linked ticketing platforms';
    }
  } catch (err) {
    result.error = err.name === 'AbortError'
      ? `Timed out after ${FETCH_TIMEOUT_MS}ms`
      : err.message;
  }
  return result;
}

module.exports = { testEventSource };
