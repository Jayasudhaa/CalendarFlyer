/**
 * server/routes/generate-image.js
 * Express route — securely proxies DALL-E 3 / gpt-image-1 requests.
 * Mount this in your Express app: app.use('/api', require('./routes/generate-image'))
 *
 * Two modes:
 *   - 'background' (default): AI generates artwork only, no text. The app's
 *     own editable/translatable text fields are overlaid on top afterward.
 *   - 'poster': AI renders the event's title/date/time/venue directly into
 *     the finished poster (posterText in the request body). Looks like a
 *     complete invitation card, but that text is then baked into the image
 *     — no longer separately editable or translatable client-side.
 *
 * Guardrails (defense in depth, all server-side so they can't be bypassed
 * from the browser):
 *   1. Blocked-terms check — rejects nudity/sexual/violent/etc. keywords,
 *      scanned across both the prompt AND any posterText fields.
 *   2. Required-context check — the prompt must be on-topic for the org's
 *      category (temple deity/festival vs. general community celebration),
 *      so "generate anything" requests are rejected.
 *   3. OpenAI moderation API — catches what keyword lists miss.
 *   4. A category style suffix + a global system prompt are appended to
 *      EVERY prompt before it reaches the image model. Both are editable
 *      only by the platform super admin via GET/PUT /api/admin/ai-settings
 *      (see server/routes/admin.js) — normal org users never see this text.
 */
const express = require('express');
const router  = express.Router();
const OpenAI   = require('openai');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getSettings } = require('../utils/aiSettingsStore');
const { authenticateToken } = require('./auth');
const { recordAiImageUsage } = require('../organizations');
const { sendServerError } = require('../utils/errors');

// Every call here costs real money (an OpenAI image-generation or vision
// API call), unlike most of this app's other routes — so this is the
// tightest limiter in the codebase, same rateLimit pattern/library as
// routes/remove-bg.js's removeBgLimiter, keyed by org (falls back to IP for
// the rare case authenticateToken didn't attach req.user) so a compromised
// token or a buggy retry loop can't run up an unbounded bill for one org.
// The org's own monthly ai_images_per_month plan limit (organizations.js /
// recordAiImageUsage) caps total usage — this caps burst *rate*, which
// that plan-limit check alone doesn't.
const generateImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.org_id) || ipKeyGenerator(req.ip),
  message: { error: 'Too many image-generation requests — please wait a while and try again.' },
});
// Cheaper than actual generation (one vision/text completion, not an image
// render) so it gets a more generous allowance than generateImageLimiter.
const describeReferenceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.org_id) || ipKeyGenerator(req.ip),
  message: { error: 'Too many requests — please wait a while and try again.' },
});

// Reference images are grounding, not the whole image — more than a
// handful dilutes the style signal into mush instead of a clear match, and
// each extra image adds latency/cost to the request. Cap well under the
// API's own limit of 16.
const MAX_REFERENCE_IMAGES = 4;

let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Prompt-injection attempts ("ignore previous instructions", etc.) — always
// blocked regardless of category or admin-edited blocked-terms list.
const PROMPT_INJECTION_TERMS = [
  'ignore previous', 'ignore instructions', 'jailbreak', 'as an ai',
  'pretend you', 'you are now', 'new instructions', 'override', 'system prompt',
];

const POSTER_FIELD_MAX_LEN = 200;

function resolveCategory(settings, requestedCategory) {
  const key = requestedCategory === 'temple' ? 'temple' : 'community';
  const config = settings.categories[key] || settings.categories.community;
  return { key, config };
}

function findBlockedTerm(text, blockedTerms) {
  const lower = String(text || '').toLowerCase();
  const allBlocked = [...(blockedTerms || []), ...PROMPT_INJECTION_TERMS];
  for (const term of allBlocked) {
    const isPhrase = term.includes(' ');
    const matched = isPhrase
      ? lower.includes(term)
      : new RegExp(`\\b${term}\\b`, 'i').test(lower);
    if (matched) return term;
  }
  return null;
}

