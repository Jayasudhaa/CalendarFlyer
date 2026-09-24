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

// ─── Schools & Wellness ─────────────────────────────────────────────────

function buildDanceSchool() {
  return [
    { title: 'Republic Day Cultural Program', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Guru Purnima', type: 'festival', date: nextFixedDate(7, 21), description: `Traditional day to honor teachers. ${LUNAR_NOTE}` },
    { title: 'Independence Day Cultural Program', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Navratri Dance Season Begins', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Annual Recital', type: 'festival', date: nextNthWeekday(5, SAT, 2), description: '' },
    { title: 'Summer Dance Camp Begins', type: 'festival', date: nextNthWeekday(6, MON, 2), description: '' },
  ];
}

function buildMusicSchool() {
  return [
    { title: 'Republic Day Cultural Program', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Guru Purnima', type: 'festival', date: nextFixedDate(7, 21), description: `Traditional day to honor teachers. ${LUNAR_NOTE}` },
    { title: 'Independence Day Cultural Program', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Navratri Music Season Begins', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Annual Concert', type: 'festival', date: nextNthWeekday(5, SAT, 3), description: '' },
    { title: 'Winter Concert', type: 'festival', date: nextNthWeekday(12, SAT, 2), description: '' },
  ];
}

function buildYogaSchool() {
  return [
    { title: "New Year Wellness Challenge", type: 'festival', date: nextFixedDate(1, 1), description: '' },
    { title: 'Spring New Term Begins', type: 'festival', date: nextNthWeekday(3, MON, 1), description: '' },
    { title: 'International Day of Yoga', type: 'festival', date: nextFixedDate(6, 21), description: 'UN-designated global celebration of yoga.' },
    { title: 'Navratri Special Session', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Deepavali Special Class', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Winter Solstice Meditation', type: 'festival', date: nextFixedDate(12, 21), description: '' },
  ];
}

// ─── Food & Retail ──────────────────────────────────────────────────────

function buildRestaurant() {
  return [
    { title: "New Year's Day Special Menu", type: 'festival', date: nextFixedDate(1, 1), description: '' },
    { title: 'Makar Sankranti / Pongal Specials', type: 'festival', date: nextFixedDate(1, 14), description: '' },
    { title: 'Holi Special Menu', type: 'festival', date: nextFixedDate(3, 14), description: LUNAR_NOTE },
    { title: 'Independence Day Special', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Navratri Fasting Menu', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Deepavali Sweets & Catering', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Thanksgiving Catering Specials', type: 'holiday', date: nextNthWeekday(11, THU, 4), description: '' },
  ];
}

function buildGrocery() {
  return [
    { title: 'New Year Stock-Up Sale', type: 'festival', date: nextFixedDate(1, 1), description: '' },
    { title: 'Makar Sankranti / Pongal Specials', type: 'festival', date: nextFixedDate(1, 14), description: '' },
    { title: 'Holi Colors & Sweets Sale', type: 'festival', date: nextFixedDate(3, 14), description: LUNAR_NOTE },
    { title: 'Navratri Fasting Foods', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Independence Day Sale', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Deepavali Sweets & Gifting Sale', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Thanksgiving Weekend Sale', type: 'holiday', date: nextNthWeekday(11, THU, 4), description: '' },
  ];
}

// ─── Regional & Language Associations ──────────────────────────────────
// Each shares the two civic anchors common across diaspora association
// calendars (India Republic Day / Independence Day) plus that region's
// own flagship festivals. Lunar/lunisolar dates carry LUNAR_NOTE like the
// rest of this file -- these are starting points, not authoritative dates.

function buildTeluguAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Makar Sankranti', type: 'festival', date: nextFixedDate(1, 14), description: '' },
    { title: 'Ugadi / Telugu New Year', type: 'festival', date: nextFixedDate(3, 30), description: LUNAR_NOTE },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Bathukamma', type: 'festival', date: nextFixedDate(10, 3), description: `Telangana flower festival. ${LUNAR_NOTE}` },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildKannadaKoota() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Ugadi / Kannada New Year', type: 'festival', date: nextFixedDate(3, 30), description: LUNAR_NOTE },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Mysuru Dasara', type: 'festival', date: nextFixedDate(10, 12), description: LUNAR_NOTE },
    { title: 'Kannada Rajyotsava', type: 'festival', date: nextFixedDate(11, 1), description: 'Karnataka Formation Day.' },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 12), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildTamilSangam() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Thai Pongal', type: 'festival', date: nextFixedDate(1, 14), description: '' },
    { title: 'Puthandu / Tamil New Year', type: 'festival', date: nextFixedDate(4, 14), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Karthigai Deepam', type: 'festival', date: nextFixedDate(11, 25), description: LUNAR_NOTE },
  ];
}

function buildMalayaleeAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Vishu / Malayalam New Year', type: 'festival', date: nextFixedDate(4, 14), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Onam', type: 'festival', date: nextFixedDate(8, 26), description: `Kerala harvest festival. ${LUNAR_NOTE}` },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Christmas', type: 'holiday', date: nextFixedDate(12, 25), description: '' },
  ];
}

function buildBengaliAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Saraswati Puja', type: 'pooja', date: nextFixedDate(2, 3), description: LUNAR_NOTE },
    { title: 'Poila Boishakh / Bengali New Year', type: 'festival', date: nextFixedDate(4, 14), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Durga Puja', type: 'festival', date: nextFixedDate(10, 2), description: LUNAR_NOTE },
    { title: 'Kali Puja / Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildOdishaAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Pana Sankranti / Odia New Year', type: 'festival', date: nextFixedDate(4, 14), description: '' },
    { title: 'Rath Yatra', type: 'festival', date: nextFixedDate(7, 7), description: LUNAR_NOTE },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Durga Puja', type: 'festival', date: nextFixedDate(10, 2), description: LUNAR_NOTE },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildHindiAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Holi', type: 'festival', date: nextFixedDate(3, 14), description: LUNAR_NOTE },
    { title: 'Raksha Bandhan', type: 'festival', date: nextFixedDate(8, 9), description: LUNAR_NOTE },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Chhath Puja', type: 'pooja', date: nextFixedDate(11, 7), description: LUNAR_NOTE },
  ];
}

function buildGujaratiAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Uttarayan (Kite Festival)', type: 'festival', date: nextFixedDate(1, 14), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Navratri / Garba Begins', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Gujarati New Year (Bestu Varas)', type: 'festival', date: nextFixedDate(11, 2), description: LUNAR_NOTE },
  ];
}

function buildMarathiAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Gudi Padwa / Marathi New Year', type: 'festival', date: nextFixedDate(3, 30), description: LUNAR_NOTE },
    { title: 'Maharashtra Day', type: 'holiday', date: nextFixedDate(5, 1), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Ganesh Chaturthi', type: 'festival', date: nextFixedDate(9, 6), description: LUNAR_NOTE },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

function buildPunjabiAssociation() {
  return [
    { title: 'Lohri', type: 'festival', date: nextFixedDate(1, 13), description: '' },
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Baisakhi', type: 'festival', date: nextFixedDate(4, 13), description: '' },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
    { title: 'Guru Nanak Jayanti (Gurpurab)', type: 'festival', date: nextFixedDate(11, 15), description: LUNAR_NOTE },
  ];
}

function buildPanIndiaAssociation() {
  return [
    { title: 'Republic Day', type: 'holiday', date: nextFixedDate(1, 26), description: '' },
    { title: 'Holi', type: 'festival', date: nextFixedDate(3, 14), description: LUNAR_NOTE },
    { title: 'Independence Day', type: 'holiday', date: nextFixedDate(8, 15), description: '' },
    { title: 'Gandhi Jayanti', type: 'holiday', date: nextFixedDate(10, 2), description: '' },
    { title: 'Navratri Begins', type: 'festival', date: nextFixedDate(9, 22), description: LUNAR_NOTE },
    { title: 'Deepavali', type: 'festival', date: nextFixedDate(11, 1), description: `Festival of lights. ${LUNAR_NOTE}` },
  ];
}

// ─── Community & Events ─────────────────────────────────────────────────

function buildMelaFairOrganizer() {
  return [
    { title: 'Republic Day Mela', type: 'festival', date: nextFixedDate(1, 26), description: '' },
    { title: 'Vendor Registration Opens — Spring Mela', type: 'festival', date: nextNthWeekday(2, MON, 1), description: '' },
    { title: 'Spring Mela', type: 'festival', date: nextNthWeekday(4, SAT, 2), description: '' },
    { title: 'Independence Day Mela', type: 'festival', date: nextFixedDate(8, 15), description: '' },
    { title: 'Diwali Mela', type: 'festival', date: nextNthWeekday(10, SAT, 3), description: '' },
    { title: 'Winter Holiday Mela', type: 'festival', date: nextNthWeekday(12, SAT, 2), description: '' },
  ];
}

export const CATEGORY_TEMPLATE_LABELS = {
  temple: 'Temple',
  nonprofit: 'Nonprofit',
  community: 'Community Org',
  other: 'Other',
  dance_school: 'Dance School',
  music_school: 'Music School',
  yoga_school: 'Yoga School',
  restaurant: 'Restaurant',
  grocery: 'Grocery Store',
  telugu_association: 'Telugu Association',
  kannada_koota: 'Kannada Koota',
  tamil_sangam: 'Tamil Sangam',
  malayalee_association: 'Malayalee Association',
  bengali_association: 'Bengali Association',
  odisha_association: 'Odisha Association',
  hindi_association: 'Hindi Association',
  gujarati_association: 'Gujarati Samaj',
  marathi_association: 'Marathi Mandal',
  punjabi_association: 'Punjabi Association',
  pan_india_association: 'Pan-India Association',
  mela_fair_organizer: 'Mela / Fair Organizer',
};

// Short human-readable preview of what each template includes, shown before the user confirms.
export const CATEGORY_TEMPLATE_PREVIEW = {
  temple: 'Makar Sankranti, Maha Shivaratri, Ugadi, Rama Navami, Krishna Janmashtami, Ganesh Chaturthi, Navratri, Deepavali',
  nonprofit: 'Independence Day, Community Picnic, Kannada Rajyotsava, Deepavali, Volunteer Appreciation Day, Fundraising Gala, and more',
  community: "Mother's Day, Father's Day, Community Camping Trip, Fall Festival, Neighborhood Cleanup, Holiday Potluck, and more",
  other: "New Year's Day, MLK Day, Memorial Day, Independence Day, Labor Day, Veterans Day, Thanksgiving, Christmas, and more",
  dance_school: 'Republic Day Program, Guru Purnima, Independence Day Program, Navratri Season, Annual Recital, Summer Dance Camp',
  music_school: 'Republic Day Program, Guru Purnima, Independence Day Program, Navratri Season, Annual Concert, Winter Concert',
  yoga_school: 'New Year Wellness Challenge, Spring New Term, International Day of Yoga, Navratri Session, Deepavali Class, Winter Solstice Meditation',
  restaurant: "New Year's Menu, Sankranti/Pongal Specials, Holi Menu, Independence Day Special, Navratri Fasting Menu, Deepavali Sweets, Thanksgiving Catering",
  grocery: 'New Year Sale, Sankranti/Pongal Specials, Holi Sale, Navratri Fasting Foods, Independence Day Sale, Deepavali Sale, Thanksgiving Sale',
  telugu_association: 'Republic Day, Makar Sankranti, Ugadi, Independence Day, Bathukamma, Deepavali',
  kannada_koota: 'Republic Day, Ugadi, Independence Day, Mysuru Dasara, Kannada Rajyotsava, Deepavali',
  tamil_sangam: 'Republic Day, Thai Pongal, Puthandu, Independence Day, Deepavali, Karthigai Deepam',
  malayalee_association: 'Republic Day, Vishu, Independence Day, Onam, Deepavali, Christmas',
  bengali_association: 'Republic Day, Saraswati Puja, Poila Boishakh, Independence Day, Durga Puja, Kali Puja/Deepavali',
  odisha_association: 'Republic Day, Pana Sankranti, Rath Yatra, Independence Day, Durga Puja, Deepavali',
  hindi_association: 'Republic Day, Holi, Raksha Bandhan, Independence Day, Deepavali, Chhath Puja',
  gujarati_association: 'Republic Day, Uttarayan, Independence Day, Navratri/Garba, Deepavali, Bestu Varas',
  marathi_association: 'Republic Day, Gudi Padwa, Maharashtra Day, Independence Day, Ganesh Chaturthi, Deepavali',
  punjabi_association: 'Lohri, Republic Day, Baisakhi, Independence Day, Deepavali, Gurpurab',
  pan_india_association: 'Republic Day, Holi, Independence Day, Gandhi Jayanti, Navratri, Deepavali',
  mela_fair_organizer: 'Republic Day Mela, Spring Mela, Independence Day Mela, Diwali Mela, Winter Holiday Mela',
};

export function getTemplateEvents(category) {
  switch (category) {
    case 'temple': return buildTemple();
    case 'nonprofit': return buildNonprofit();
    case 'community': return buildCommunity();
    case 'other': return buildOther();
    case 'dance_school': return buildDanceSchool();
    case 'music_school': return buildMusicSchool();
    case 'yoga_school': return buildYogaSchool();
    case 'restaurant': return buildRestaurant();
    case 'grocery': return buildGrocery();
    case 'telugu_association': return buildTeluguAssociation();
    case 'kannada_koota': return buildKannadaKoota();
    case 'tamil_sangam': return buildTamilSangam();
    case 'malayalee_association': return buildMalayaleeAssociation();
    case 'bengali_association': return buildBengaliAssociation();
    case 'odisha_association': return buildOdishaAssociation();
    case 'hindi_association': return buildHindiAssociation();
    case 'gujarati_association': return buildGujaratiAssociation();
    case 'marathi_association': return buildMarathiAssociation();
    case 'punjabi_association': return buildPunjabiAssociation();
    case 'pan_india_association': return buildPanIndiaAssociation();
    case 'mela_fair_organizer': return buildMelaFairOrganizer();
    default: return [];
  }
}
