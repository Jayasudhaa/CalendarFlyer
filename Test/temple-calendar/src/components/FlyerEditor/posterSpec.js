// ─── Poster Specification — structured inputs that compile into a
// background-generation prompt.
//
// Pipeline this file implements (Event form → Intent engine → Poster
// specification → Prompt compiler → OpenAI background generation):
//   1. inferPosterSpecDefaults()  — "intent engine": guesses sensible
//      defaults from the event/org context so the AI Visual panel's
//      dropdowns/checkboxes start pre-filled instead of blank. As of the
//      Poster Intelligence Engine, this now includes matching the event
//      against real festival/story data (see below) instead of guessing.
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
//
// ─── Poster Intelligence Engine (Phase 1) ───────────────────────────────
// Wires in the CalendarFly Poster Engine Master Knowledge Base — 108 real
// Indian festivals with real approved motifs/palettes, 36 states' real
// language/art/food/clothing cues, 25 emotional story patterns, and the
// production design-rule guardrails behind them — in place of the generic
// filler text this file used to compile. Deliberately scoped to what the
// existing wizard/prompt-compiler flow can use today; the knowledge base's
// full campaign/analytics schema and daily content calendar are separate
// features for once poster intelligence is validated and other org
// verticals (dance/music/yoga) are actually being sold.
import { matchFestival, getFestivalById } from './festivalIntelligence';
import { REGION_LIST, getRegionInfoForState, getRepresentativeStateInfo } from './regionsLanguages';
import { matchStoryPattern, getStoryById, getStoryOptionsForIntent } from './storyPatterns';
import { getCoreGuardrails } from './designRules';

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

// Real regions from the Regions & Languages dataset (South/North/East/
// West/Central/Northeast/Union Territory), plus one explicit catch-all for
// posters that aren't tied to a specific Indian region — replaces the old
// ad hoc list that mixed regions with individual communities ("Bengali",
// "Gujarati") that had no data behind them.
export const REGION_OPTIONS = [...REGION_LIST, 'Pan-Indian / General'];

export const STYLE_OPTIONS = [
  'Traditional ornate', 'Realistic photography', 'Illustrated / artistic',
  'Minimalist modern', 'Watercolor',
];

// Generic named palettes (kept for community/nonprofit orgs and as a
// fallback when no festival is matched) with their real hex values —
// moved here from the wizard's own PALETTE_SWATCHES map since palette hex
// is poster-specification data, not UI styling. getPaletteOptions() below
// is the preferred way to read palettes going forward: it prepends a
// festival-specific palette (real hex from the knowledge base) whenever a
// festival is matched.
export const PALETTE_OPTIONS = [
  'Saffron & Gold', 'Red & Gold', 'Blue & White', 'Green & Gold',
  'Maroon & Cream', 'Pastel',
];
export const PALETTE_HEX = {
  'Saffron & Gold': ['#FF9933', '#D4AF37'],
  'Red & Gold':     ['#B3202B', '#D4AF37'],
  'Blue & White':   ['#1E3A8A', '#FFFFFF'],
  'Green & Gold':   ['#15803D', '#D4AF37'],
  'Maroon & Cream': ['#7B1E3A', '#F3E5C8'],
  Pastel:           ['#F6C9DA', '#BEE3F8', '#FDE9C8'],
};

/**
 * Palette choices to offer for this poster spec: the matched festival's
 * real suggested palette first (if any), then the generic named palettes.
 * Each option carries real hex so the wizard can render true-color swatches
 * instead of a plain text label.
 */