function validateRequest({ prompt, posterText, categoryConfig, blockedTerms }) {
  const posterValues = posterText ? Object.values(posterText).filter(Boolean) : [];

  const blockedHit = findBlockedTerm([prompt, ...posterValues].join(' '), blockedTerms);
  if (blockedHit) {
    return { valid: false, reason: `Prompt contains inappropriate content. Please describe a ${categoryConfig.label} scene.` };
  }
  if (prompt.trim().length < 10) {
    return { valid: false, reason: 'Prompt is too short. Please describe what you want to generate.' };
  }
  if (prompt.trim().length > 3500) {
    return { valid: false, reason: 'Prompt is too long. Please shorten your description.' };
  }
  for (const v of posterValues) {
    if (String(v).length > POSTER_FIELD_MAX_LEN) {
      return { valid: false, reason: `Title/date/time/venue text is too long (max ${POSTER_FIELD_MAX_LEN} characters each).` };
    }
  }
  const hasContext = (categoryConfig.requiredContext || []).some(term => prompt.toLowerCase().includes(term));
  if (!hasContext) {
    return { valid: false, reason: `Please describe a ${categoryConfig.label} scene — e.g. ${categoryConfig.examples}.` };
  }
  return { valid: true };
}

// gpt-image-1 only accepts a small fixed set of sizes — pick the closest
// match to the flyer's actual aspect ratio instead of always using square.
function pickImageSize(width, height) {
  const w = Number(width), h = Number(height);
  if (!w || !h) return '1024x1024';
  const ratio = w / h;
  if (ratio > 1.15) return '1536x1024';  // landscape
  if (ratio < 0.87) return '1024x1536';  // portrait
  return '1024x1024';                    // square-ish
}

// A reference photo must be one of the org's own S3-hosted uploads (see
// POST /api/flyers/reference-photos) — this route has no auth, so without
// this check a caller could pass any URL as `referencePhotoUrl` and turn
// the server into an open SSRF proxy (e.g. cloud metadata endpoints).
function isTrustedReferenceUrl(url) {
  if (typeof url !== 'string') return false;
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
  if (!bucket) return false;
  const prefix = `https://${bucket}.s3.${region}.amazonaws.com/orgs/`;
  return url.startsWith(prefix);
}

function buildPosterTextInstruction(posterText) {
  if (!posterText) return '';
  const lines = [];
  if (posterText.title) lines.push(`Event title text: "${posterText.title}"`);
  if (posterText.date)  lines.push(`Date text: "${posterText.date}"`);
  if (posterText.time)  lines.push(`Time text: "${posterText.time}"`);
  if (posterText.venue) lines.push(`Venue text: "${posterText.venue}"`);
  if (!lines.length) return '';
  return ` Elegantly and legibly render the following text as an integrated part of the poster design, spelled exactly as given with no spelling mistakes, using tasteful decorative typography that matches the art style: ${lines.join('. ')}.`;
}

