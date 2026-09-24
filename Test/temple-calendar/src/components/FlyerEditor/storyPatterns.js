// ─── Story Patterns — CalendarFly Poster Engine ────────────────────────────
// Generated from CalendarFly_Poster_Engine_Master_Knowledge_Base.xlsx
// ("Story Patterns" sheet, 25 records). Each pattern names an emotion, the
// kind of event it suits, a one-line core message, a visual metaphor, a
// suggested CTA, a tone, and a guardrail against overdoing it. Replaces the
// old hardcoded getEmotionalTone() 6-entry map in posterSpec.js with real,
// specific story guidance the wizard's new "story" step lets the user pick
// from directly instead of only inferring silently.

export const STORY_PATTERNS = [
  {
    "id": "STO-001",
    "emotion": "Belonging",
    "bestFor": "Diaspora/community",
    "coreMessage": "Home exists wherever the community gathers",
    "visualMetaphor": "Two regional patterns connected by one line",
    "cta": "Join us / RSVP",
    "tone": "Warm, inclusive",
    "guardrail": "Avoid crowd collage; use one connecting symbol"
  },
  {
    "id": "STO-002",
    "emotion": "Renewal",
    "bestFor": "New Year/festival",
    "coreMessage": "A new cycle begins",
    "visualMetaphor": "Threshold, sunrise, opening calendar",
    "cta": "Celebrate / Attend",
    "tone": "Fresh, auspicious",
    "guardrail": "Verify calendar and local symbols"
  },
  {
    "id": "STO-003",
    "emotion": "Light over darkness",
    "bestFor": "Festival/devotional",
    "coreMessage": "One light changes the space around it",
    "visualMetaphor": "Single lamp illuminating a pattern",
    "cta": "Attend / Share",
    "tone": "Cinematic, restrained",
    "guardrail": "Avoid firework clutter"
  },
  {
    "id": "STO-004",
    "emotion": "Gratitude and abundance",
    "bestFor": "Harvest",
    "coreMessage": "The season’s gifts bring people together",
    "visualMetaphor": "Grain forming a circle or calendar",
    "cta": "Celebrate",
    "tone": "Warm, abundant",
    "guardrail": "Use region-specific crops"
  },
  {
    "id": "STO-005",
    "emotion": "Journey",
    "bestFor": "Pilgrimage/learning/fitness",
    "coreMessage": "Small steps form a meaningful path",
    "visualMetaphor": "Footprints, thread, sequential marks",
    "cta": "Begin / Register",
    "tone": "Purposeful",
    "guardrail": "Do not trivialize sacred pilgrimage"
  },
  {
    "id": "STO-006",
    "emotion": "Transformation",
    "bestFor": "Fitness/education",
    "coreMessage": "Consistency changes the outcome",
    "visualMetaphor": "Broken-to-continuous line, growing grid",
    "cta": "Join challenge",
    "tone": "Energetic",
    "guardrail": "Avoid body-shaming before/after images"
  },
  {
    "id": "STO-007",
    "emotion": "Rhythm",
    "bestFor": "Dance/music",
    "coreMessage": "A story becomes visible through rhythm",
    "visualMetaphor": "Sound wave becoming footwork or pattern",
    "cta": "Book / Attend",
    "tone": "Dynamic",
    "guardrail": "Use accurate instrument/dance cues"
  },
  {
    "id": "STO-008",
    "emotion": "Devotion",
    "bestFor": "Temple/faith",
    "coreMessage": "Attention gathers around the sacred",
    "visualMetaphor": "Lamp, flower, doorway, quiet centre",
    "cta": "Participate",
    "tone": "Reverent",
    "guardrail": "Sacred figure only with approval"
  },
  {
    "id": "STO-009",
    "emotion": "Knowledge",
    "bestFor": "Class/talk",
    "coreMessage": "Learning carries tradition forward",
    "visualMetaphor": "Lamp becoming book or script line",
    "cta": "Enroll / Attend",
    "tone": "Clear, thoughtful",
    "guardrail": "No pseudo-script"
  },
  {
    "id": "STO-010",
    "emotion": "Service",
    "bestFor": "Volunteer/fundraiser",
    "coreMessage": "Each contribution completes the whole",
    "visualMetaphor": "Incomplete pattern completed by one piece",
    "cta": "Volunteer / Donate",
    "tone": "Human, practical",
    "guardrail": "Avoid exploitative imagery"
  },
  {
    "id": "STO-011",
    "emotion": "Welcome",
    "bestFor": "Open house/newcomer",
    "coreMessage": "There is a place for you here",
    "visualMetaphor": "Open doorway or unfolding circle",
    "cta": "Visit / Join",
    "tone": "Warm, simple",
    "guardrail": "Include accessibility and contact"
  },
  {
    "id": "STO-012",
    "emotion": "Anticipation",
    "bestFor": "Performance",
    "coreMessage": "The stage is about to come alive",
    "visualMetaphor": "Curtain, spotlight, instrument/dance silhouette",
    "cta": "Buy tickets",
    "tone": "Dramatic",
    "guardrail": "Preserve negative space"
  },
  {
    "id": "STO-013",
    "emotion": "Celebration",
    "bestFor": "Social/festival",
    "coreMessage": "Shared joy creates energy",
    "visualMetaphor": "Radiating motif or confetti derived from craft pattern",
    "cta": "Attend",
    "tone": "Joyful",
    "guardrail": "Limit palette and decoration"
  },
  {
    "id": "STO-014",
    "emotion": "Heritage continuity",
    "bestFor": "Arts/community",
    "coreMessage": "Tradition continues through practice",
    "visualMetaphor": "Old motif becoming a clean modern line",
    "cta": "Discover / Attend",
    "tone": "Editorial",
    "guardrail": "Credit traditions and artists"
  },
  {
    "id": "STO-015",
    "emotion": "Family connection",
    "bestFor": "Community",
    "coreMessage": "Generations share one occasion",
    "visualMetaphor": "Nested circles, linked lamps, tree rings",
    "cta": "RSVP with family",
    "tone": "Gentle",
    "guardrail": "Avoid tokenized age stereotypes"
  },
  {
    "id": "STO-016",
    "emotion": "Youth potential",
    "bestFor": "Recital/camp",
    "coreMessage": "Young voices and skills take the stage",
    "visualMetaphor": "Small marks rising into spotlight",
    "cta": "Enroll / Attend",
    "tone": "Optimistic",
    "guardrail": "Child photo permission"
  },
  {
    "id": "STO-017",
    "emotion": "Calm",
    "bestFor": "Yoga/wellness",
    "coreMessage": "Make space to breathe",
    "visualMetaphor": "Expanding circle, horizon, single leaf",
    "cta": "Book",
    "tone": "Quiet",
    "guardrail": "No medical claim"
  },
  {
    "id": "STO-018",
    "emotion": "Urgency",
    "bestFor": "Deadline/reminder",
    "coreMessage": "The opportunity is closing",
    "visualMetaphor": "Calendar page, narrowing frame, countdown number",
    "cta": "Register now",
    "tone": "Direct",
    "guardrail": "Do not manufacture scarcity"
  },
  {
    "id": "STO-019",
    "emotion": "Change notice",
    "bestFor": "Operations",
    "coreMessage": "One verified update keeps everyone aligned",
    "visualMetaphor": "Old field replaced by highlighted new field",
    "cta": "View update",
    "tone": "Clear, high contrast",
    "guardrail": "No decorative distraction"
  },
  {
    "id": "STO-020",
    "emotion": "Community impact",
    "bestFor": "Analytics/fundraiser",
    "coreMessage": "Participation becomes measurable benefit",
    "visualMetaphor": "Dots becoming an upward community pattern",
    "cta": "Support / View impact",
    "tone": "Credible",
    "guardrail": "Use real numbers only"
  },
  {
    "id": "STO-021",
    "emotion": "Cultural bridge",
    "bestFor": "Diaspora/intercultural",
    "coreMessage": "Traditions travel and create new connections",
    "visualMetaphor": "Bridge made from textile or music lines",
    "cta": "Join",
    "tone": "Modern cultural",
    "guardrail": "Avoid flags as the only identity"
  },
  {
    "id": "STO-022",
    "emotion": "Season and nature",
    "bestFor": "Monsoon/spring",
    "coreMessage": "The changing season changes community rhythm",
    "visualMetaphor": "Cloud/rain/flower line becoming event frame",
    "cta": "Celebrate",
    "tone": "Atmospheric",
    "guardrail": "Use local ecology"
  },
  {
    "id": "STO-023",
    "emotion": "Recognition",
    "bestFor": "Awards/volunteer",
    "coreMessage": "Contribution deserves visibility",
    "visualMetaphor": "One highlighted tile in a community mosaic",
    "cta": "Nominate / Attend",
    "tone": "Dignified",
    "guardrail": "Confirm names and titles"
  },
  {
    "id": "STO-024",
    "emotion": "Invitation",
    "bestFor": "Wedding/social",
    "coreMessage": "A meaningful moment is shared by invitation",
    "visualMetaphor": "Opening floral/architectural frame",
    "cta": "RSVP",
    "tone": "Elegant",
    "guardrail": "Use family-selected cultural language"
  },
  {
    "id": "STO-025",
    "emotion": "Repeat tradition",
    "bestFor": "Recurring event",
    "coreMessage": "A familiar celebration returns, improved",
    "visualMetaphor": "Previous year’s motif gaining a new date ring",
    "cta": "Save date",
    "tone": "Confident",
    "guardrail": "Never carry forward old facts automatically"
  }
];

