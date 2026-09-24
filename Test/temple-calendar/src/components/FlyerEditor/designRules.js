// ─── Design Rules — CalendarFly Poster Engine ──────────────────────────────
// Generated from CalendarFly_Poster_Engine_Master_Knowledge_Base.xlsx
// ("Design Rules" sheet, 15 records). Production-tested guardrails (dates,
// sacred imagery/text, regional-motif purity, representation, color,
// AI-image verification, etc.) — feeds compileBackgroundPrompt()'s CULTURAL
// REQUIREMENTS section in posterSpec.js with real, specific rules instead
// of generic filler like "represent the tradition accurately".

export const DESIGN_RULES = [
  {
    "area": "Accuracy",
    "topic": "Dates",
    "principle": "Never publish from the typical-window field alone.",
    "check": "Verify with an authoritative Panchang/religious calendar, state notice, and local organizer."
  },
  {
    "area": "Accuracy",
    "topic": "Names",
    "principle": "Use the local spelling and accepted regional name.",
    "check": "Have a native-language reviewer check spelling, honorifics, and transliteration."
  },
  {
    "area": "Sacred imagery",
    "topic": "Deities and icons",
    "principle": "Treat sacred figures as primary devotional content, not decorative clip art.",
    "check": "Use only approved iconography; preserve proportions, attributes, and respectful placement."
  },
  {
    "area": "Sacred text",
    "topic": "Scripts",
    "principle": "Never use unreadable pseudo-script or sacred text as texture.",
    "check": "Use Unicode fonts, proof at mobile size, and verify meaning and line breaks."
  },
  {
    "area": "Regional identity",
    "topic": "Motifs",
    "principle": "One region-specific visual system is stronger than a collage.",
    "check": "Choose architecture, textile, flora, craft, or ritual objects actually associated with the location."
  },
  {
    "area": "Representation",
    "topic": "People",
    "principle": "People are optional; graphic-led posters often scale better.",
    "check": "Prefer patterns, objects, landscapes, and typographic energy when permissions or accuracy are uncertain."
  },
  {
    "area": "Tribal and Indigenous",
    "topic": "Consent",
    "principle": "Avoid treating living traditions as generic folk decoration.",
    "check": "Consult community sources; credit named art traditions and artists where appropriate."
  },
  {
    "area": "Color",
    "topic": "Contrast",
    "principle": "Festive does not mean every saturated color at once.",
    "check": "Use 2–3 core colors plus one accent; keep WCAG-aware contrast for details and CTA."
  },
  {
    "area": "Layout",
    "topic": "Hierarchy",
    "principle": "Festival → date/time → venue/link → CTA.",
    "check": "Keep a single hero zone and a quiet information zone; do not crowd every corner."
  },
  {
    "area": "Localization",
    "topic": "Languages",
    "principle": "Prioritize the state language and the audience's reading context.",
    "check": "Use bilingual lockups where needed; do not make the local script visually subordinate by default."
  },
  {
    "area": "Photography",
    "topic": "Rights",
    "principle": "Do not imply documentary authenticity with unlicensed or incorrect images.",
    "check": "Use licensed assets, obtain releases, and caption archival/community photography."
  },
  {
    "area": "AI images",
    "topic": "Verification",
    "principle": "Generated sacred objects, hands, text, architecture, and costumes often contain errors.",
    "check": "Inspect details at 200%; replace generated text with real typography; obtain local review."
  },
  {
    "area": "Public events",
    "topic": "Utility",
    "principle": "A poster must work as an information product.",
    "check": "Include date, time, place/link, organizer, entry rules, contact, and accessibility information."
  },
  {
    "area": "Broadcast",
    "topic": "Cropping",
    "principle": "Design one adaptable system, not one fragile composition.",
    "check": "Keep text in safe zones for 1:1, 4:5, 9:16, and landscape crops."
  },
  {
    "area": "CalendarFly",
    "topic": "Product fit",
    "principle": "Connect inspiration directly to scheduling and distribution.",
    "check": "Template → annual date verification → approval → publish → reminder → analytics."
  }
];

// The subset most relevant to a single generated background image (as
// opposed to campaign-wide rules like localization or broadcast cropping,
// which matter for the full poster but not the AI image prompt itself).
const CORE_AREAS = ["Sacred imagery", "Sacred text", "Regional identity", "Representation", "Color", "AI images", "Accuracy"];

export function getCoreGuardrails() {
  return DESIGN_RULES.filter(r => CORE_AREAS.includes(r.area));
}

export function getGuardrailByTopic(topic) {
  return DESIGN_RULES.find(r => r.topic === topic) || null;
}