router.post('/generate-image', authenticateToken, generateImageLimiter, async (req, res) => {
  const { prompt, category, mode, posterText, width, height, referencePhotoUrl, referencePhotoUrls } = req.body;
  const isPoster = mode === 'poster';
  // referencePhotoUrls (array, current) supersedes referencePhotoUrl
  // (singular, kept for back-compat with any not-yet-updated caller).
  const requestedUrls = Array.isArray(referencePhotoUrls) && referencePhotoUrls.length
    ? referencePhotoUrls
    : (referencePhotoUrl ? [referencePhotoUrl] : []);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server.' });
  }

  const settings = getSettings();
  const { config: categoryConfig } = resolveCategory(settings, category);

  const validation = validateRequest({ prompt, posterText: isPoster ? posterText : null, categoryConfig, blockedTerms: settings.blockedTerms });
  if (!validation.valid) {
    console.warn('[generate-image] Blocked:', prompt.substring(0, 80));
    return res.status(400).json({ error: validation.reason, blocked: true });
  }
  try {
    const moderationInput = isPoster && posterText
      ? [prompt, ...Object.values(posterText).filter(Boolean)].join(' ')
      : prompt;
    const moderation = await getOpenAI().moderations.create({ input: moderationInput });
    const result = moderation.results[0];
    if (result.flagged) {
      const cats = Object.entries(result.categories).filter(([, v]) => v).map(([k]) => k).join(', ');
      console.warn('[generate-image] Moderation flagged:', cats);
      return res.status(400).json({
        error: `This prompt was flagged as inappropriate (${cats}). Please revise your description.`,
        blocked: true,
      });
    }
  } catch (modErr) {
    console.error('[generate-image] Moderation API error (continuing):', modErr.message);
  }

  const size = pickImageSize(width, height);

  // Reference-image grounding: fetch up to MAX_REFERENCE_IMAGES of the
  // org's own uploaded photos/flyers and use images.edit() instead of
  // images.generate() so the result is visually grounded in them (e.g. the
  // actual temple building or the org's own past design style, not a
  // generic one). Each URL is validated independently; a bad/expired one
  // is just dropped rather than failing the whole request — reference
  // grounding fails open to a normal text-to-image call if none survive.
  //
  // This has to happen BEFORE the style suffix is picked below: the normal
  // styleSuffix/posterStyleSuffix ask for an illustrated/painted art style
  // with an ornate border, which directly fights a reference photo's "match
  // this real photo" instruction — generated images used to visibly drift
  // away from what the org actually uploaded. referenceStyleSuffix asks for
  // a photographic enhancement instead, so it's only used once we know
  // whether a reference photo actually survived validation/fetch.
  const referenceImageFiles = [];
  for (const url of requestedUrls.slice(0, MAX_REFERENCE_IMAGES)) {
    if (!isTrustedReferenceUrl(url)) {
      console.warn('[generate-image] Ignoring untrusted reference URL:', url);
      continue;
    }
    try {
      const refRes = await fetch(url);
      if (!refRes.ok) throw new Error(`Failed to fetch reference image: ${refRes.status}`);
      const refBuffer      = Buffer.from(await refRes.arrayBuffer());
      const refContentType = refRes.headers.get('content-type') || 'image/png';
      const refExt          = (refContentType.split('/')[1] || 'png').split(';')[0];
      referenceImageFiles.push(await OpenAI.toFile(refBuffer, `reference-${referenceImageFiles.length}.${refExt}`, { type: refContentType }));
    } catch (refErr) {
      console.error('[generate-image] Reference image fetch failed, skipping it:', refErr.message);
    }
  }
  const usedReferencePhoto = referenceImageFiles.length > 0;

  const styleSuffix = usedReferencePhoto
    ? (categoryConfig.referenceStyleSuffix || categoryConfig.styleSuffix)
    : isPoster
      ? (categoryConfig.posterStyleSuffix || categoryConfig.styleSuffix)
      : categoryConfig.styleSuffix;
  const textInstruction = isPoster ? buildPosterTextInstruction(posterText) : '';
  const safePrompt = `${prompt.trim()}${styleSuffix}${textInstruction} ${settings.systemPrompt}`;

  // input_fidelity mainly preserves fine details/faces from the reference —
  // it doesn't by itself tell the model to match the reference's overall
  // scene/setting/style. Spell that out explicitly, or the result can look
  // like it ignored the reference entirely.
  const referenceInstruction = usedReferencePhoto
    ? (referenceImageFiles.length > 1
        ? ' Use the attached reference images as the primary visual and stylistic guide: closely match their shared real-world setting, architecture or decor, color palette, design style, and lighting. Keep the generated image recognizably consistent with what is shown across those reference images rather than inventing an unrelated scene.'
        : ' Use the attached reference photo as the primary visual and stylistic guide: closely match its real-world setting, architecture or decor, color palette, and lighting. Keep the generated image recognizably consistent with what is shown in that reference photo rather than inventing an unrelated scene.')
    : '';
  const finalPrompt = `${safePrompt}${referenceInstruction}`;

  try {
    console.log(`[generate-image] Generating with gpt-image-1.5 (mode=${isPoster ? 'poster' : 'background'}, size=${size}, referenceCount=${referenceImageFiles.length})...`);
    const response = usedReferencePhoto
      ? await getOpenAI().images.edit({
          model:          'gpt-image-1.5',
          image:          referenceImageFiles,
          prompt:         finalPrompt,
          size,
          quality:        'high',
          input_fidelity: 'high',
        })
      : await getOpenAI().images.generate({
          model:   'gpt-image-1.5',
          prompt:  finalPrompt,
          n:       1,
          size,
          quality: 'high',
        });

    const b64 = response.data[0]?.b64_json;
    const imgUrl = response.data[0]?.url;

    // Every successful generation counts against the org's free monthly AI
    // image allowance, then accrues overage past it — never blocks the
    // response itself, this is pure bookkeeping. req.user.org_id comes from
    // the JWT (see authenticateToken in routes/auth.js); a guest/no-org
    // token just skips tracking rather than erroring the whole request.
    let usage = null;
    if (req.user?.org_id) {
      try {
        usage = await recordAiImageUsage(req.user.org_id);
      } catch (usageErr) {
        console.error('[generate-image] Usage tracking failed (continuing):', usageErr.message);
      }
    }

    if (b64) {
      console.log('[generate-image] gpt-image-1.5 success (base64):', prompt.substring(0, 60));
      return res.status(200).json({ imageBase64: `data:image/png;base64,${b64}`, usedReferencePhoto, usage });
    } else if (imgUrl) {
      const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    const contentType = imgRes.headers.get('content-type') || 'image/png';
      console.log('[generate-image] gpt-image-1.5 success (url):', prompt.substring(0, 60));
      return res.status(200).json({ imageBase64: `data:${contentType};base64,${base64}`, usedReferencePhoto, usage });
    } else {
      throw new Error('No image returned from API');
    }
  } catch (err) {
    console.error('[generate-image] Error:', err.message);
    if (err.message?.includes('content_policy') || err.message?.includes('safety system')) {
      return res.status(400).json({
        error: 'Request declined due to content policy. Please modify your prompt to describe an appropriate event scene.',
        blocked: true,
      });
    }
    return sendServerError(res, err, 'Image generation failed');
  }
});

