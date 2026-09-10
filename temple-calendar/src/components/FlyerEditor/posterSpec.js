// ─── Poster Specification — structured inputs that compile into a
// background-generation prompt.
//
// Pipeline this file implements (Event form → Intent engine → Poster
// specification → Prompt compiler → OpenAI background generation):
//   1. inferPosterSpecDefaults()  — "intent engine": guesses sensible
//      defaults from the event/org context so the AI Visual panel's
//      dropdowns/checkboxes start pre-filled instead of blank.
//   2. The AIVisualPanel dropdowns/checkboxes let the user override any
//      field — that's the "poster specification" the user is editing.
//   3. buildPosterSpec()  — assembles the flat panel state into the nested
//      PosterSpec shape compileBackgroundPrompt() expects.
//   4. compileBackgroundPrompt()  — the "prompt compiler": turns a
//      PosterSpec into the final text prompt.
//
// This runs entirely client-side (pure string templating, no secrets) and
// simply fills in the same editable prompt textarea the deity/celebration
// dropdown already writes to — so the compiled prompt still passes through
// every existing server-side guardrail (blocked terms, required-context,
// OpenAI moderation) in server/routes/generate-image.js unchanged.

export const INTENT_OPTIONS = [
  { value: 'invitation',               label: 'Invitation' },
  { value: 'reminder',                 label: 'Reminder' },
  { value: 'thank_you',                label: 'Thank You' },
  { value: 'fundraising',              label: 'Fundraising / Sponsorship' },
  { value: 'celebration_announcement', label: 'Celebration Announcement' },
  { value: 'general_update',           label: 'General Update' },
];

export const AUDIENCE_OPTIONS = [
  'Temple congregation', 'Youth group', 'Senior community',
  'Families with children', 'Donors & sponsors', 'General public',
];

export const REGION_OPTIONS = [
  'South Indian', 'North Indian', 'Bengali', 'Gujarati', 'Punjabi',
  'Maharashtrian', 'Pan-Indian / General',
];

export const STYLE_OPTIONS = [
  'Traditional ornate', 'Realistic photography', 'Illustrated / artistic',
  'Minimalist modern', 'Watercolor',
];

export const PALETTE_OPTIONS = [
  'Saffron & Gold', 'Red & Gold', 'Blue & White', 'Green & Gold',
  'Maroon & Cream', 'Pastel',
];

export const IMAGE_ROLE_OPTIONS = [
  'Full background', 'Side accent panel', 'Bottom banner strip', 'Subtle texture backdrop',
];

export const NEGATIVE_SPACE_OPTIONS = ['top', 'bottom', 'left', 'right', 'center'];

const INTENT_KEYWORDS = [
  { keywords: ['invit', 'save the date', 'rsvp', 'join us'], intent: 'invitation' },
  { keywords: ['remind', 'upcoming', "don't forget", 'dont forget'], intent: 'reminder' },
  { keywords: ['thank', 'gratitude', 'appreciation'], intent: 'thank_you' },
  { keywords: ['donat', 'fundrais', 'sponsor', 'contribut', 'seva', 'kanuka'], intent: 'fundraising' },
  { keywords: ['festival', 'utsav', 'mahotsav', 'celebrat', 'jayanti'], intent: 'celebration_announcement' },
];

/**
 * "Intent engine" — proposes sensible PosterSpec defaults from the event
 * and org context, so the dropdowns start pre-filled instead of blank. The
 * user can freely override any field before compiling the prompt.
 */
export function inferPosterSpecDefaults({ event, promptCategory, imageStyle }) {
  const combined = `${event?.title || ''} ${event?.type || ''} ${event?.description || ''}`.toLowerCase();
  const intentMatch = INTENT_KEYWORDS.find(k => k.keywords.some(kw => combined.includes(kw)));
  const isTemple = promptCategory === 'temple';

  return {
    intent: intentMatch?.intent || 'invitation',
    audience: isTemple ? 'Temple congregation' : 'General public',
    region: isTemple ? 'South Indian' : 'Pan-Indian / General',
    tradition: event?.type
      ? event.type.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : (isTemple ? 'South Indian temple tradition' : 'Community celebration'),
    style: isTemple ? 'Traditional ornate' : 'Realistic photography',
    palette: [isTemple ? 'Saffron & Gold' : 'Blue & White'],
    imageRole: 'Full background',
    negativeSpace: imageStyle === 'full' ? 'bottom' : 'top',
  };
}

export function getEmotionalTone(intent) {
  const TONE_BY_INTENT = {
    invitation: 'warm and welcoming',
    reminder: 'gentle and encouraging',
    thank_you: 'heartfelt and grateful',
    fundraising: 'inspiring and hopeful',
    celebration_announcement: 'joyful and vibrant',
    general_update: 'calm and informative',
  };
  return TONE_BY_INTENT[intent] || 'warm and respectful';
}

/**
 * Prompt compiler — turns a structured PosterSpec into the final
 * background-generation prompt text.
 *
 * spec: {
 *   intent: string,
 *   audience: { community: string },
 *   event: { category: string },
 *   visualDirection: {
 *     region, tradition, style, palette: string[], imageRole, negativeSpace,
 *   },
 * }
 */
export function compileBackgroundPrompt(spec) {
  const { audience, event, visualDirection, intent } = spec;
  return `
Create a professional visual background for a community event poster.

COMMUNICATION CONTEXT
Primary intent: ${intent}
Event category: ${event.category}
Intended audience: ${audience.community}
Cultural region: ${visualDirection.region ?? "Indian"}
Tradition: ${visualDirection.tradition ?? "community event"}

VISUAL DIRECTION
Style: ${visualDirection.style}
Color palette: ${visualDirection.palette.join(", ")}
Image role: ${visualDirection.imageRole}
Emotional tone: ${getEmotionalTone(intent)}

COMPOSITION
Create clear negative space in the ${visualDirection.negativeSpace}.
Keep important subjects away from the negative-space area.
Use a strong visual hierarchy suitable for a mobile social poster.
Use realistic lighting and natural textures.
Maintain clean edges and sufficient visual contrast.

CULTURAL REQUIREMENTS
Represent the specified regional tradition accurately.
Avoid mixing unrelated Indian regional traditions.
Use respectful and contextually appropriate decorations.
Show a natural range of Indian skin tones.
Avoid stereotypical or excessively ornate imagery.

STRICT OUTPUT RULES
Generate only the visual background.
Do not generate text.
Do not generate letters, words, numbers, dates or prices.
Do not generate logos, QR codes, watermarks or signatures.
Do not include invented religious iconography.
Do not create a complete poster layout with fake text.
  `.trim();
}

/**
 * Builds the nested PosterSpec object compileBackgroundPrompt() expects,
 * from the flat dropdown/checkbox state the AIVisualPanel UI keeps.
 */
export function buildPosterSpec(flat, { promptCategory }) {
  return {
    intent: flat.intent,
    audience: { community: flat.audience },
    event: { category: promptCategory === 'temple' ? 'Temple / religious event' : 'Community event' },
    visualDirection: {
      region: flat.region,
      tradition: flat.tradition,
      style: flat.style,
      palette: (flat.palette && flat.palette.length) ? flat.palette : ['Saffron & Gold'],
      imageRole: flat.imageRole,
      negativeSpace: flat.negativeSpace,
    },
  };
}
