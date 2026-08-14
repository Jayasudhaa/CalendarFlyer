/**
 * GET /api/image-proxy?url=https://...
 * Proxies remote images so Fabric can load without CORS tainting.
 */
const express = require('express');
const router  = express.Router();

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
    const r = await fetch(rawUrl, {
      headers: { 'User-Agent': 'TempleFlyer/1.0' },
      redirect: 'follow',
    });

    if (!r.ok) return res.status(r.status).json({ error: `Upstream: ${r.status}` });

    const contentType = r.headers.get('content-type') || 'application/octet-stream';

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