// ─── AI Image Prompt Library — Community / Nonprofit / Other Orgs ───────────
// Keyword-matched prompts for non-temple event flyers. Deliberately contains
// NO religious/deity imagery — used for org categories 'nonprofit',
// 'community', and 'other'. Professional stock-photography style only.
// (See promptLibrary.js for the Hindu-temple-specific deity/festival library.)

const BASE_STYLE = `professional high-quality stock photography style, warm natural lighting, diverse group of people in modest professional or festive attire, joyful and welcoming atmosphere, 4K resolution, highly detailed, sharp focus, vibrant but natural colors, centered composition, empty space at top and bottom for text overlays, NO TEXT in image, NO WORDS, NO LETTERS, family-friendly, suitable for all ages`;

const COMMUNITY_PROMPT_LIBRARY = [
  {
    keywords: ['festival', 'fest', 'fair', 'carnival', 'celebration'],
    name: "🎉 Community Festival",
    prompt: `Vibrant outdoor community festival scene, strings of warm string lights overhead, colorful decorations and banners (no readable text), food and craft stalls in the background, a diverse crowd of happy people mingling and celebrating together, string lights and paper lanterns, golden evening light, joyful festive atmosphere`,
  },
  {
    keywords: ['charity', 'fundraiser', 'fund raiser', 'gala', 'banquet'],
    name: "🎗️ Charity Gala / Fundraiser",
    prompt: `Elegant charity fundraiser gala scene, round tables with simple floral centerpieces in a banquet hall, warm ambient lighting, a diverse group of well-dressed guests mingling and toasting, soft bokeh lights in the background, sophisticated and welcoming atmosphere, warm gold and cream color palette`,
  },
  {
    keywords: ['volunteer', 'outreach', 'service', 'community service'],
    name: "🤝 Volunteer / Community Service",
    prompt: `Diverse group of volunteers working together outdoors, packing donation boxes and smiling, wearing casual matching t-shirts, warm daylight, sense of teamwork and community spirit, bright and uplifting mood, no visible logos or text`,
  },
  {
    keywords: ['award', 'recognition', 'ceremony', 'honor', 'achievement'],
    name: "🏆 Award / Recognition Ceremony",
    prompt: `Formal community recognition ceremony on a small stage, a person receiving a trophy or certificate with warm applause from a seated audience, soft stage lighting, elegant backdrop with subtle drapery, professional and celebratory atmosphere, warm golden light`,
  },
  {
    keywords: ['parade', 'procession', 'march'],
    name: "🎊 Parade / Procession",
    prompt: `Colorful community parade moving down a decorated street, cheerful diverse crowd of onlookers waving, banners and streamers fluttering (no readable text), bright daytime lighting, festive and energetic atmosphere, confetti in the air`,
  },
  {
    keywords: ['dance', 'performance', 'concert', 'music', 'show'],
    name: "🎭 Performance / Cultural Show",
    prompt: `Traditional cultural dance performance on an outdoor stage at dusk, performers in colorful festive attire mid-motion, warm stage lighting with soft spotlights, an engaged audience seated in front, vibrant and joyful atmosphere, rich warm colors`,
  },
  {
    keywords: ['picnic', 'potluck', 'reunion', 'get-together', 'gettogether', 'social'],
    name: "🧺 Community Picnic / Potluck",
    prompt: `Sunny outdoor community picnic in a park, diverse families gathered around picnic tables filled with food, children playing on green grass in the background, warm afternoon sunlight, relaxed and joyful atmosphere, natural green and gold tones`,
  },
  {
    keywords: ['workshop', 'conference', 'meeting', 'seminar', 'training'],
    name: "📋 Workshop / Community Meeting",
    prompt: `Bright modern community hall with a diverse group of people seated in a semi-circle attentively listening to a speaker, natural daylight through large windows, welcoming and professional atmosphere, warm neutral tones, no readable text or signage`,
  },
  {
    keywords: ['graduation', 'youth', 'program', 'education', 'scholarship'],
    name: "🎓 Youth Program / Graduation",
    prompt: `Joyful youth graduation or achievement program, diverse group of young people in simple formal attire smiling and celebrating together outdoors, soft warm sunlight, sense of pride and accomplishment, bright cheerful color palette`,
  },
  {
    keywords: ['anniversary', 'jubilee', 'milestone'],
    name: "🎇 Anniversary Celebration",
    prompt: `Warm anniversary celebration scene, elegant string lights and simple floral decor in a community hall, a diverse group of people gathered and toasting together, soft golden lighting, nostalgic and celebratory atmosphere`,
  },
  {
    keywords: ['lights', 'decoration', 'decorations', 'evening', 'night'],
    name: "✨ Festive Lights & Decor",
    prompt: `Beautifully decorated event space with strings of warm fairy lights, simple floral garlands, and soft draped fabric, empty of people, inviting and festive atmosphere, warm golden glow, elegant and welcoming`,
  },
  // ── Default ─────────────────────────────────────────────────────────────
  {
    keywords: [],
    name: "✨ Default (General Celebration)",
    prompt: `Warm community celebration scene, diverse group of smiling people gathered together outdoors under string lights, simple festive decorations, golden hour lighting, joyful and welcoming atmosphere`,
  },
];

/**
 * Auto-selects the best prompt based on the event title and type.
 * Falls back to the default general-celebration prompt if no keywords match.
 */
export const buildCommunityPrompt = (event) => {
  const combined = `${(event?.title || '')} ${(event?.type || '')}`.toLowerCase();

  const match = COMMUNITY_PROMPT_LIBRARY.find(p =>
    p.keywords.length > 0 && p.keywords.some(kw => combined.includes(kw))
  ) || COMMUNITY_PROMPT_LIBRARY[COMMUNITY_PROMPT_LIBRARY.length - 1];

  return `${match.prompt}. ${BASE_STYLE}`;
};
export const COMMUNITY_PROMPT_LIBRARY_OPTIONS = COMMUNITY_PROMPT_LIBRARY.map(p => p.name);
export const getCommunityPromptByName = (name) => {
  const match = COMMUNITY_PROMPT_LIBRARY.find(p => p.name === name);
  if (!match) return '';
  return `${match.prompt}. ${BASE_STYLE}`;
};
