/**
 * eventTemplates.js
 * Default "starter" calendar events for each organization category
 * (temple / nonprofit / community / other). Dates are computed relative to
 * today so every template always lands on the next upcoming occurrence —
 * this year if it hasn't happened yet, otherwise next year.
 *
 * These are meant purely as a helpful starting point: admins can edit or
 * delete any of them after they're added, and adding a template never
 * removes existing events.
 */

function pad(n) { return String(n).padStart(2, '0'); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Next occurrence of a fixed month/day (month is 1-12), rolling to next year if already passed.
function nextFixedDate(month, day, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const year = today.getFullYear();
  let candidate = new Date(year, month - 1, day);
  if (candidate < today) candidate = new Date(year + 1, month - 1, day);
  return toISODate(candidate);
}

// The nth weekday (0=Sun..6=Sat) of a given month (1-12) in a given year. n: 1-5, or -1 for the last one.
function nthWeekdayOfMonth(year, month, weekday, n) {
  if (n === -1) {
    const last = new Date(year, month, 0); // last day of the month
    const offset = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month - 1, last.getDate() - offset);
  }
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

// Next occurrence of "nth weekday of month", rolling to next year if already passed.
function nextNthWeekday(month, weekday, n, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const year = today.getFullYear();
  let candidate = nthWeekdayOfMonth(year, month, weekday, n);
  if (candidate < today) candidate = nthWeekdayOfMonth(year + 1, month, weekday, n);
  return toISODate(candidate);
}

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

const LUNAR_NOTE = 'Approximate date — please confirm against the panchang and adjust if needed.';

function buildTemple() {
  return [
    { title: 'Makar Sankranti', type: 'festival', date: nextFixedDate(1, 14), description: "Harvest festival marking the sun's transit into Capricorn." },
    { title: 'Maha Shivaratri', type: 'pooja', date: nextFixedDate(2, 26), description: LUNAR_NOTE },
    { title: 'Ugadi / Telugu New Year', type: 'festival', date: nextFixedDate(3, 30), description: LUNAR_NOTE },
    { title: 'Rama Navami', type: 'festival', date: nextFixedDate(4, 6), description: LUNAR_NOTE },
    { title: 'Krishna Janmashtami', type: 'festival', date: nextFixedDate(8, 26), description: LUNAR_NOTE },
    { title: 'Ganesh Chaturthi', type: 'festival', date: nextFixedDate(9, 6), description: LUNAR_NOTE },
    { title: 'Navratri Begins', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildNonprofit() {
  return [
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(7, 4), description: '' },
    { title: 'Community Picnic', type: 'festival', date: nextNthWeekday(7, SAT, 2), description: '' },
    { title: 'Kannada Rajyotsava', type: 'festival', date: nextFixedDate(11, 1), description: 'Karnataka Formation Day.' },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 12), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Volunteer Appreciation Day', type: 'festival', date: nextNthWeekday(4, FRI, 3), description: '' },
    { title: 'Annual Fundraising Gala', type: 'festival', date: nextNthWeekday(10, SAT, 1), description: '' },
    { title: 'Thanksgiving Food Drive', type: 'festival', date: nextNthWeekday(11, SAT, 3), description: '' },
    { title: 'Year-End Giving Campaign Kickoff', type: 'festival', date: nextFixedDate(12, 1), description: '' },
  ];
}

function buildCommunity() {
  return [
    { title: "Mother's Day", type: 'festival', date: nextNthWeekday(5, SUN, 2), description: '' },
    { title: "Father's Day", type: 'festival', date: nextNthWeekday(6, SUN, 3), description: '' },
    { title: 'Community Camping Trip', type: 'festival', date: nextNthWeekday(7, SAT, 3), description: '' },
    { title: 'Neighborhood Cleanup Day', type: 'festival', date: nextNthWeekday(4, SAT, 1), description: '' },
    { title: 'Summer Kickoff BBQ', type: 'festival', date: nextNthWeekday(5, SAT, -1), description: '' },
    { title: 'Fall Festival', type: 'festival', date: nextNthWeekday(10, SAT, 2), description: '' },
    { title: 'Holiday Potluck', type: 'festival', date: nextNthWeekday(12, SAT, 2), description: '' },
    { title: "New Year's Eve Gathering", type: 'festival', date: nextFixedDate(12, 31), description: '' },
  ];
}

function buildOther() {
  return [
    { title: "New Year's Day", type: 'holiday', date: nextFixedDate(1, 1), description: '' },
    { title: 'Martin Luther King Jr. Day', type: 'holiday', date: nextNthWeekday(1, MON, 3), description: '' },
    { title: 'Presidents Day', type: 'holiday', date: nextNthWeekday(2, MON, 3), description: '' },
    { title: 'Memorial Day', type: 'holiday', date: nextNthWeekday(5, MON, -1), description: '' },
    { title: 'Juneteenth', type: 'holiday', date: nextFixedDate(6, 19), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(7, 4), description: '' },
    { title: 'Labor Day', type: 'holiday', date: nextNthWeekday(9, MON, 1), description: '' },
    { title: 'Veterans Day', type: 'holiday', date: nextFixedDate(11, 11), description: '' },
    { title: 'Thanksgiving Day', type: 'holiday', date: nextNthWeekday(11, THU, 4), description: '' },
    { title: 'Christmas Day', type: 'holiday', date: nextFixedDate(12, 25), description: '' },
  ];
}

export const CATEGORY_TEMPLATE_LABELS = {
  temple: 'Temple',
  nonprofit: 'Nonprofit',
  community: 'Community Org',
  other: 'Other',
};

// Short human-readable preview of what each template includes, shown before the user confirms.
export const CATEGORY_TEMPLATE_PREVIEW = {
  temple: 'Makar Sankranti, Maha Shivaratri, Ugadi, Rama Navami, Krishna Janmashtami, Ganesh Chaturthi, Navratri, Deepavali',
  nonprofit: 'Independence Day, Community Picnic, Kannada Rajyotsava, Deepavali, Volunteer Appreciation Day, Fundraising Gala, and more',
  community: "Mother's Day, Father's Day, Community Camping Trip, Fall Festival, Neighborhood Cleanup, Holiday Potluck, and more",
  other: "New Year's Day, MLK Day, Memorial Day, Independence Day, Labor Day, Veterans Day, Thanksgiving, Christmas, and more",
};

export function getTemplateEvents(category) {
  switch (category) {
    case 'temple': return buildTemple();
    case 'nonprofit': return buildNonprofit();
    case 'community': return buildCommunity();
    case 'other': return buildOther();
    default: return [];
  }
}