// ── Auto-write a prompt from an uploaded reference photo ────────────────────
// The AI Visual panel's Reference Library lets an org upload photos of their
// own temple/venue/decor to ground image generation. Previously the org
// still had to describe that photo in words themselves. This lets them
// upload a photo and have a usable AI-image prompt written from what's
// actually in it (architecture, decor, colors, lighting, setting) — never
// transcribing any visible text/watermark, and never mentioning identifiable
// people, since the description just feeds back into the prompt box.
router.post('/describe-reference-image', authenticateToken, describeReferenceLimiter, async (req, res) => {
  const { url, category } = req.body || {};

  if (!isTrustedReferenceUrl(url)) {
    return res.status(400).json({ error: 'Reference photo URL is not recognized.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server.' });
  }

  const settings = getSettings();
  const { config: categoryConfig } = resolveCategory(settings, category);

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write short, vivid AI-image-generation prompts describing the real-world scene shown in a photo — setting, architecture, decor, colors, and lighting. 2-3 sentences, plain descriptive language, no preamble or quotation marks around the output. Never transcribe or mention any text, sign, or watermark visible in the photo, and never describe identifiable people. The description will be used as the prompt for generating a ${categoryConfig.label} flyer image grounded in this photo.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this photo as an AI image generation prompt.' },
            { type: 'image_url', image_url: { url } },
          ],
        },
      ],
      max_tokens: 220,
    });
    const description = completion.choices?.[0]?.message?.content?.trim();
    if (!description) throw new Error('No description returned');
    console.log('[describe-reference-image] Success:', description.substring(0, 80));
    return res.status(200).json({ description });
  } catch (err) {
    console.error('[describe-reference-image] Error:', err.message);
    return sendServerError(res, err, 'Failed to describe reference photo');
  }
});

module.exports = router;
