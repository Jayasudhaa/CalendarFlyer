/**
 * server/utils/orgImages.js — best-effort "logo/photo" for an org, pulled
 * directly from its own website (og:image / twitter:image meta tag, or a
 * favicon/apple-touch-icon as a last resort) rather than any paid API.
 *
 * Used for directory-sourced orgs (server/utils/directorySources.js) --
 * real orgs that sign up for CalendarFly already upload their own
 * logo_url, and Google-Places-backfilled orgs are deliberately skipped
 * here (getting their website would require upgrading that Places API
 * call to its "Enterprise" pricing tier, just for a picture on an
 * unclaimed listing -- not worth the added cost).
 *
 * Fails closed like the rest of this pipeline: any network error, a
 * non-2xx response, or a page with no recognizable image tag just means
 * no picture (the UI already falls back to a colored initial/gradient),
 * never a broken page or a thrown error.
 */

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h -- a site's logo barely changes
const cache = new Map(); // url -> { value, expires }

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) { cache.delete(key); return undefined; }
  return hit.value;
}

function setCached(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

async function fetchText(url) {
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
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractMetaImage(html, pageUrl) {
  const metas = html.match(/<meta[^>]+>/gi) || [];
  const wanted = ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'];
  for (const key of wanted) {
    for (const tag of metas) {
      const propMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
      if (!propMatch || propMatch[1].toLowerCase() !== key) continue;
      const contentMatch = tag.match(/content=["']([^"']+)["']/i);
      if (contentMatch && contentMatch[1]) {
        try { return new URL(contentMatch[1], pageUrl).toString(); } catch { /* try next */ }
      }
    }
  }
  return null;
}

function extractIconLink(html, pageUrl) {
  const links = html.match(/<link[^>]+>/gi) || [];
  const relPriority = ['apple-touch-icon', 'icon', 'shortcut icon'];
  for (const relWanted of relPriority) {
    for (const tag of links) {
      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      if (!relMatch || relMatch[1].toLowerCase() !== relWanted) continue;
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1]) {
        try { return new URL(hrefMatch[1], pageUrl).toString(); } catch { /* try next */ }
      }
    }
  }
  return null;
}

/**
 * Returns an absolute image URL for pageUrl's site, or null if nothing
 * usable was found. Cached per URL for CACHE_TTL_MS so repeat lookups
 * (every group built from the same source) don't re-fetch the site.
 */
async function getWebsiteImage(pageUrl) {
  if (!pageUrl) return null;
  const cached = getCached(pageUrl);
  if (cached !== undefined) return cached;

  let result = null;
  const html = await fetchText(pageUrl);
  if (html) {
    result = extractMetaImage(html, pageUrl) || extractIconLink(html, pageUrl);
  }
  if (!result) {
    // Last resort: most sites serve /favicon.ico whether or not they
    // declare it in a <link> tag -- still more identifying than a plain
    // initial letter.
    try {
      const root = new URL('/favicon.ico', pageUrl).toString();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(root, { method: 'HEAD', signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (resp && resp.ok) result = root;
    } catch {
      // ignore -- no favicon either, result stays null
    }
  }

  setCached(pageUrl, result);
  return result;
}

module.exports = { getWebsiteImage };
