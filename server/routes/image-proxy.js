/**
 * GET /api/image-proxy?url=https://...
 * Proxies remote images so Fabric can load without CORS tainting.
 *
 * This endpoint fetches whatever URL it's given and returns the response —
 * without a check, that means it can be pointed at internal/private
 * addresses (localhost, 127.0.0.1, 169.254.169.254 cloud metadata,
 * 10.x/172.16-31.x/192.168.x private ranges, etc.) and used as a
 * server-side-request-forgery pivot to probe or read from the server's own
 * network. isPublicHostname() below resolves the hostname and rejects
 * anything that lands in a private/reserved range before fetching it.
 */
const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const router  = express.Router();

// Blocks the well-known private/reserved IPv4 and IPv6 ranges: loopback,
// RFC1918 private space, link-local (which also covers the 169.254.x.x
// cloud metadata endpoint), unique-local/link-local IPv6, and
// unspecified/multicast addresses.
function isPrivateOrReservedIp(ip) {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true;                              // loopback
    if (a === 10) return true;                                // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                   // 192.168.0.0/16
    if (a === 169 && b === 254) return true;                   // link-local incl. cloud metadata
    if (a === 0) return true;                                   // 0.0.0.0/8
    if (a >= 224) return true;                                  // multicast/reserved
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;                           // loopback
    if (lower === '::') return true;                            // unspecified
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — check the embedded IPv4 address too.
      return isPrivateOrReservedIp(lower.replace('::ffff:', ''));
    }
    return false;
  }
  return true; // not a recognizable IP — treat cautiously as blocked
}

// Resolves the hostname and rejects it if ANY of its addresses are
// private/reserved — checking the resolved IP (not just the hostname
// string) is what actually closes the DNS-rebinding gap where a public
// hostname resolves to a private address.
async function isPublicHostname(hostname) {
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return false; // can't resolve — don't fetch it
  }
  if (!addresses.length) return false;
  return addresses.every(({ address }) => !isPrivateOrReservedIp(address));
}

router.options('/image-proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

router.get('/image-proxy', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).json({ error: 'Missing url param' });

  let u;
  try { u = new URL(rawUrl); }
  catch { return res.status(400).json({ error: 'Invalid url' }); }

  if (!['http:', 'https:'].includes(u.protocol)) {
    return res.status(400).json({ error: 'Only http/https allowed' });
  }

  try {
    // Follow redirects manually (instead of fetch's automatic redirect:
    // 'follow') so each hop's target hostname is re-checked against
    // isPublicHostname before being fetched — a public first URL could
    // otherwise redirect straight to a private address and bypass the
    // check entirely. Real image CDNs sometimes redirect once or twice, so
    // this still allows that instead of flatly rejecting any redirect.
    let currentUrl = rawUrl;
    let r;
    for (let hop = 0; hop < 5; hop++) {
      const hopUrl = new URL(currentUrl);
      if (!['http:', 'https:'].includes(hopUrl.protocol)) {
        return res.status(400).json({ error: 'Only http/https allowed' });
      }
      if (!(await isPublicHostname(hopUrl.hostname))) {
        console.warn(`[image-proxy] Blocked non-public target: ${hopUrl.hostname}`);
        return res.status(400).json({ error: 'That URL is not allowed' });
      }
      r = await fetch(currentUrl, {
        headers: { 'User-Agent': 'TempleFlyer/1.0' },
        redirect: 'manual',
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        currentUrl = new URL(r.headers.get('location'), currentUrl).toString();
        continue;
      }
      break;
    }

    if (!r.ok) return res.status(r.status).json({ error: `Upstream: ${r.status}` });

    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'URL did not return an image' });
    }

    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', contentType);

    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error('[image-proxy]', e);
    res.status(500).json({ error: 'image-proxy failed' });
  }
});

module.exports = router;
