/**
 * src/utils/organizationCategories.js
 * Single source of truth for the "what kind of organization is this?"
 * taxonomy -- shared by OnboardingWizard.jsx (signup, step 1),
 * PremiumSettings.jsx (change org type later), and PlatformDashboard.jsx
 * (super-admin org list). The Explore/Radar page (pages/PublicRadarPage.jsx)
 * keeps its own CATEGORY_LABELS/CATEGORY_META because it needs lucide-react
 * icon *components* for tiles rather than emoji, but its labels are kept in
 * sync with ORG_CATEGORY_INFO below by hand -- see the comment there.
 *
 * Grouped (not flat) because this list is long: a temple/nonprofit/school/
 * restaurant/regional-association picker reads much better sectioned than
 * as one 20+ item wall.
 */

export const ORG_CATEGORY_INFO = {
  // Worship
  temple: { icon: '🕉️', label: 'Temple', desc: 'A Hindu temple or place of worship' },

  // Schools & Wellness
  dance_school: { icon: '💃', label: 'Dance School', desc: 'Teaches Indian classical or folk dance' },
  music_school: { icon: '🎵', label: 'Music School', desc: 'Teaches Indian classical, folk, or contemporary music' },
  yoga_school: { icon: '🧘', label: 'Yoga School', desc: 'Yoga studio, teacher, or wellness school' },

  // Food & Retail
  restaurant: { icon: '🍽️', label: 'Restaurant', desc: 'An Indian restaurant, catering, or food business' },
  grocery: { icon: '🛒', label: 'Grocery Store', desc: 'An Indian or South Asian grocery store' },

  // Regional & Language Associations
  telugu_association: { icon: '🤝', label: 'Telugu Association', desc: 'A Telugu cultural and community association' },
  kannada_koota: { icon: '🤝', label: 'Kannada Koota', desc: 'A Kannada cultural and community association (koota)' },
  tamil_sangam: { icon: '🤝', label: 'Tamil Sangam', desc: 'A Tamil cultural and community association (sangam)' },
  malayalee_association: { icon: '🤝', label: 'Malayalee Association', desc: 'A Malayalee (Kerala) cultural and community association' },
  bengali_association: { icon: '🤝', label: 'Bengali Association', desc: 'A Bengali cultural and community association' },
  odisha_association: { icon: '🤝', label: 'Odisha Association', desc: 'An Odia cultural and community association' },
  hindi_association: { icon: '🤝', label: 'Hindi Association', desc: 'A Hindi-speaking cultural and community association' },
  gujarati_association: { icon: '🤝', label: 'Gujarati Samaj', desc: 'A Gujarati cultural and community association (samaj)' },
  marathi_association: { icon: '🤝', label: 'Marathi Mandal', desc: 'A Marathi cultural and community association (mandal)' },
  punjabi_association: { icon: '🤝', label: 'Punjabi Association', desc: 'A Punjabi cultural and community association' },
  pan_india_association: { icon: '🇮🇳', label: 'Pan-India Association', desc: 'Serves the broader Indian community across all regions' },

  // Community & Events
  community: { icon: '🏘️', label: 'Community Org', desc: 'A cultural center, club, or community group' },
  mela_fair_organizer: { icon: '🎪', label: 'Mela / Fair Organizer', desc: 'Organizes melas, fairs, or large multi-vendor community events' },
  nonprofit: { icon: '💛', label: 'Nonprofit', desc: 'A registered nonprofit or charity' },

  // Other
  other: { icon: '✨', label: 'Other', desc: 'Something else entirely' },
};

export const ORG_CATEGORY_GROUPS = [
  { title: 'Worship', keys: ['temple'] },
  { title: 'Schools & Wellness', keys: ['dance_school', 'music_school', 'yoga_school'] },
  { title: 'Food & Retail', keys: ['restaurant', 'grocery'] },
  {
    title: 'Regional & Language Associations',
    keys: [
      'telugu_association', 'kannada_koota', 'tamil_sangam', 'malayalee_association',
      'bengali_association', 'odisha_association', 'hindi_association',
      'gujarati_association', 'marathi_association', 'punjabi_association',
      'pan_india_association',
    ],
  },
  { title: 'Community & Events', keys: ['community', 'mela_fair_organizer', 'nonprofit'] },
  { title: 'Other', keys: ['other'] },
];

// Flat key -> label map, for places that just need display text (e.g.
// PlatformDashboard.jsx's org list) rather than the full grouped picker.
export const ORG_CATEGORY_LABELS = Object.fromEntries(
  Object.entries(ORG_CATEGORY_INFO).map(([key, info]) => [key, info.label])
);

// A flat, grouped-order array of {key, ...info} -- handy for anything that
// wants "all categories in a sensible order" without the group headers.
export const ORG_CATEGORIES = ORG_CATEGORY_GROUPS.flatMap((g) => g.keys).map((key) => ({
  key,
  ...ORG_CATEGORY_INFO[key],
}));
