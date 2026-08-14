/**
 * server/routes/generate-image.js
 * Express route — securely proxies DALL-E 3 requests
 * Mount this in your Express app: app.use('/api', require('./routes/generate-image'))
 */
const express = require('express');
const router  = express.Router();
const OpenAI   = require('openai');

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}
const BLOCKED_TERMS = [
  'violence','violent','kill','murder','weapon','gun','bomb','blood','gore',
  'dead','death','corpse','massacre','war','attack','torture','abuse',
  'nude','naked','sexual','erotic','porn','explicit','nsfw','sexy',
  'seductive','provocative','intimate','lingerie','topless',
  'hate','racist','racism','slur','extremist','terrorist','supremacist',
  'casino','alcohol','beer','wine','liquor','cigarette','drug','gambling',
  'horror','halloween','demon','devil','satan','skull','occult',
  'ignore previous','ignore instructions','jailbreak','as an ai',
  'pretend you','you are now','new instructions','override','system prompt',
];
const REQUIRED_CONTEXT = [
  'temple','deity','lord','goddess','divine','hindu','vedic','mandir',
  'pooja','puja','festival','deepam','lamp','rangoli','garland','flower',
  'lotus','marigold','venkateswara','balaji','ganesh','ganesha','lakshmi',
  'shiva','krishna','rama','murugan','durga','saraswati','hanuman',
  'vishnu','brahma','devi','swami','abhishekam','kalyanam','utsav',
  'navratri','diwali','pongal','shivaratri','gopuram','sanctum','mandapam',
  'idol','murthi','aarti','prasadam','thoran','deepavali','brahmotsavam',
  'janmashtami','ramanavami','navaratri','vinayaka','chaturthi','skanda',
];
const SAFE_SUFFIX = `. Strictly for a Hindu temple event flyer. Devotional, respectful, traditional Indian religious art style. NO text, NO words, NO letters in the image. NO people in inappropriate clothing. NO violence, NO weapons, NO alcohol. Professional quality, suitable for all ages and display in a place of worship.`;
function validatePrompt(prompt) {
  const lower = prompt.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    const isPhrase = term.includes(' ');
    const matched = isPhrase
      ? lower.includes(term)
      : new RegExp(`\\b${term}\\b`, 'i').test(lower);
    if (matched) {
      return { valid: false, reason: `Prompt contains inappropriate content. Please describe a temple deity, festival, or devotional scene.` };
    }
  }
  if (prompt.trim().length < 10) {
    return { valid: false, reason: 'Prompt is too short. Please describe what you want to generate.' };
  }
  if (prompt.trim().length > 3500) {
    return { valid: false, reason: 'Prompt is too long. Please shorten your description.' };
  }
  const hasContext = REQUIRED_CONTEXT.some(term => lower.includes(term));
  if (!hasContext) {
    return { valid: false, reason: 'Please describe a Hindu temple deity, festival, or devotional scene — e.g. Lord Venkateswara, Diwali lamps, rangoli pattern.' };
  }
  return { valid: true };
}
router.post('/generate-image', async (req, res) => {
  const { prompt, size = '1024x1024' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server.' });
  }

  const validation = validatePrompt(prompt);
  if (!validation.valid) {
    console.warn('[generate-image] Blocked:', prompt.substring(0, 80));
    return res.status(400).json({ error: validation.reason, blocked: true });
  }
  try {
    const moderation = await getOpenAI().moderations.create({ input: prompt });
    const result = moderation.results[0];
    if (result.flagged) {
      const cats = Object.entries(result.categories).filter(([, v]) => v).map(([k]) => k).join(', ');
      console.warn('[generate-image] Moderation flagged:', cats);
      return res.status(400).json({
        error: `This prompt was flagged as inappropriate (${cats}). Please describe a devotional temple scene.`,
        blocked: true,
      });
    }
  } catch (modErr) {
    console.error('[generate-image] Moderation API error (continuing):', modErr.message);
  }
  const safePrompt = `${prompt.trim()}${SAFE_SUFFIX}`;

    try {
    console.log('[generate-image] Generating with gpt-image-1...');
    const response = await getOpenAI().images.generate({
      model:  'gpt-image-1',
      prompt:  safePrompt,
        n:       1,
      size:   '1024x1024',
    });

    const b64 = response.data[0]?.b64_json;
    const imgUrl = response.data[0]?.url;

    if (b64) {
      console.log('[generate-image] gpt-image-1 success (base64):', prompt.substring(0, 60));
      return res.status(200).json({ imageBase64: `data:image/png;base64,${b64}` });
    } else if (imgUrl) {
      const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    const contentType = imgRes.headers.get('content-type') || 'image/png';
      console.log('[generate-image] gpt-image-1 success (url):', prompt.substring(0, 60));
      return res.status(200).json({ imageBase64: `data:${contentType};base64,${base64}` });
    } else {
      throw new Error('No image returned from API');
    }
  } catch (err) {
    console.error('[generate-image] Error:', err.message);
    if (err.message?.includes('content_policy') || err.message?.includes('safety system')) {
      return res.status(400).json({
        error: 'Request declined due to content policy. Please modify your prompt to describe a devotional temple scene.',
        blocked: true,
      });
    }
    return res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

module.exports = router;
