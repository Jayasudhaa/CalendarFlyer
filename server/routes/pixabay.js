/**
 * server/routes/pixabay.js
 * Proxies Pixabay image search — keeps API key secure on server side.
 * Free API: https://pixabay.com/api/docs/
 * Sign up free at pixabay.com to get your API key, add to .env as PIXABAY_API_KEY
 */

const express = require('express');
const router  = express.Router();

router.get('/pixabay-search', async (req, res) => {
  const { q = '', per_page = 18, page = 1 } = req.query;

  if (!q.trim()) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PIXABAY_API_KEY not set in server .env' });
  }

  try {
    const url = new URL('https://pixabay.com/api/');
    url.searchParams.set('key',          apiKey);
    url.searchParams.set('q',            q);
    url.searchParams.set('image_type',   'photo');
    url.searchParams.set('orientation',  'all');
    url.searchParams.set('category',     '');
    url.searchParams.set('safesearch',   'true');
    url.searchParams.set('per_page',     String(Math.min(Number(per_page), 50)));
    url.searchParams.set('page',         String(page));
    url.searchParams.set('lang',         'en');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status}`);
    }

    const data = await response.json();

    // Return only the fields we need (keep payload small)
    const hits = (data.hits || []).map(img => ({
      id:            img.id,
      previewURL:    img.previewURL,
      webformatURL:  img.webformatURL,
      largeImageURL: img.largeImageURL,
      tags:          img.tags,
      user:          img.user,
    }));

    return res.json({ hits, total: data.total, totalHits: data.totalHits });

  } catch (err) {
    console.error('[pixabay-search]', err);
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
});

module.exports = router;