// Which story patterns best suit each poster intent (see posterSpec.js's
// INTENT_OPTIONS) — curated from the "Best for" column rather than an exact
// string match, since intents and "Best for" phrases don't line up 1:1.
const INTENT_STORY_MAP = {
  "invitation": [
    "STO-024",
    "STO-011",
    "STO-001"
  ],
  "reminder": [
    "STO-018",
    "STO-025"
  ],
  "thank_you": [
    "STO-004",
    "STO-023",
    "STO-010"
  ],
  "fundraising": [
    "STO-010",
    "STO-020"
  ],
  "celebration_announcement": [
    "STO-002",
    "STO-003",
    "STO-013",
    "STO-008",
    "STO-014"
  ],
  "general_update": [
    "STO-019",
    "STO-009"
  ]
};

export function getStoryById(id) {
  return STORY_PATTERNS.find(s => s.id === id) || null;
}

/**
 * Story options worth offering for a given poster intent, most-suited
 * first. Falls back to the full list if the intent has no curated mapping.
 */
export function getStoryOptionsForIntent(intent) {
  const ids = INTENT_STORY_MAP[intent];
  if (!ids || !ids.length) return STORY_PATTERNS.slice(0, 6);
  return ids.map(id => getStoryById(id)).filter(Boolean);
}

/** Default story pick for an intent — the first (best-suited) option. */
export function matchStoryPattern(intent) {
  return getStoryOptionsForIntent(intent)[0] || null;
}
