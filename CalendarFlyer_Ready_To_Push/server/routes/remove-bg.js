/**
 * remove-bg.js — server/routes/remove-bg.js
 * Proxies image to Remove.bg API and returns base64 result.
 * Requires: REMOVE_BG_API_KEY in server .env
 * Free tier: 50 API calls/month at remove.bg
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', upload.single('image_file'), async (req, res) => {
  try {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'REMOVE_BG_API_KEY not set in server .env' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image_file provided' });
    }

    const form = new FormData();
    form.append('image_file', req.file.buffer, {
      filename:    'image.png',
      contentType: req.file.mimetype || 'image/png',
    });
    form.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method:  'POST',
      headers: { 'X-Api-Key': apiKey, ...form.getHeaders() },
      body:    form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[remove-bg] API error:', response.status, errText);
      return res.status(response.status).json({ error: `Remove.bg API error (${response.status}). Check your API key and credits.` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    console.log('[remove-bg] success, size:', arrayBuffer.byteLength);
    return res.json({ imageBase64: `data:image/png;base64,${base64}` });

  } catch (err) {
    console.error('[remove-bg] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
