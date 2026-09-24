/**
 * src/utils/signupTemplates.js
 * Shared labels/defaults for the two Sign-Up Sheet templates (Volunteer
 * Shifts, Potluck Dishes) -- one "Sheet -> Slots -> Entries" system under
 * the hood (server/signups.js), just different fields shown per template.
 *
 * getDefaultSignupType mirrors routes/signups.js's own defaultSignupType()
 * exactly -- kept in sync by hand since one's server-side JS and the other
 * client-side, but both are one line and change together if the mapping
 * ever does. The server is authoritative (GET /api/signups/default-type);
 * this copy is only for an instant default before that request returns.
 */

export function getDefaultSignupType(orgCategory) {
  return orgCategory === 'temple' ? 'volunteer' : 'potluck';
}

export const SHEET_TYPE_LABELS = {
  volunteer: {
    icon: '🙋',
    label: 'Volunteer Shifts',
    desc: 'Coordinate event-day help -- setup, arrangements, cleanup, and more.',
    slotNoun: 'shift',
    joinCta: "I'll help with this",
  },
  potluck: {
    icon: '🍽️',
    label: 'Potluck Dishes',
    desc: 'Coordinate who brings what -- by category, so nothing doubles up.',
    slotNoun: 'category',
    joinCta: '+ Bring a dish',
  },
};