export function getPaletteOptions(festivalId) {
  const festival = festivalId ? getFestivalById(festivalId) : null;
  const options = PALETTE_OPTIONS.map(label => ({ value: label, label, hex: PALETTE_HEX[label] }));
  if (festival && festival.paletteHex && festival.paletteHex.length) {
    options.unshift({ value: `${festival.name} Palette`, label: `${festival.name} Palette`, hex: festival.paletteHex });
  }
  return options;
}

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
 *
 * For temple orgs, also runs the event through the Festival Intelligence
 * dataset (matchFestival) and, when it finds a real match, pre-fills
 * region/tradition/palette from that festival's actual data instead of a
 * generic guess. A best-fit emotional story (Story Patterns) is pre-picked
 * from the inferred intent the same way.
 */
export function inferPosterSpecDefaults({ event, promptCategory, imageStyle }) {
  const combined = `${event?.title || ''} ${event?.type || ''} ${event?.description || ''}`.toLowerCase();
  const intentMatch = INTENT_KEYWORDS.find(k => k.keywords.some(kw => combined.includes(kw)));
  const intent = intentMatch?.intent || 'invitation';
  const isTemple = promptCategory === 'temple';

  const festival = isTemple ? matchFestival(event) : null;
  const story = matchStoryPattern(intent);
  const paletteOptions = getPaletteOptions(festival?.id || null);

  return {
    intent,
    audience: isTemple ? 'Temple congregation' : 'General public',
    region: festival?.region || (isTemple ? 'South' : 'Pan-Indian / General'),
    tradition: festival
      ? festival.name
      : (event?.type
        ? event.type.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : (isTemple ? 'South Indian temple tradition' : 'Community celebration')),
    festivalId: festival?.id || null,
    storyId: story?.id || null,
    style: isTemple ? 'Traditional ornate' : 'Realistic photography',
    palette: [paletteOptions[0]?.value || (isTemple ? 'Saffron & Gold' : 'Blue & White')],
    imageRole: 'Full background',
    negativeSpace: imageStyle === 'full' ? 'bottom' : 'top',
  };
}

const TONE_BY_INTENT = {
  invitation: 'warm and welcoming',
  reminder: 'gentle and encouraging',
  thank_you: 'heartfelt and grateful',
  fundraising: 'inspiring and hopeful',
  celebration_announcement: 'joyful and vibrant',
  general_update: 'calm and informative',
};

/**
 * Emotional tone for the compiled prompt. Prefers the matched Story
 * Pattern's real `tone` field when a storyId is given and resolves; falls
 * back to the original 6-entry intent map otherwise (unchanged behavior
 * for any caller that doesn't pass a storyId).
 */
export function getEmotionalTone(intent, storyId) {
  const story = storyId ? getStoryById(storyId) : null;
  if (story?.tone) return story.tone;
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
 *     festivalId, storyId,
 *   },
 * }
 */
