/**
 * remove-bg.js — server/routes/remove-bg.js
 * Proxies image to Remove.bg API and returns base64 result.
 * Requires: REMOVE_BG_API_KEY in server .env
 * Free tier: 50 API calls/month at remove.bg
 *
 * This route was previously mounted with no auth and no rate limit — any
 * unauthenticated caller could burn through the account's remove.bg quota
 * (and, on a paid remove.bg plan, run up a real bill) with unlimited
 * requests. authenticateToken requires a valid org session; the rate
 * limiter below caps how fast any one org can call it on top of that.
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const FormData = require('form-data');
const fetch    = require('node-fetch');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { authenticateToken } = require('./auth');
const { sendServerError } = require('../utils/errors');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// 20 calls per org per 15 minutes — generous for normal flyer editing, but
// low enough that a compromised token or a buggy retry loop can't blow
// through the whole monthly remove.bg quota in seconds.
const removeBgLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.org_id) || ipKeyGenerator(req.ip),
  message: { error: 'Too many background-removal requests — please wait a few minutes and try again.' },
});

router.post('/', authenticateToken, removeBgLimiter, upload.single('image_file'), async (req, res) => {
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
    return sendServerError(res, err);
  }
});

module.exports = router;
