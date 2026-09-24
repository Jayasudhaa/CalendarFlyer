// ─── Festival Intelligence — CalendarFly Poster Engine ─────────────────────
// Generated from CalendarFly_Poster_Engine_Master_Knowledge_Base.xlsx
// ("Festival Intelligence" sheet, 108 records). Each entry ties a named
// festival to its home state/region, typical annual window, real approved
// visual motifs and a real suggested color palette (hex) — used to replace
// generic filler in posterSpec.js's prompt compiler with grounded, specific
// cultural design guidance instead of guesses.
//
// This is design intelligence to speed up and inform poster creation, not a
// religious/scholarly authority — dates and cultural specifics should still
// be locally verified before a campaign goes out (see designRules.js and
// each record's `dateRule`).

// Fields shared across every record (see Design Rules sheet for the fuller
// guardrail set) — kept once here instead of repeated 108 times.
export const FESTIVAL_SHARED = {
  "typography": "Use a display face inspired by regional lettering only if legible; pair with a clean sans serif for details.",
  "requiredFields": "Festival name · date/time · venue or online link · organizer · CTA/contact · accessibility/entry note",
  "headlineApproach": "Use a short local greeting plus a plain-language invitation; keep the festival name dominant.",
  "guardrails": "Avoid costume stereotypes, mixed-region motifs, decorative sacred text, incorrect deity/ritual imagery, and dates copied from a prior year.",
  "validation": "Draft design intelligence; culturally validate with a local reviewer before campaign launch."
};