export function compileBackgroundPrompt(spec) {
  const { audience, event, visualDirection, intent } = spec;
  const festival = visualDirection.festivalId ? getFestivalById(visualDirection.festivalId) : null;
  const story = visualDirection.storyId ? getStoryById(visualDirection.storyId) : null;

  // Real regional texture — from the matched festival's own state when
  // there is one, otherwise a representative state for the chosen region
  // (skipped for the "Pan-Indian / General" catch-all, which has no single
  // state to represent). For a TEMPLE org with no festival match, also skip
  // the representative-state guess — a temple poster is usually already
  // anchored to a specific deity/theme (from the promptLibrary.js pick),
  // and forcing an unrelated state's food/craft/attire cues onto that deity
  // (e.g. "Bengali" typed by hand, but a "Goa" craft/food block gets forced
  // in because Goa happens to be the first state listed under "West") reads
  // as a random regional mashup — exactly what the guardrails below warn
  // against. Community/other orgs have no separate deity theme to conflict
  // with, so the representative-state guess still helps there.
  const isTempleEvent = event.category === 'Temple / religious event';
  const regionInfo = festival
    ? getRegionInfoForState(festival.state)
    : (!isTempleEvent && REGION_LIST.includes(visualDirection.region) ? getRepresentativeStateInfo(visualDirection.region) : null);

  const coreGuardrails = getCoreGuardrails();

  const storyBlock = story ? `
STORY DIRECTION
Emotion to evoke: ${story.emotion} — ${story.coreMessage}
Visual metaphor: ${story.visualMetaphor}
Guardrail: ${story.guardrail}
` : '';

  const culturalLines = [];
  if (festival) {
    culturalLines.push(`Depict ${festival.name} (${festival.state}, ${festival.family.toLowerCase()} tradition) — core meaning: ${festival.meaning}.`);
    culturalLines.push(`Approved visual motifs: ${festival.motifs}.`);
    culturalLines.push(`Composition guidance: ${festival.composition}.`);
    if (regionInfo) {
      culturalLines.push(`Regional texture cues — craft/architecture: ${regionInfo.artCues}; food/props: ${regionInfo.foodCues}; attire: ${regionInfo.clothingCues}.`);
    }
    culturalLines.push('Avoid costume stereotypes, mixed-region motifs, decorative sacred text, and incorrect deity/ritual imagery.');
  } else if (regionInfo) {
    culturalLines.push(`Represent ${regionInfo.state} (${regionInfo.region} India) specifically — craft/architecture: ${regionInfo.artCues}; food/props: ${regionInfo.foodCues}; attire: ${regionInfo.clothingCues}.`);
    culturalLines.push('Avoid mixing unrelated Indian regional traditions.');
  } else {
    culturalLines.push(`Represent the specified regional tradition (${visualDirection.region ?? 'Indian'}) accurately.`);
    culturalLines.push('Avoid mixing unrelated Indian regional traditions.');
  }
  // Universal guardrails from the Design Rules sheet — sacred imagery,
  // sacred/pseudo-text, representation, and color discipline apply to any
  // devotional or cultural poster, matched festival or not.
  const isDevotionalFestival = festival && /devotional|temple|ritual|pilgrimage|spiritual/i.test(festival.family);
  for (const rule of coreGuardrails) {
    if (rule.topic === 'Deities and icons' && isDevotionalFestival) culturalLines.push(rule.principle);
    if (rule.topic === 'Scripts') culturalLines.push(rule.principle);
    if (rule.topic === 'People') culturalLines.push(rule.principle);
  }
  culturalLines.push('Use respectful and contextually appropriate decorations.');
  culturalLines.push('Show a natural range of Indian skin tones.');
  culturalLines.push('Avoid stereotypical or excessively ornate imagery.');

  return `
Create a professional visual background for a community event poster.

COMMUNICATION CONTEXT
Primary intent: ${intent}
Event category: ${event.category}
Intended audience: ${audience.community}
Cultural region: ${visualDirection.region ?? "Indian"}
Tradition: ${visualDirection.tradition ?? "community event"}
${storyBlock}
VISUAL DIRECTION
Style: ${visualDirection.style}
Color palette: ${visualDirection.palette.join(", ")}
Image role: ${visualDirection.imageRole}
Emotional tone: ${getEmotionalTone(intent, visualDirection.storyId)}

COMPOSITION
Create clear negative space in the ${visualDirection.negativeSpace}.
Keep important subjects away from the negative-space area.
Use a strong visual hierarchy suitable for a mobile social poster.
Use realistic lighting and natural textures.
Maintain clean edges and sufficient visual contrast.

CULTURAL REQUIREMENTS
${culturalLines.join('\n')}

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
      festivalId: flat.festivalId || null,
      storyId: flat.storyId || null,
    },
  };
}

// Re-exported for the wizard's new festival-picker and story steps, so it
// can import everything it needs from posterSpec.js alongside the other
// *_OPTIONS constants it already imports from here, without also having to
// know about the underlying knowledge-base data modules.
export { matchFestival, getFestivalById, searchFestivals } from './festivalIntelligence';
export { getStoryOptionsForIntent, getStoryById } from './storyPatterns';
export { getRegionInfoForState, getRepresentativeStateInfo, getStatesInRegion } from './regionsLanguages';
