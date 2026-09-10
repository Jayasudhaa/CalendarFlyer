/**
 * server/routes/translate.js
 * Proxies Google Cloud Translation API v2 — keeps API key secure on server side.
 * Used by Flyer Studio to translate flyer text into Tamil/Telugu/Hindi/Kannada.
 * Add your key to .env as GOOGLE_TRANSLATE_API_KEY.
 */

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const { sendServerError } = require('../utils/errors');

const SUPPORTED_LANGS = new Set(['en', 'ta', 'te', 'hi', 'kn']);

// No auth on this route (see file header — keeps it simple for the Flyer
// Studio UI to call), so a per-IP cap is what stands between this and
// unlimited scripted calls against a paid Google API.
const translateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many translation requests — please wait a few minutes and try again.' },
});

router.post('/translate', translateLimiter, async (req, res) => {
  const { text, targetLang } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!targetLang || !SUPPORTED_LANGS.has(targetLang)) {
    return res.status(400).json({ error: 'targetLang must be one of: ' + [...SUPPORTED_LANGS].join(', ') });
  }

  // English source, English target — nothing to do
  if (targetLang === 'en') {
    return res.json({ translatedText: text });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_TRANSLATE_API_KEY not set in server .env' });
  }

  try {
    const url = new URL('https://translation.googleapis.com/language/translate/v2');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: 'en',
        format: 'text',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = (data && data.error && data.error.message) || `Translate API error: ${response.status}`;
      console.error('[translate]', message);
      return res.status(response.status).json({ error: message });
    }

    const translatedText = data?.data?.translations?.[0]?.translatedText;
    if (!translatedText) {
      return res.status(502).json({ error: 'No translation returned' });
    }

    return res.json({ translatedText });

  } catch (err) {
    console.error('[translate]', err);
    return sendServerError(res, err, 'Translation failed');
  }
});

module.exports = router;