export const FESTIVALS = [
  {
    "id": "CF-001",
    "name": "Ugadi",
    "state": "Andhra Pradesh",
    "region": "South",
    "window": "Mar–Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Telugu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-002",
    "name": "Tirupati Brahmotsavam",
    "state": "Andhra Pradesh",
    "region": "South",
    "window": "Sep–Oct",
    "family": "Temple",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Telugu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-003",
    "name": "Sankranti",
    "state": "Andhra Pradesh",
    "region": "South",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Telugu",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-004",
    "name": "Losar",
    "state": "Arunachal Pradesh",
    "region": "Northeast",
    "window": "Feb–Mar",
    "family": "Buddhist",
    "meaning": "devotion, reflection, community tradition",
    "motifs": "prayer flags, lotus, wheel, monastery geometry",
    "paletteHex": [
      "#B23A48",
      "#E9C46A",
      "#264653"
    ],
    "composition": "quiet hierarchy; respectful sacred negative space",
    "language": "English + local language",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-005",
    "name": "Dree",
    "state": "Arunachal Pradesh",
    "region": "Northeast",
    "window": "Jul",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "English + local language",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-006",
    "name": "Solung",
    "state": "Arunachal Pradesh",
    "region": "Northeast",
    "window": "Sep",
    "family": "Agrarian",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English + local language",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-007",
    "name": "Magh Bihu",
    "state": "Assam",
    "region": "Northeast",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Assamese",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-008",
    "name": "Bohag Bihu",
    "state": "Assam",
    "region": "Northeast",
    "window": "Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Assamese",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-009",
    "name": "Kati Bihu",
    "state": "Assam",
    "region": "Northeast",
    "window": "Oct",
    "family": "Agrarian",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Assamese",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-010",
    "name": "Chhath Puja",
    "state": "Bihar",
    "region": "East",
    "window": "Oct–Nov",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Hindi / Maithili / Bhojpuri",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-011",
    "name": "Sama-Chakeva",
    "state": "Bihar",
    "region": "East",
    "window": "Nov",
    "family": "Folk",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Maithili / Bhojpuri",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-012",
    "name": "Makar Sankranti",
    "state": "Bihar",
    "region": "East",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Hindi / Maithili / Bhojpuri",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-013",
    "name": "Bastar Dussehra",
    "state": "Chhattisgarh",
    "region": "Central",
    "window": "Jul–Oct",
    "family": "Tribal-Ceremonial",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Chhattisgarhi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-014",
    "name": "Hareli",
    "state": "Chhattisgarh",
    "region": "Central",
    "window": "Jul–Aug",
    "family": "Agrarian",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Chhattisgarhi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-015",
    "name": "Madai Festival",
    "state": "Chhattisgarh",
    "region": "Central",
    "window": "Dec–Mar",
    "family": "Tribal-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Chhattisgarhi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-016",
    "name": "Goa Carnival",
    "state": "Goa",
    "region": "West",
    "window": "Feb–Mar",
    "family": "Community",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Konkani / English",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-017",
    "name": "Shigmo",
    "state": "Goa",
    "region": "West",
    "window": "Mar",
    "family": "Spring",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "flower bursts, powder clouds, music rhythm, foliage",
    "paletteHex": [
      "#E91E63",
      "#FFCA28",
      "#26A69A"
    ],
    "composition": "playful motion; controlled color zones; maintain text contrast",
    "language": "Konkani / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-018",
    "name": "São João",
    "state": "Goa",
    "region": "West",
    "window": "Jun",
    "family": "Monsoon",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "swings, clouds, rain lines, leaves, mehndi geometry",
    "paletteHex": [
      "#2A9D8F",
      "#457B9D",
      "#F4A261"
    ],
    "composition": "vertical rhythm; cool base with warm festive accent",
    "language": "Konkani / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-019",
    "name": "Uttarayan",
    "state": "Gujarat",
    "region": "West",
    "window": "Jan",
    "family": "Seasonal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Gujarati",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-020",
    "name": "Navratri Garba",
    "state": "Gujarat",
    "region": "West",
    "window": "Sep–Oct",
    "family": "Devotional-Dance",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "dandiya/garba circle, mirror-work geometry, lamp",
    "paletteHex": [
      "#D81B60",
      "#FFB300",
      "#1565C0"
    ],
    "composition": "kinetic circular rhythm; high-energy type",
    "language": "Gujarati",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-021",
    "name": "Rann Utsav",
    "state": "Gujarat",
    "region": "West",
    "window": "Nov–Feb",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Gujarati",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-022",
    "name": "Lohri",
    "state": "Haryana",
    "region": "North",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Hindi / Haryanvi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-023",
    "name": "Teej",
    "state": "Haryana",
    "region": "North",
    "window": "Jul–Aug",
    "family": "Monsoon",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "swings, clouds, rain lines, leaves, mehndi geometry",
    "paletteHex": [
      "#2A9D8F",
      "#457B9D",
      "#F4A261"
    ],
    "composition": "vertical rhythm; cool base with warm festive accent",
    "language": "Hindi / Haryanvi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-024",
    "name": "Gita Jayanti",
    "state": "Haryana",
    "region": "North",
    "window": "Nov–Dec",
    "family": "Spiritual",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Haryanvi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-025",
    "name": "Mandi Shivratri",
    "state": "Himachal Pradesh",
    "region": "North",
    "window": "Feb–Mar",
    "family": "Temple-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Pahari",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-026",
    "name": "Minjar Fair",
    "state": "Himachal Pradesh",
    "region": "North",
    "window": "Jul–Aug",
    "family": "Harvest-Fair",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Hindi / Pahari",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-027",
    "name": "Kullu Dussehra",
    "state": "Himachal Pradesh",
    "region": "North",
    "window": "Oct",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Pahari",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-028",
    "name": "Sarhul",
    "state": "Jharkhand",
    "region": "East",
    "window": "Mar–Apr",
    "family": "Nature-Tribal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Santali / regional",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-029",
    "name": "Karam",
    "state": "Jharkhand",
    "region": "East",
    "window": "Aug–Sep",
    "family": "Nature-Tribal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Santali / regional",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-030",
    "name": "Sohrai",
    "state": "Jharkhand",
    "region": "East",
    "window": "Oct–Nov",
    "family": "Harvest-Art",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Hindi / Santali / regional",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-031",
    "name": "Ugadi",
    "state": "Karnataka",
    "region": "South",
    "window": "Mar–Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Kannada",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-032",
    "name": "Mysuru Dasara",
    "state": "Karnataka",
    "region": "South",
    "window": "Sep–Oct",
    "family": "Royal-Cultural",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Kannada",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-033",
    "name": "Karaga",
    "state": "Karnataka",
    "region": "South",
    "window": "Mar–Apr",
    "family": "Temple",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Kannada",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-034",
    "name": "Vishu",
    "state": "Kerala",
    "region": "South",
    "window": "Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Malayalam",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-035",
    "name": "Onam",
    "state": "Kerala",
    "region": "South",
    "window": "Aug–Sep",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Malayalam",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-036",
    "name": "Thrissur Pooram",
    "state": "Kerala",
    "region": "South",
    "window": "Apr–May",
    "family": "Temple",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Malayalam",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-037",
    "name": "Bhagoria",
    "state": "Madhya Pradesh",
    "region": "Central",
    "window": "Mar",
    "family": "Tribal-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-038",
    "name": "Khajuraho Dance Festival",
    "state": "Madhya Pradesh",
    "region": "Central",
    "window": "Feb",
    "family": "Cultural-Arts",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-039",
    "name": "Lokrang",
    "state": "Madhya Pradesh",
    "region": "Central",
    "window": "Jan",
    "family": "Folk-Arts",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-040",
    "name": "Gudi Padwa",
    "state": "Maharashtra",
    "region": "West",
    "window": "Mar–Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Marathi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-041",
    "name": "Ganesh Chaturthi",
    "state": "Maharashtra",
    "region": "West",
    "window": "Aug–Sep",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Marathi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-042",
    "name": "Pandharpur Wari",
    "state": "Maharashtra",
    "region": "West",
    "window": "Jun–Jul",
    "family": "Pilgrimage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Marathi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-043",
    "name": "Yaoshang",
    "state": "Manipur",
    "region": "Northeast",
    "window": "Mar",
    "family": "Spring",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "flower bursts, powder clouds, music rhythm, foliage",
    "paletteHex": [
      "#E91E63",
      "#FFCA28",
      "#26A69A"
    ],
    "composition": "playful motion; controlled color zones; maintain text contrast",
    "language": "Meitei / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-044",
    "name": "Lai Haraoba",
    "state": "Manipur",
    "region": "Northeast",
    "window": "Apr–May",
    "family": "Ritual-Cultural",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Meitei / English",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-045",
    "name": "Ningol Chakouba",
    "state": "Manipur",
    "region": "Northeast",
    "window": "Oct–Nov",
    "family": "Family",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Meitei / English",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-046",
    "name": "Shad Suk Mynsiem",
    "state": "Meghalaya",
    "region": "Northeast",
    "window": "Apr",
    "family": "Cultural-Dance",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English / Khasi / Garo",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-047",
    "name": "Wangala",
    "state": "Meghalaya",
    "region": "Northeast",
    "window": "Nov",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "English / Khasi / Garo",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-048",
    "name": "Nongkrem Dance Festival",
    "state": "Meghalaya",
    "region": "Northeast",
    "window": "Oct–Nov",
    "family": "Cultural-Dance",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English / Khasi / Garo",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-049",
    "name": "Chapchar Kut",
    "state": "Mizoram",
    "region": "Northeast",
    "window": "Mar",
    "family": "Spring",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "flower bursts, powder clouds, music rhythm, foliage",
    "paletteHex": [
      "#E91E63",
      "#FFCA28",
      "#26A69A"
    ],
    "composition": "playful motion; controlled color zones; maintain text contrast",
    "language": "Mizo / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-050",
    "name": "Mim Kut",
    "state": "Mizoram",
    "region": "Northeast",
    "window": "Aug–Sep",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Mizo / English",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-051",
    "name": "Pawl Kut",
    "state": "Mizoram",
    "region": "Northeast",
    "window": "Dec",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Mizo / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-052",
    "name": "Sekrenyi",
    "state": "Nagaland",
    "region": "Northeast",
    "window": "Feb",
    "family": "Community",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English + local language",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-053",
    "name": "Moatsu",
    "state": "Nagaland",
    "region": "Northeast",
    "window": "May",
    "family": "Agrarian",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English + local language",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-054",
    "name": "Hornbill Festival",
    "state": "Nagaland",
    "region": "Northeast",
    "window": "Dec",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English + local language",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-055",
    "name": "Raja Parba",
    "state": "Odisha",
    "region": "East",
    "window": "Jun",
    "family": "Seasonal-Women",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Odia",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-056",
    "name": "Rath Yatra",
    "state": "Odisha",
    "region": "East",
    "window": "Jun–Jul",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Odia",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-057",
    "name": "Nuakhai",
    "state": "Odisha",
    "region": "East",
    "window": "Aug–Sep",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Odia",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-058",
    "name": "Lohri",
    "state": "Punjab",
    "region": "North",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Punjabi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-059",
    "name": "Baisakhi",
    "state": "Punjab",
    "region": "North",
    "window": "Apr",
    "family": "Harvest-New Year",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Punjabi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-060",
    "name": "Gurpurab",
    "state": "Punjab",
    "region": "North",
    "window": "Oct–Nov",
    "family": "Sikh",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "gurdwara silhouette, saffron flag, community meal motifs",
    "paletteHex": [
      "#F59E0B",
      "#1D4ED8",
      "#FFFFFF"
    ],
    "composition": "dignified symmetry; service and community emphasis",
    "language": "Punjabi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-061",
    "name": "Gangaur",
    "state": "Rajasthan",
    "region": "West",
    "window": "Mar–Apr",
    "family": "Devotional-Women",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Hindi / Rajasthani",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-062",
    "name": "Teej",
    "state": "Rajasthan",
    "region": "West",
    "window": "Jul–Aug",
    "family": "Monsoon",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "swings, clouds, rain lines, leaves, mehndi geometry",
    "paletteHex": [
      "#2A9D8F",
      "#457B9D",
      "#F4A261"
    ],
    "composition": "vertical rhythm; cool base with warm festive accent",
    "language": "Hindi / Rajasthani",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-063",
    "name": "Pushkar Fair",
    "state": "Rajasthan",
    "region": "West",
    "window": "Oct–Nov",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Rajasthani",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-064",
    "name": "Losar",
    "state": "Sikkim",
    "region": "Northeast",
    "window": "Feb–Mar",
    "family": "Buddhist",
    "meaning": "devotion, reflection, community tradition",
    "motifs": "prayer flags, lotus, wheel, monastery geometry",
    "paletteHex": [
      "#B23A48",
      "#E9C46A",
      "#264653"
    ],
    "composition": "quiet hierarchy; respectful sacred negative space",
    "language": "English / Nepali / Bhutia",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-065",
    "name": "Saga Dawa",
    "state": "Sikkim",
    "region": "Northeast",
    "window": "May–Jun",
    "family": "Buddhist",
    "meaning": "devotion, reflection, community tradition",
    "motifs": "prayer flags, lotus, wheel, monastery geometry",
    "paletteHex": [
      "#B23A48",
      "#E9C46A",
      "#264653"
    ],
    "composition": "quiet hierarchy; respectful sacred negative space",
    "language": "English / Nepali / Bhutia",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-066",
    "name": "Pang Lhabsol",
    "state": "Sikkim",
    "region": "Northeast",
    "window": "Aug–Sep",
    "family": "Mountain-Ritual",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English / Nepali / Bhutia",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-067",
    "name": "Pongal",
    "state": "Tamil Nadu",
    "region": "South",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Tamil",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-068",
    "name": "Puthandu",
    "state": "Tamil Nadu",
    "region": "South",
    "window": "Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Tamil",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-069",
    "name": "Karthigai Deepam",
    "state": "Tamil Nadu",
    "region": "South",
    "window": "Nov–Dec",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Tamil",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-070",
    "name": "Bathukamma",
    "state": "Telangana",
    "region": "South",
    "window": "Sep–Oct",
    "family": "Floral-Women",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Telugu / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-071",
    "name": "Bonalu",
    "state": "Telangana",
    "region": "South",
    "window": "Jul–Aug",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Telugu / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-072",
    "name": "Sammakka Saralamma Jatara",
    "state": "Telangana",
    "region": "South",
    "window": "Jan–Feb",
    "family": "Tribal-Pilgrimage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Telugu / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-073",
    "name": "Garia Puja",
    "state": "Tripura",
    "region": "Northeast",
    "window": "Apr",
    "family": "Agrarian-Tribal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Bengali / Kokborok",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-074",
    "name": "Kharchi Puja",
    "state": "Tripura",
    "region": "Northeast",
    "window": "Jul",
    "family": "Ritual",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Bengali / Kokborok",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-075",
    "name": "Ker Puja",
    "state": "Tripura",
    "region": "Northeast",
    "window": "Jul–Aug",
    "family": "Ritual",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Bengali / Kokborok",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-076",
    "name": "Kumbh / Magh Mela",
    "state": "Uttar Pradesh",
    "region": "North",
    "window": "Jan–Mar",
    "family": "Pilgrimage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-077",
    "name": "Lathmar Holi",
    "state": "Uttar Pradesh",
    "region": "North",
    "window": "Feb–Mar",
    "family": "Spring",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "flower bursts, powder clouds, music rhythm, foliage",
    "paletteHex": [
      "#E91E63",
      "#FFCA28",
      "#26A69A"
    ],
    "composition": "playful motion; controlled color zones; maintain text contrast",
    "language": "Hindi / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-078",
    "name": "Dev Deepawali",
    "state": "Uttar Pradesh",
    "region": "North",
    "window": "Oct–Nov",
    "family": "Devotional",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "lamp, flower garland, temple silhouette, sacred geometry",
    "paletteHex": [
      "#D1495B",
      "#F6C453",
      "#6A4C93"
    ],
    "composition": "ceremonial focal point; restrained glow; deity imagery only when approved",
    "language": "Hindi / Urdu",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-079",
    "name": "Harela",
    "state": "Uttarakhand",
    "region": "North",
    "window": "Jul",
    "family": "Nature-Agrarian",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Garhwali / Kumaoni",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-080",
    "name": "Nanda Devi Raj Jat / Mela",
    "state": "Uttarakhand",
    "region": "North",
    "window": "Aug–Sep",
    "family": "Pilgrimage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Garhwali / Kumaoni",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-081",
    "name": "Uttarayani Fair",
    "state": "Uttarakhand",
    "region": "North",
    "window": "Jan",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Garhwali / Kumaoni",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-082",
    "name": "Poila Boishakh",
    "state": "West Bengal",
    "region": "East",
    "window": "Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Bengali",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-083",
    "name": "Durga Puja",
    "state": "West Bengal",
    "region": "East",
    "window": "Sep–Oct",
    "family": "Devotional-Arts",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "alpana, dhaak, lotus, pandal geometry",
    "paletteHex": [
      "#B01E28",
      "#F2C14E",
      "#111827"
    ],
    "composition": "editorial-art poster; bold cultural pattern; avoid generic pan-India motifs",
    "language": "Bengali",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-084",
    "name": "Poush Mela",
    "state": "West Bengal",
    "region": "East",
    "window": "Dec",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Bengali",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-085",
    "name": "Island Tourism Festival",
    "state": "Andaman and Nicobar Islands",
    "region": "Union Territory",
    "window": "Dec–Jan",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / English / regional",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-086",
    "name": "Subhash Mela",
    "state": "Andaman and Nicobar Islands",
    "region": "Union Territory",
    "window": "Jan",
    "family": "Civic-Cultural",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / English / regional",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-087",
    "name": "Monsoon Festival",
    "state": "Andaman and Nicobar Islands",
    "region": "Union Territory",
    "window": "Jun–Jul",
    "family": "Seasonal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / English / regional",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-088",
    "name": "Rose Festival",
    "state": "Chandigarh",
    "region": "Union Territory",
    "window": "Feb",
    "family": "Floral-Civic",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Punjabi / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-089",
    "name": "Baisakhi",
    "state": "Chandigarh",
    "region": "Union Territory",
    "window": "Apr",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Hindi / Punjabi / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-090",
    "name": "Chandigarh Carnival",
    "state": "Chandigarh",
    "region": "Union Territory",
    "window": "Nov",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / Punjabi / English",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-091",
    "name": "Nariyal Poornima",
    "state": "Dadra and Nagar Haveli and Daman and Diu",
    "region": "Union Territory",
    "window": "Aug",
    "family": "Coastal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Gujarati / Hindi / Marathi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-092",
    "name": "Tarpa Festival",
    "state": "Dadra and Nagar Haveli and Daman and Diu",
    "region": "Union Territory",
    "window": "Dec",
    "family": "Tribal-Dance",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Gujarati / Hindi / Marathi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-093",
    "name": "Navratri",
    "state": "Dadra and Nagar Haveli and Daman and Diu",
    "region": "Union Territory",
    "window": "Sep–Oct",
    "family": "Devotional-Dance",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "dandiya/garba circle, mirror-work geometry, lamp",
    "paletteHex": [
      "#D81B60",
      "#FFB300",
      "#1565C0"
    ],
    "composition": "kinetic circular rhythm; high-energy type",
    "language": "Gujarati / Hindi / Marathi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-094",
    "name": "Republic Day",
    "state": "Delhi",
    "region": "Union Territory",
    "window": "Jan",
    "family": "National-Civic",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / English / Urdu / Punjabi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-095",
    "name": "Phool Walon Ki Sair",
    "state": "Delhi",
    "region": "Union Territory",
    "window": "Sep–Oct",
    "family": "Interfaith-Cultural",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Hindi / English / Urdu / Punjabi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-096",
    "name": "Diwali",
    "state": "Delhi",
    "region": "Union Territory",
    "window": "Oct–Nov",
    "family": "Festival of Lights",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "diyas, rangoli, doorway glow, geometric light rays",
    "paletteHex": [
      "#FF8F00",
      "#6A1B9A",
      "#1A237E"
    ],
    "composition": "dark-to-warm contrast; premium light without firework clutter",
    "language": "Hindi / English / Urdu / Punjabi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-097",
    "name": "Navreh",
    "state": "Jammu and Kashmir",
    "region": "Union Territory",
    "window": "Mar–Apr",
    "family": "New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "Urdu / Kashmiri / Dogri",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-098",
    "name": "Tulip Festival",
    "state": "Jammu and Kashmir",
    "region": "Union Territory",
    "window": "Mar–Apr",
    "family": "Floral-Civic",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Urdu / Kashmiri / Dogri",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-099",
    "name": "Kheer Bhawani Mela",
    "state": "Jammu and Kashmir",
    "region": "Union Territory",
    "window": "May–Jun",
    "family": "Pilgrimage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Urdu / Kashmiri / Dogri",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-100",
    "name": "Losar",
    "state": "Ladakh",
    "region": "Union Territory",
    "window": "Dec–Jan",
    "family": "Buddhist-New Year",
    "meaning": "renewal, auspicious beginnings, community",
    "motifs": "threshold, calendar sun, lamp, regional auspicious symbols",
    "paletteHex": [
      "#E4572E",
      "#F3C677",
      "#2A9D8F"
    ],
    "composition": "fresh, optimistic symmetry; strong year/date lockup",
    "language": "English / Ladakhi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-101",
    "name": "Hemis Festival",
    "state": "Ladakh",
    "region": "Union Territory",
    "window": "Jun–Jul",
    "family": "Buddhist",
    "meaning": "devotion, reflection, community tradition",
    "motifs": "prayer flags, lotus, wheel, monastery geometry",
    "paletteHex": [
      "#B23A48",
      "#E9C46A",
      "#264653"
    ],
    "composition": "quiet hierarchy; respectful sacred negative space",
    "language": "English / Ladakhi",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-102",
    "name": "Ladakh Festival",
    "state": "Ladakh",
    "region": "Union Territory",
    "window": "Sep",
    "family": "Cultural-Fair",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "English / Ladakhi",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-103",
    "name": "Eid al-Fitr",
    "state": "Lakshadweep",
    "region": "Union Territory",
    "window": "Lunar; varies",
    "family": "Islamic",
    "meaning": "faith, prayer, generosity, community",
    "motifs": "crescent, lantern, mosque geometry, stars, calligraphic frame",
    "paletteHex": [
      "#0B6E4F",
      "#D4AF37",
      "#102A43"
    ],
    "composition": "elegant geometry; no figurative sacred depiction; verify Arabic text",
    "language": "Malayalam / Mahl",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-104",
    "name": "Eid al-Adha",
    "state": "Lakshadweep",
    "region": "Union Territory",
    "window": "Lunar; varies",
    "family": "Islamic",
    "meaning": "faith, prayer, generosity, community",
    "motifs": "crescent, lantern, mosque geometry, stars, calligraphic frame",
    "paletteHex": [
      "#0B6E4F",
      "#D4AF37",
      "#102A43"
    ],
    "composition": "elegant geometry; no figurative sacred depiction; verify Arabic text",
    "language": "Malayalam / Mahl",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-105",
    "name": "Milad-un-Nabi",
    "state": "Lakshadweep",
    "region": "Union Territory",
    "window": "Lunar; varies",
    "family": "Islamic",
    "meaning": "faith, prayer, generosity, community",
    "motifs": "crescent, lantern, mosque geometry, stars, calligraphic frame",
    "paletteHex": [
      "#0B6E4F",
      "#D4AF37",
      "#102A43"
    ],
    "composition": "elegant geometry; no figurative sacred depiction; verify Arabic text",
    "language": "Malayalam / Mahl",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-106",
    "name": "Pongal",
    "state": "Puducherry",
    "region": "Union Territory",
    "window": "Jan",
    "family": "Harvest",
    "meaning": "gratitude, seasonality, prosperity",
    "motifs": "grain, sugarcane, farm tools, sun, kolam/rangoli",
    "paletteHex": [
      "#F4B400",
      "#2E7D32",
      "#8D4E2A"
    ],
    "composition": "warm abundance; layered crop forms; generous central greeting",
    "language": "Tamil / English / French / Telugu / Malayalam",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  },
  {
    "id": "CF-107",
    "name": "Masi Magam",
    "state": "Puducherry",
    "region": "Union Territory",
    "window": "Feb–Mar",
    "family": "Temple-Coastal",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Tamil / English / French / Telugu / Malayalam",
    "dateRule": "Date shifts: verify annually with an authoritative religious/state calendar and local organizer."
  },
  {
    "id": "CF-108",
    "name": "Bastille Day",
    "state": "Puducherry",
    "region": "Union Territory",
    "window": "Jul",
    "family": "Civic-Heritage",
    "meaning": "community celebration, heritage, and local identity",
    "motifs": "regional textile border, local flora, architectural silhouette",
    "paletteHex": [
      "#C2410C",
      "#EAB308",
      "#0F766E"
    ],
    "composition": "one hero motif, one border system, clear date/CTA hierarchy",
    "language": "Tamil / English / French / Telugu / Malayalam",
    "dateRule": "Verify the exact annual date and local observance window before publishing."
  }
];

