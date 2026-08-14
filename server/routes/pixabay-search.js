/**
 * pixabay-search.js — GET /api/pixabay-search?q=lotus&per_page=18
 *
 * Add to server/.env:
 *   PIXABAY_API_KEY=your_key
 */

const express = require('express');
const fetch   = require('node-fetch');

const router  = express.Router();

router.get('/', async (req, res) => {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PIXABAY_API_KEY not set in server .env' });
  }

  const { q = '', per_page = 18 } = req.query;
  if (!q.trim()) return res.status(400).json({ error: 'Missing search query' });

  try {
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(q)}&per_page=${per_page}&image_type=photo&safesearch=true`;
    const response = await fetch(url);
    const data     = await response.json();
    if (!response.ok) throw new Error(data.error || 'Pixabay request failed');
    return res.json(data);
  } catch (err) {
    console.error('[pixabay-search]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