function norm(s) { return (s || '').toLowerCase(); }

const STOPWORDS = new Set(['the', 'and', 'festival', 'day', 'celebration', 'puja', 'pooja', 'utsav', 'utsavam']);

function keywordsFor(name) {
  return norm(name)
    .replace(/[()/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

// Precomputed once at module load — avoids re-tokenizing all 108 names on
// every keystroke of the search box or every call to matchFestival().
const FESTIVAL_INDEX = FESTIVALS.map(fest => ({ fest, keywords: keywordsFor(fest.name) }));

/**
 * Best-effort keyword match against an event's title/type — mirrors the
 * pattern used by promptLibrary.js's buildPrompt(). Used to pre-fill the
 * wizard's festival pick; the user can always override it via the search
 * picker (see searchFestivals()).
 */
export function matchFestival(event) {
  const combined = norm(`${event?.title || ''} ${event?.type || ''}`).trim();
  if (!combined) return null;
  let best = null;
  let bestLen = 0;
  for (const { fest, keywords } of FESTIVAL_INDEX) {
    for (const kw of keywords) {
      if (kw.length > bestLen && combined.includes(kw)) {
        best = fest;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

export function getFestivalById(id) {
  return FESTIVALS.find(f => f.id === id) || null;
}

/**
 * Powers the wizard's searchable festival picker — matches on festival
 * name, home state, and festival family (e.g. searching "harvest" surfaces
 * Sankranti, Pongal, Bihu, etc). Empty query returns the first page so the
 * picker never opens blank.
 */
export function searchFestivals(query, limit = 30) {
  const q = norm(query).trim();
  if (!q) return FESTIVALS.slice(0, limit);
  return FESTIVALS.filter(f =>
    norm(f.name).includes(q) || norm(f.state).includes(q) || norm(f.family).includes(q) || norm(f.region).includes(q)
  ).slice(0, limit);
}
