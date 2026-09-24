/**
 * src/pages/PublicRadarPage.jsx
 * Route: /explore (public, no org subdomain needed)
 *
 * Community Radar — the cross-org discovery feed. Unlike every other public
 * page in this app (PublicCalendar, PublicAlbumPage, PublicPhotosPage), this
 * one is NOT scoped to a single org: it reads from GET /api/radar, which
 * only ever returns events an admin explicitly opted into Radar via the
 * Discoverability setting on AddEventModal/EditEventModal. An org that
 * never touches that setting is invisible here, exactly as before.
 *
 * Visual redesign (warm photo-forward "Explore" layout: hero + search,
 * passport stats card, horizontal event/org rows, category tile grid,
 * closing CTA) -- every number and link on the page still traces back to
 * real data or a real action:
 *   - "Today" / "This weekend" badges are computed from each event's own
 *     date, not a fabricated "trending" signal.
 *   - There is no attendee/RSVP-count field anywhere in the API this page
 *     reads (see server/routes/radar.js), so cards never show a "going"
 *     count -- that would have to be invented.
 *   - The stats card's three numbers are all real: organizations followed
 *     and interests picked both come straight from the Community Passport
 *     identity (server/routes/identity.js); saved events is a local-only
 *     heart-toggle (cf_saved_events in localStorage) since there's no
 *     backend "save" endpoint yet -- it works per-browser, not per-account.
 *   - "RSVP" deep-links to this event's real /rsvp/:eventKey?org=... page
 *     (same URL shape as utils/rsvpUrl.js's getRsvpUrl, just built for
 *     someone else's org instead of the admin's own). "Add to calendar"
 *     opens a real Google Calendar prefill link -- no ICS generator exists
 *     in this codebase yet.
 *   - The category tiles are this app's real org categories (whatever
 *     CATEGORY_LABELS/CATEGORY_META below don't recognize still renders,
 *     title-cased, via the same fallback the old pill filter used) with
 *     real per-category event counts -- not the illustrative "Temples &
 *     Spiritual / Arts & Culture / ..." set from the original mockup,
 *     which doesn't correspond to any field this app actually stores.
 *
 * Phase 1 of the "Community Passport" personalization plan (see
 * server/identity-auth.js): an optional, email-verified cross-org
 * identity that remembers the orgs you follow and a handful of interest
 * tags, and greets you with them on return visits. Skippable entirely --
 * the anonymous feed still works exactly as before for anyone who doesn't
 * verify.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, MapPin, ArrowRight, Sparkles, Search, ChevronDown,
  ChevronLeft, ChevronRight, Heart, Users, LogOut, CalendarDays,
  Landmark, Palette, Church, Flame, MoonStar, Building2,
  Footprints, Music, PersonStanding, UtensilsCrossed, ShoppingCart, Globe, PartyPopper,
  Compass, BookOpen, Flag, Globe2, MessageCircle, Layers, Star, Waves, Feather,
} from 'lucide-react';
import PublicPageBackdrop from '../components/PublicPageBackdrop';
import { getEventKey } from '../utils/rsvpUrl';
import { ORG_CATEGORY_LABELS } from '../utils/organizationCategories';

const CATEGORY_LABELS = {
  // Legacy keys this page has always displayed but that no current signup
  // flow assigns (kept for any org that was set up before OnboardingWizard
  // narrowed to its own list) -- everything else comes from the shared
  // taxonomy in utils/organizationCategories.js so this stays in sync with
  // what OnboardingWizard/PremiumSettings actually let an org pick.
  gurudwara: 'Gurudwara', mosque: 'Mosque', church: 'Church',
  cultural_association: 'Cultural Association', community_center: 'Community Center',
  ...ORG_CATEGORY_LABELS,
};

// Icon + accent color per known org category, for the "Explore your
// community" tiles -- covers both the taxonomy this file's original
// CATEGORY_LABELS anticipated (temple/gurudwara/mosque/church/...) and the
// one OnboardingWizard.jsx actually signs orgs up with today (temple/
// nonprofit/community/other), so a tile never renders with no icon at all.
const CATEGORY_META = {
  temple: { icon: Landmark, color: '#c2410c' },
  gurudwara: { icon: Flame, color: '#b45309' },
  mosque: { icon: MoonStar, color: '#0f766e' },
  church: { icon: Church, color: '#7c3aed' },
  cultural_association: { icon: Palette, color: '#be185d' },
  community_center: { icon: Building2, color: '#2563eb' },
  nonprofit: { icon: Sparkles, color: '#059669' },
  community: { icon: Users, color: '#d97706' },
  other: { icon: CalendarDays, color: '#6b7280' },
  // Schools & wellness
  dance_school: { icon: Footprints, color: '#db2777' },
  music_school: { icon: Music, color: '#9333ea' },
  yoga_school: { icon: PersonStanding, color: '#0d9488' },
  // Food & retail
  restaurant: { icon: UtensilsCrossed, color: '#ea580c' },
  grocery: { icon: ShoppingCart, color: '#16a34a' },
  // Regional & language associations -- these all used to share one
  // icon+color (Languages, amber), which made the "Organizations near
  // you" list impossible to scan at a glance: nine differently-named
  // sections all showed the identical little glyph. Each now gets its own
  // icon and color -- chosen as visually distinct, culturally-neutral
  // shapes (a compass, a book, a flag, ...) with no attempt to symbolize
  // any specific region or language, so no one association's icon reads
  // as "more representative" or stereotyped than another's.
  telugu_association: { icon: Compass, color: '#0e7490' },
  kannada_koota: { icon: BookOpen, color: '#4d7c0f' },
  tamil_sangam: { icon: Flag, color: '#be123c' },
  malayalee_association: { icon: Globe2, color: '#4338ca' },
  bengali_association: { icon: MessageCircle, color: '#a16207' },
  odisha_association: { icon: Layers, color: '#0369a1' },
  hindi_association: { icon: Star, color: '#a21caf' },
  gujarati_association: { icon: Waves, color: '#57534e' },
  marathi_association: { icon: Feather, color: '#166534' },
  punjabi_association: { icon: MapPin, color: '#334155' },
  pan_india_association: { icon: Globe, color: '#1d4ed8' },
  // Community & events
  mela_fair_organizer: { icon: PartyPopper, color: '#f59e0b' },
};
const DEFAULT_CATEGORY_META = { icon: CalendarDays, color: '#92400e' };
function categoryMeta(cat) {
  return CATEGORY_META[cat] || DEFAULT_CATEGORY_META;
}

const INTEREST_LABELS = {
  'music': '🎵 Music', 'dance': '💃 Dance', 'yoga': '🧘 Yoga', 'kids-family': '👨‍👩‍👧 Kids & family',
  'food': '🍽️ Food', 'volunteering': '🤝 Volunteering', 'spiritual': '🕉️ Spiritual',
  'youth': '🧑‍🎓 Youth', 'seniors': '👵 Seniors', 'arts-culture': '🎨 Arts & culture',
  'sports': '🏸 Sports', 'language': '🗣️ Language',
};

// Weak proxy from an org's own category to the interest tags it's closest
// to -- mirrors server/routes/discover.js's CATEGORY_TO_INTERESTS exactly
// (same reasoning: orgs don't have their own tag list yet, and this is
// the only real signal this app has linking an event to an interest).
// Used by InterestSwimLanes below to sort real radar events into
// interest-based lanes -- a category this map doesn't recognize just
// means that event never appears in a lane, same fail-quiet behavior as
// the server-side version.
const CATEGORY_TO_INTERESTS = {
  temple: ['spiritual'],
  gurudwara: ['spiritual'],
  mosque: ['spiritual'],
  church: ['spiritual'],
  cultural_association: ['arts-culture', 'language'],
  community_center: ['kids-family', 'arts-culture'],
  dance_school: ['dance', 'arts-culture'],
  music_school: ['music', 'arts-culture'],
  yoga_school: ['yoga'],
  restaurant: ['food'],
  grocery: ['food'],
  telugu_association: ['language', 'arts-culture'],
  kannada_koota: ['language', 'arts-culture'],
  tamil_sangam: ['language', 'arts-culture'],
  malayalee_association: ['language', 'arts-culture'],
  bengali_association: ['language', 'arts-culture'],
  odisha_association: ['language', 'arts-culture'],
  hindi_association: ['language', 'arts-culture'],
  gujarati_association: ['language', 'arts-culture'],
  marathi_association: ['language', 'arts-culture'],
  punjabi_association: ['language', 'arts-culture'],
  pan_india_association: ['arts-culture'],
  mela_fair_organizer: ['arts-culture', 'kids-family'],
};
function interestsForCategory(cat) {
  return CATEGORY_TO_INTERESTS[cat] || [];
}

// Mirrors server/identity-auth.js's LANGUAGE_OPTIONS -- each maps 1:1 to
// one of the 10 language-association categories in CATEGORY_META above,
// so picking "Telugu" here is really just narrowing to the
// telugu_association category, but it lets someone pick SEVERAL at once
// (identity.languages), which a single activeCategory pill can't do.
const LANGUAGE_META = [
  { key: 'telugu', label: 'Telugu', category: 'telugu_association' },
  { key: 'kannada', label: 'Kannada', category: 'kannada_koota' },
  { key: 'tamil', label: 'Tamil', category: 'tamil_sangam' },
  { key: 'malayalam', label: 'Malayalam', category: 'malayalee_association' },
  { key: 'bengali', label: 'Bengali', category: 'bengali_association' },
  { key: 'odia', label: 'Odia', category: 'odisha_association' },
  { key: 'hindi', label: 'Hindi', category: 'hindi_association' },
  { key: 'gujarati', label: 'Gujarati', category: 'gujarati_association' },
  { key: 'marathi', label: 'Marathi', category: 'marathi_association' },
  { key: 'punjabi', label: 'Punjabi', category: 'punjabi_association' },
];

// Mirrors server/utils/cuisineTags.js's CUISINE_TAGS. Applies only to the
// 'restaurant' category -- 'grocery' (the app's other food-interest
// category) doesn't really have a "cuisine" in the dining sense, so it's
// left unaffected by this filter regardless of selection.
const CUISINE_META = [
  { key: 'south_indian', label: 'South Indian' },
  { key: 'north_indian', label: 'North Indian' },
  { key: 'gujarati', label: 'Gujarati' },
  { key: 'punjabi', label: 'Punjabi' },
  { key: 'bengali', label: 'Bengali' },
  { key: 'indian_other', label: 'Indian (other)' },
  { key: 'chinese', label: 'Chinese' },
  { key: 'italian', label: 'Italian' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'thai', label: 'Thai' },
  { key: 'mediterranean', label: 'Mediterranean / Middle Eastern' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'bakery_cafe', label: 'Bakery / Café' },
];

// True if `org` (or an event's org) should show given the currently
// selected languages/cuisines -- empty selections mean "no restriction".
// A language selection only ever narrows the 10 language-association
// categories; every other category (including 'restaurant'/'grocery') is
// untouched by it, and vice versa for cuisine.
function orgMatchesPrefs(org, languages, cuisines) {
  if (!org) return true;
  const langEntry = LANGUAGE_META.find((l) => l.category === org.category);
  if (langEntry && languages.length > 0 && !languages.includes(langEntry.key)) return false;
  if (org.category === 'restaurant' && cuisines.length > 0) {
    const tags = org.cuisine_tags || [];
    if (!tags.some((t) => cuisines.includes(t))) return false;
  }
  return true;
}

// Caps how many events from the SAME organization can occupy the top
// `target` slots of an already-ranked list, so one very active org (a
// temple posting 5 real events, say) doesn't crowd out every other real
// org's event just because it currently has more content. First pass
// keeps up to `perOrgCap` from each org, in the list's existing rank
// order; anything past that per org is held back as overflow. Only if the
// capped picks don't reach `target` (there simply isn't enough OTHER
// content yet) does it backfill from that overflow, in the same rank
// order -- so today, with only one org nearby that has events, this is a
// no-op (there's nothing else to show), but it stops mattering the moment
// a second org starts posting.
function capByOrg(list, perOrgCap, target) {
  const counts = new Map();
  const picked = [];
  const overflow = [];
  for (const event of list) {
    const key = event.org?.org_id || event.org?.name || '';
    const count = counts.get(key) || 0;
    if (count < perOrgCap) {
      picked.push(event);
      counts.set(key, count + 1);
    } else {
      overflow.push(event);
    }
  }
  let i = 0;
  while (picked.length < target && i < overflow.length) {
    picked.push(overflow[i]);
    i++;
  }
  return picked.slice(0, target);
}


const IDENTITY_TOKEN_KEY = 'cf_identity_token';
function getIdentityToken() { try { return localStorage.getItem(IDENTITY_TOKEN_KEY); } catch { return null; } }
function setIdentityToken(t) { try { localStorage.setItem(IDENTITY_TOKEN_KEY, t); } catch {} }
function clearIdentityToken() { try { localStorage.removeItem(IDENTITY_TOKEN_KEY); } catch {} }

// Local-only "saved events" -- a heart toggle with nowhere to sync to yet
// (no such endpoint exists in server/routes/identity.js or radar.js), so
// it lives in this browser's localStorage rather than pretending to be
// cross-device. Works with or without a verified Passport identity.
const SAVED_EVENTS_KEY = 'cf_saved_events';
function getSavedEventIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_EVENTS_KEY) || '[]')); } catch { return new Set(); }
}
function persistSavedEventIds(set) {
  try { localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify([...set])); } catch { /* private browsing etc */ }
}

async function identityFetch(path, { token, ...opts } = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function categoryLabel(cat) {
  if (!cat) return null;
  return CATEGORY_LABELS[cat] || cat.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "This weekend" = the coming Saturday/Sunday (or today, if today already
// is one). Good enough for a badge -- not trying to be a calendar library.
function isThisWeekend(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = now.getDay(); // 0 Sun .. 6 Sat
    const daysUntilSat = (6 - dow) % 7;
    const sat = new Date(now); sat.setDate(now.getDate() + daysUntilSat);
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
    return d.getTime() === sat.getTime() || d.getTime() === sun.getTime() || (dow === 0 && d.getTime() === now.getTime());
  } catch {
    return false;
  }
}

function eventBadge(dateStr) {
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((d - now) / 86400000);
    if (diffDays === 0) return { label: 'Today', bg: '#dc2626' };
    if (diffDays > 0 && diffDays <= 7 && isThisWeekend(dateStr)) return { label: 'This weekend', bg: '#ca8a04' };
    if (diffDays > 0 && diffDays <= 3) return { label: `In ${diffDays}d`, bg: '#2f6b3a' };
    return null;
  } catch {
    return null;
  }
}

// A real, working "Add to calendar" -- a Google Calendar prefill link built
// from the event's own date/title/location. No ICS generator exists in
// this codebase (checked), so this is the honest version of that button
// rather than a dead link or a fabricated download.
function googleCalendarUrl(event) {
  try {
    const start = new Date(event.date + 'T00:00:00');
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title || 'Event',
      dates: `${fmt(start)}/${fmt(end)}`,
      details: event.description || '',
      location: [event.location, event.org?.name].filter(Boolean).join(' · '),
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return 'https://calendar.google.com/calendar/render';
  }
}

// Real per-event RSVP link, same URL shape as utils/rsvpUrl.js's
// getRsvpUrl -- that helper assumes the ADMIN's own org (read from
// localStorage), which isn't true here, so this builds it directly from
// the radar event's own org.subdomain instead.
function radarRsvpUrl(event) {
  return `/rsvp/${getEventKey(event)}?org=${encodeURIComponent(event.org.subdomain)}`;
}

function orgInitial(org) {
  return (org.name || '?').trim().charAt(0).toUpperCase();
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Top bar -- Explore/Events/Organizations/+Create + account. Rendered by
// this page itself (App.jsx hides the generic single-tab PublicNav on
// /explore) rather than being a global nav, since none of this makes
// sense on an org's own /calendar page. Every link either scrolls to a
// real section on this same page or goes to a real route (/signup) --
// there's no separate "all events" / "all organizations" page to link to
// yet, and no notification system to back a bell icon, so neither is
// here. ─────────────────────────────────────────────────────────────────
function ExploreTopBar({ identity, identityLoading, onSignOut }) {
  const avatarLetter = identity ? (identity.display_name || identity.email || '?').trim().charAt(0).toUpperCase() : null;
  return (
    <nav style={topBarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800, fontSize: '1.3rem', color: '#fff', whiteSpace: 'nowrap' }}>
          CalendarFly
        </span>
        <span className="cf-explore-tagline" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
          Events. People. Stronger Communities.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ ...topBarLinkStyle, ...topBarLinkActiveStyle }}>Explore</button>
        <button onClick={() => scrollToId('happening-near-you')} className="cf-explore-navlabel" style={topBarLinkStyle}>Events</button>
        <button onClick={() => scrollToId('organizations-near-you')} className="cf-explore-navlabel" style={topBarLinkStyle}>Organizations</button>
        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />
        {identity && !identityLoading ? (
          <button onClick={() => scrollToId('passport-card')} style={topBarAccountStyle}>
            <span style={topBarAvatarStyle}>{avatarLetter}</span>
            <span className="cf-explore-navlabel">My CalendarFly</span>
            <ChevronDown size={14} className="cf-explore-navlabel" />
          </button>
        ) : (
          <button onClick={() => scrollToId('passport-card')} style={topBarAccountStyle}>
            <span style={topBarAvatarStyle}><Users size={14} /></span>
            <span className="cf-explore-navlabel">Sign in</span>
          </button>
        )}
      </div>
      <style>{`
        @media (max-width: 760px) {
          .cf-explore-navlabel { display: none; }
        }
        @media (max-width: 560px) {
          .cf-explore-tagline { display: none; }
        }
      `}</style>
    </nav>
  );
}

// ── Hero -- headline, search (filters the feed below by text, and doubles
// as a ZIP/city search into the real nearby-orgs lookup when the query
// looks like a location), and quick filter pills. ───────────────────────
// Original line-art "community" motif -- a hub of small person glyphs
// connected to a ring of others -- standing in for a photo. No stock or
// generated photography in this codebase matched the warm, festival-photo
// look a mockup once showed here (see this file's header comment), so
// this stays hand-drawn SVG rather than something fabricated to look like
// a real photograph.
function PersonGlyph({ cx, cy, scale = 1, color = '#fdba74' }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      <circle cx="0" cy="-7" r="5.5" fill={color} />
      <path d="M -9 11 Q 0 -3 9 11 Z" fill={color} />
    </g>
  );
}

function CommunityArtwork() {
  const nodes = Array.from({ length: 6 }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return { x: 150 + Math.cos(angle) * 108, y: 150 + Math.sin(angle) * 108 };
  });
  return (
    <svg viewBox="0 0 300 300" width="300" height="300" className="cf-hero-artwork" aria-hidden="true">
      <defs>
        <radialGradient id="cfHubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c2410c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c2410c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="90" fill="url(#cfHubGlow)" />
      {nodes.map((n, i) => (
        <line key={i} x1="150" y1="150" x2={n.x} y2={n.y} stroke="#fdba74" strokeOpacity="0.35" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="24" fill="#1a0e04" stroke="#fdba74" strokeOpacity="0.5" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <PersonGlyph key={i} cx={n.x} cy={n.y} scale={1.05} color="#fdba74" />
      ))}
      <circle cx="150" cy="150" r="38" fill="#1a0e04" stroke="#ea580c" strokeWidth="2" />
      <PersonGlyph cx={138} cy={148} scale={1.15} color="#fed7aa" />
      <PersonGlyph cx={162} cy={148} scale={1.15} color="#fdba74" />
      <PersonGlyph cx={150} cy={162} scale={1.15} color="#fb923c" />
    </svg>
  );
}

function ExploreHero({
  heroQuery, setHeroQuery, onSearchSubmit, quickFilter, setQuickFilter,
  showCategoryFilters, setShowCategoryFilters,
}) {
  return (
    <div style={heroStyle}>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 780, flex: '1 1 420px' }}>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800, fontSize: 'clamp(1.9rem, 4.5vw, 3rem)', lineHeight: 1.1, color: '#fff' }}>
            Your community is happening.
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(1.7rem, 4vw, 2.7rem)', color: '#fdba74', marginTop: 4 }}>
            Don't miss it.
          </div>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.98rem', maxWidth: 520, margin: '14px 0 22px', lineHeight: 1.5 }}>
            Discover events around you — temples, cultural centers, festivals, kids &amp; family, wellness, food, music and more.
          </p>

          <div style={{ display: 'flex', gap: 8, maxWidth: 560, marginBottom: 14 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, padding: '4px 4px 4px 16px' }}>
              <Search size={17} color="#9a7a55" style={{ flexShrink: 0 }} />
              <input
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                placeholder="Search events, organizations or ZIP code"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '10px 0', fontSize: '0.92rem', color: '#3d2008', fontFamily: 'inherit' }}
              />
              <button onClick={onSearchSubmit} style={heroSearchBtnStyle} aria-label="Search">
                <Search size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setQuickFilter(quickFilter === 'today' ? 'all' : 'today')} style={heroPillStyle(quickFilter === 'today')}>Today</button>
            <button onClick={() => setQuickFilter(quickFilter === 'weekend' ? 'all' : 'weekend')} style={heroPillStyle(quickFilter === 'weekend')}>This weekend</button>
            <button onClick={() => scrollToId('organizations-near-you')} style={heroPillStyle(false)}>Near me</button>
            <button onClick={() => setShowCategoryFilters((v) => !v)} style={heroPillStyle(showCategoryFilters)}>Filters</button>
          </div>
        </div>

        <CommunityArtwork />
      </div>

      <style>{`
        @media (max-width: 900px) {
          .cf-hero-artwork { display: none; }
        }
      `}</style>
    </div>
  );
}

// ── Horizontal scroll row wrapper with real prev/next buttons (scrollBy),
// shared by the event row and the organizations row. ─────────────────────
function ScrollRow({ children }) {
  const ref = useRef(null);
  const scrollBy = (dir) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={scrollRowStyle} className="cf-explore-scrollrow">
        {children}
      </div>
      <button onClick={() => scrollBy(-1)} className="cf-explore-scrollbtn" style={{ ...scrollBtnStyle, left: -6 }} aria-label="Scroll left">
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => scrollBy(1)} className="cf-explore-scrollbtn" style={{ ...scrollBtnStyle, right: -6 }} aria-label="Scroll right">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function EventCard({ event, saved, onToggleSave }) {
  const badge = eventBadge(event.date);
  // Directory-sourced events (see server/utils/directorySources.js) come
  // from orgs that haven't signed up for CalendarFly -- no /calendar page
  // and no CalendarFly-hosted RSVP exists for them, so both links need to
  // point at the event's own real source (its Eventbrite/Meetup page, or
  // the org's own site) instead of 404ing, same treatment OrgCard already
  // gives unclaimed Google-sourced orgs.
  const claimed = !!event.org.subdomain;
  const primaryHref = claimed ? `/calendar?org=${encodeURIComponent(event.org.subdomain)}` : (event.source_url || '#');
  const outboundProps = claimed ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  // The little "attractive pic" for the compact mobile row -- reuses the
  // same category icon/color already used as this event's org's section
  // header elsewhere on the page, so a mixed "Happening near you" list
  // (unlike "Organizations near you", not grouped by category) still
  // gives an at-a-glance sense of what kind of event this is.
  const catMeta = categoryMeta(event.org.category);
  const CategoryIcon = catMeta.icon;
  return (
    <div style={eventCardStyle} className="cf-event-card">
      <div className="cf-card-visual-desktop">
        <a href={primaryHref} {...outboundProps} style={{ display: 'block', textDecoration: 'none' }}>
          <div style={{
            height: 140, borderRadius: '14px 14px 0 0', position: 'relative', overflow: 'hidden',
            // Layered background (image over gradient), not an either/or --
            // if the pulled image URL ever 404s (a scraped favicon going stale,
            // say), the gradient underneath still paints instead of a blank box.
            background: event.image_url ? `center/cover no-repeat url(${event.image_url}), linear-gradient(160deg, ${event.org.primary_color || '#ea580c'}, #92400e)` : `linear-gradient(160deg, ${event.org.primary_color || '#ea580c'}, #92400e)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!event.image_url && (
              <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 34, fontFamily: "'Playfair Display', Georgia, serif" }}>
                {(event.org.name || '?').trim().charAt(0).toUpperCase()}
              </span>
            )}
            {badge && (
              <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: badge.bg, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                {badge.label}
              </span>
            )}
          </div>
        </a>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.event_id); }}
          aria-label={saved ? 'Unsave event' : 'Save event'}
          style={{ position: 'absolute', top: 122, right: 10, width: 30, height: 30, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
        >
          <Heart size={15} color={saved ? '#dc2626' : '#c9b98e'} fill={saved ? '#dc2626' : 'none'} />
        </button>

        <div style={{ padding: '14px 14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {event.org.logo_url && (
              <img src={event.org.logo_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', border: '1px solid #f0e4c8', flexShrink: 0 }} />
            )}
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#2f6b3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.org.name}{event.org.category ? <span style={{ color: '#9a7a55', fontWeight: 600 }}> · {categoryLabel(event.org.category)}</span> : null}
            </div>
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#3d2008', marginBottom: 6, lineHeight: 1.3, minHeight: '2.6em' }}>
            {event.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11.5, color: '#9a7a55', marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}
            </span>
            {event.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <MapPin size={12} /> {event.location}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {claimed ? (
              <a href={radarRsvpUrl(event)} style={cardPrimaryBtnStyle}>RSVP</a>
            ) : (
              <a href={event.source_url || '#'} target="_blank" rel="noopener noreferrer" style={cardPrimaryBtnStyle}>View event</a>
            )}
            <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" style={cardSecondaryBtnStyle}>Add to calendar</a>
          </div>
        </div>
      </div>

      <a href={primaryHref} {...outboundProps} className="cf-card-row">
        <div style={{
          width: 52, height: 52, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          // A real picture (this event's image, or its org's own logo)
          // beats the generic category icon as the row's "attractive
          // pic" whenever one's available -- falls back to the icon+
          // color otherwise, same as before.
          background: (event.image_url || event.org.logo_url)
            ? `center/cover no-repeat url(${event.image_url || event.org.logo_url}), linear-gradient(160deg, ${catMeta.color}, #3d2008)`
            : `linear-gradient(160deg, ${catMeta.color}, #3d2008)`,
        }}>
          {!(event.image_url || event.org.logo_url) && <CategoryIcon size={22} color="#fff" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {badge && (
            <span style={{ display: 'inline-block', marginBottom: 3, background: badge.bg, color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
              {badge.label}
            </span>
          )}
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3d2008', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {event.title}
          </div>
          <div style={{ fontSize: 11, color: '#2f6b3a', fontWeight: 700, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.org.name}
          </div>
          <div style={{ fontSize: 11.5, color: '#9a7a55', marginTop: 2 }}>
            {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}
          </div>
        </div>
        <ChevronRight size={18} color="#c9b98e" style={{ flexShrink: 0 }} />
      </a>
    </div>
  );
}

// Compact card for a single interest swim lane column -- same real data
// and links as EventCard's own mobile ".cf-card-row" compact layout
// (category icon/photo tile, title, org, date, chevron to the real
// calendar/RSVP page), but rendered as its own component so it's compact
// at ANY viewport width, not just below the 640px breakpoint EventCard's
// CSS class switches on. A lane column is narrow on desktop too.
function LaneEventCard({ event }) {
  const badge = eventBadge(event.date);
  const claimed = !!event.org.subdomain;
  const primaryHref = claimed ? `/calendar?org=${encodeURIComponent(event.org.subdomain)}` : (event.source_url || '#');
  const outboundProps = claimed ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  const catMeta = categoryMeta(event.org.category);
  const CategoryIcon = catMeta.icon;
  return (
    <a href={primaryHref} {...outboundProps} style={laneCardStyle}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: (event.image_url || event.org.logo_url)
          ? `center/cover no-repeat url(${event.image_url || event.org.logo_url}), linear-gradient(160deg, ${catMeta.color}, #3d2008)`
          : `linear-gradient(160deg, ${catMeta.color}, #3d2008)`,
      }}>
        {!(event.image_url || event.org.logo_url) && <CategoryIcon size={19} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {badge && (
          <span style={{ display: 'inline-block', marginBottom: 3, background: badge.bg, color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>
            {badge.label}
          </span>
        )}
        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#3d2008', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {event.title}
        </div>
        <div style={{ fontSize: 10.5, color: '#2f6b3a', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.org.name}
        </div>
        <div style={{ fontSize: 10.5, color: '#9a7a55', marginTop: 1 }}>
          {formatDate(event.date)}{event.time ? ` \u00B7 ${event.time}` : ''}
        </div>
      </div>
      <ChevronRight size={15} color="#c9b98e" style={{ flexShrink: 0 }} />
    </a>
  );
}

// "Top picks by interest" -- vertical swim lanes, one per interest, top 5
// interests wide and top 5 events deep. Takes the same merged event pool
// as "Happening near you" (see swimLaneEvents above: this app's own /api/
// radar events plus directory-sourced ones), not just this app's own --
// otherwise this section would sit empty under a populated "Happening
// near you" whenever most of what's showing is directory-sourced, which
// is exactly today's early-market reality. Interests come from real data
// only: an interest only ever appears as a lane if at least one real
// event maps to it via interestsForCategory above, and within a lane
// events are ranked soonest-first (same "deliberately dumb,
// never fabricate a relevance score" ranking as /api/radar and the
// wideFlatEvents tie-break above -- there's no popularity/RSVP-count
// signal in this app to rank on instead, see EventCard's header comment).
//
// Interest selection: a visitor with a saved Community Passport
// (identity.interests) sees THEIR OWN interests first, ranked by how many
// real events currently match each one -- most content first, never a
// picked interest with nothing in it. If they picked fewer than 5, the
// remaining lanes fill in with the platform's next-most-active interests
// so there are still up to 5 lanes to browse. A visitor with no passport
// (or one with zero interests picked) just sees the platform's top 5 most
// active interests overall -- still real counts, not personalized, same
// honest degrade discover.js's interest_match already uses elsewhere on
// this page.
function InterestSwimLanes({ events, identity }) {
  // One lane per event, never more -- a category can map to several
  // interest tags (music_school is both 'music' and 'arts-culture'), but
  // an event only ever files under the FIRST/primary one so the same
  // event never shows up twice across different lanes. interestsForCategory
  // lists each category's tags most-specific-first for exactly this
  // reason (e.g. 'dance' before the generic 'arts-culture' catch-all).
  const interestBuckets = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      const primary = interestsForCategory(event.org?.category)[0];
      if (!primary) continue;
      if (!map.has(primary)) map.set(primary, []);
      map.get(primary).push(event);
    }
    return map;
  }, [events]);

  const lanes = useMemo(() => {
    const countOf = (key) => (interestBuckets.get(key) || []).length;
    const allKeys = Object.keys(INTEREST_LABELS);
    const byCountDesc = (a, b) => countOf(b) - countOf(a);

    let topKeys;
    const personal = (identity?.interests || []).filter((k) => countOf(k) > 0);
    if (personal.length > 0) {
      personal.sort(byCountDesc);
      const filler = allKeys
        .filter((k) => !personal.includes(k) && countOf(k) > 0)
        .sort(byCountDesc);
      topKeys = personal.concat(filler).slice(0, 5);
    } else {
      topKeys = allKeys.filter((k) => countOf(k) > 0).sort(byCountDesc).slice(0, 5);
    }

    return topKeys.map((key) => ({
      key,
      label: INTEREST_LABELS[key] || key,
      count: countOf(key),
      events: (interestBuckets.get(key) || [])
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .slice(0, 5),
    }));
  }, [interestBuckets, identity]);

  if (lanes.length === 0) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <SectionHeader
        icon={Star}
        title="Top picks by interest"
        subtitle={identity && identity.interests.length ? 'Ranked for your interests, soonest first' : 'The platform\'s most active interests right now'}
      />
      <ScrollRow>
        {lanes.map((lane) => (
          <div key={lane.key} style={laneColumnStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#3d2008' }}>{lane.label}</div>
              <div style={{ fontSize: 10.5, color: '#9a7a55', whiteSpace: 'nowrap' }}>{lane.count} event{lane.count === 1 ? '' : 's'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lane.events.map((event) => (
                <LaneEventCard key={event.event_id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </ScrollRow>
    </div>
  );
}

function CategoryGrid({ events, categories, onPick }) {
  if (categories.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {categories.map((cat) => {
        const meta = categoryMeta(cat);
        const Icon = meta.icon;
        const count = events.filter((e) => e.org?.category === cat).length;
        return (
          <button key={cat} onClick={() => onPick(cat)} style={categoryTileStyle(meta.color)}>
            <span style={categoryIconWrapStyle}>
              <Icon size={20} color="#fff" />
            </span>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.98rem', textAlign: 'left' }}>{categoryLabel(cat)}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'left' }}>{count} event{count === 1 ? '' : 's'}</span>
            <ChevronRight size={16} color="rgba(255,255,255,0.85)" style={{ position: 'absolute', bottom: 12, right: 12 }} />
          </button>
        );
      })}
    </div>
  );
}

function PassportOnboarding({ onVerified }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#ffffff', border: '1px solid #e8d5a3', borderRadius: 10,
    color: '#3d2008', fontSize: '0.95rem', outline: 'none',
  };
  const button = (disabled) => ({
    padding: '12px 20px',
    background: disabled ? '#e8d5a3' : '#3d2008',
    border: 'none', color: 'white', borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem',
  });

  const requestCode = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError(''); setBusy(true);
    try {
      await identityFetch('/api/identity/request-code', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return setError('Enter the code we emailed you.');
    setError(''); setBusy(true);
    try {
      const data = await identityFetch('/api/identity/verify-code', { method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      setIdentityToken(data.token);
      onVerified(data.identity);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="passport-card" style={passportCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={18} color="#3d2008" />
        <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '1.05rem' }}>Save your spot</div>
      </div>
      <p style={{ color: '#7a3b00', fontSize: '0.88rem', margin: '0 0 14px', lineHeight: 1.5 }}>
        A quick email check-in unlocks personalized picks and lets you follow your favorite organizations. Browsing without one still works.
      </p>
      {step === 'email' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} onKeyDown={(e) => e.key === 'Enter' && requestCode()} />
          <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, width: 140, letterSpacing: '0.2em', textAlign: 'center' }} onKeyDown={(e) => e.key === 'Enter' && verifyCode()} />
          <button onClick={verifyCode} disabled={busy} style={button(busy)}>{busy ? 'Verifying…' : 'Verify'}</button>
          <span style={{ fontSize: '0.78rem', color: '#9a7a55' }}>Code sent to {email}</span>
        </div>
      )}
      {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#b91c1c', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

function InterestsPicker({ initialInterests, initialLanguages, initialCuisines, onSave, onSkip, busy }) {
  const [selected, setSelected] = useState(new Set(initialInterests || []));
  const [selectedLanguages, setSelectedLanguages] = useState(new Set(initialLanguages || []));
  const [selectedCuisines, setSelectedCuisines] = useState(new Set(initialCuisines || []));
  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleLang = (key) => setSelectedLanguages((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleCuis = (key) => setSelectedCuisines((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div id="passport-card" style={passportCardStyle}>
      <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '1.05rem', marginBottom: 4 }}>What are you into?</div>
      <p style={{ color: '#7a3b00', fontSize: '0.86rem', margin: '0 0 14px' }}>Pick a few -- used privately to improve what you see here, never shown to anyone else.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {Object.entries(INTEREST_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => toggle(key)} style={interestPillStyle(selected.has(key))}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 1, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
        Food preference
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {CUISINE_META.map(({ key, label }) => (
          <button key={key} onClick={() => toggleCuis(key)} style={interestPillStyle(selectedCuisines.has(key))}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 1, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
        Language
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {LANGUAGE_META.map(({ key, label }) => (
          <button key={key} onClick={() => toggleLang(key)} style={interestPillStyle(selectedLanguages.has(key))}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => onSave({ interests: [...selected], languages: [...selectedLanguages], cuisines: [...selectedCuisines] })}
          disabled={busy}
          style={{ padding: '10px 18px', background: '#3d2008', border: 'none', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.86rem', cursor: busy ? 'default' : 'pointer' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {onSkip && <button onClick={() => onSkip()} style={{ padding: '10px 18px', background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.86rem', cursor: 'pointer' }}>Skip for now</button>}
      </div>
    </div>
  );
}

// ── Passport stats card -- restyled as a horizontal "profile strip"
// (avatar + greeting, three real stats, Edit profile) matching the new
// layout, with the followed-orgs list and interests underneath. ─────────
function PassportCard({ identity, savedCount, onEditInterests, onToggleFollow, followBusy, onSignOut }) {
  const greetingName = identity.display_name || null;
  const avatarLetter = (identity.display_name || identity.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div id="passport-card" style={passportHeroStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 30 }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, color: '#d4af37', fontWeight: 700, textTransform: 'uppercase' }}>Your world, curated</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogOut size={13} /> Sign out
          </button>
          <button onClick={onEditInterests} style={heroEditProfileBtnStyle}>Edit profile ↗</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 28, marginBottom: 32 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ fontSize: '1.9rem', lineHeight: 1.25, fontFamily: "'Playfair Display', Georgia, serif" }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{greetingName ? `Welcome back, ${greetingName}.` : 'Welcome back.'}</span>
            <br />
            <span style={{ color: '#f5e6c8', fontStyle: 'italic', fontWeight: 700 }}>Go where you belong.</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.92rem', margin: '14px 0 0', maxWidth: 420, lineHeight: 1.6 }}>
            Music, movement, culture, community. The moments that feel like you are waiting to be found.
          </p>
        </div>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(160deg,#ea580c,#92400e)', color: '#fff', fontWeight: 800, fontSize: '2rem',
          fontFamily: "'Playfair Display', Georgia, serif", boxShadow: '0 0 0 6px rgba(212,175,55,0.12), 0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {avatarLetter}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap', paddingTop: 22, marginBottom: 30, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <StatTile value={identity.followed_orgs.length} label="following" />
        <StatTile value={savedCount} label="saved events" />
        <StatTile value={identity.interests.length} label="interests" />
      </div>

      <div style={heroSectionLabelStyle}>Organizations you follow</div>
      {identity.followed_orgs.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
          None yet -- follow an org from its calendar page (or from a card below) and it'll show up here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {identity.followed_orgs.map((org) => (
            <div key={org.org_id} style={heroFollowedOrgCardStyle}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                // See EventCard's own image background above -- same layered fallback.
                background: org.logo_url ? `center/cover no-repeat url(${org.logo_url}), linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)` : `linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)`,
              }}>
                {!org.logo_url && <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{orgInitial(org)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f5e6c8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
                <button
                  onClick={() => onToggleFollow(org, false)}
                  disabled={followBusy === org.org_id}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#7fbf8a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {followBusy === org.org_id ? 'Updating…' : '✓ Following'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={heroSectionLabelStyle}>Your interests</div>
        <button onClick={onEditInterests} style={heroEditLinkStyle}>Edit</button>
      </div>
      {identity.interests.length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>None set yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {identity.interests.map((key) => (
            <span key={key} style={heroChipStyle}>
              {INTEREST_LABELS[key] || key}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={heroSectionLabelStyle}>Food preference</div>
        <button onClick={onEditInterests} style={heroEditLinkStyle}>Edit</button>
      </div>
      {(identity.cuisines || []).length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>None set yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {identity.cuisines.map((key) => (
            <span key={key} style={heroChipStyle}>
              {(CUISINE_META.find((c) => c.key === key) || {}).label || key}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={heroSectionLabelStyle}>Language</div>
        <button onClick={onEditInterests} style={heroEditLinkStyle}>Edit</button>
      </div>
      {(identity.languages || []).length === 0 ? (
        <div style={{ fontSize: '0.86rem', color: 'rgba(255,255,255,0.45)' }}>None set yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {identity.languages.map((key) => (
            <span key={key} style={heroChipStyle}>
              {(LANGUAGE_META.find((l) => l.key === key) || {}).label || key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function OrgCard({ org, identity, followBusy, onToggleFollow }) {
  const following = !!(identity && identity.followed_orgs.some((o) => o.org_id === org.org_id));
  // Google-backfilled orgs (see routes/discover.js's Places integration)
  // have no CalendarFly account -- no subdomain, no calendar page, nothing
  // to follow. The card looks the same as a real org's either way; only
  // the link target and the presence of the Follow button change, so it
  // points somewhere real instead of 404ing and doesn't offer to follow
  // an org that can't accept it.
  const claimed = !!org.subdomain;
  const primaryHref = claimed ? `/calendar?org=${encodeURIComponent(org.subdomain)}` : (org.maps_url || org.source_url || '#');
  const outboundProps = claimed ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  const avatar = (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: org.logo_url ? `center/cover no-repeat url(${org.logo_url}), linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)` : `linear-gradient(160deg, ${org.primary_color || '#ea580c'}, #92400e)`,
    }}>
      {!org.logo_url && <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{orgInitial(org)}</span>}
    </div>
  );
  return (
    <div style={orgCardStyle} className="cf-org-card">
      <div className="cf-card-visual-desktop">
        <a href={primaryHref} {...outboundProps} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {avatar}
          <div style={{ textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#3d2008', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
            <div style={{ fontSize: 11, color: '#9a7a55' }}>{org.distance_miles} mi away</div>
          </div>
        </a>
        {identity && claimed && (
          <button
            onClick={() => onToggleFollow(org, !following)}
            disabled={followBusy === org.org_id}
            style={{
              display: 'block', margin: '0 auto',
              border: following ? '1px solid #2f6b3a' : '1px solid #b45309',
              background: 'none', color: following ? '#2f6b3a' : '#92400e',
              fontSize: 11.5, fontWeight: 700, padding: '5px 14px', borderRadius: 999,
              cursor: followBusy === org.org_id ? 'default' : 'pointer',
            }}
          >
            {followBusy === org.org_id ? 'Updating…' : following ? '✓ Following' : '+ Follow'}
          </button>
        )}
      </div>

      {/* Compact mobile row -- the org's OWN logo/initial stays the leading
          "picture" here (not the category icon): these rows already sit
          grouped under one category's header, so a repeated category icon
          on every row would be redundant -- the org's own avatar is what
          actually differs from one row to the next. */}
      <a href={primaryHref} {...outboundProps} className="cf-card-row">
        {avatar}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#3d2008', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</div>
          <div style={{ fontSize: 11.5, color: '#9a7a55', marginTop: 2 }}>{org.distance_miles} mi away</div>
        </div>
        <ChevronRight size={16} color="#c9b98e" style={{ flexShrink: 0 }} />
      </a>
    </div>
  );
}

function NearbyOrgs({
  orgs, loading, error, locationStatus, identity, followBusy, onToggleFollow, onWiderSearch,
}) {
  // Grouped by category -- the server already keeps only each category's
  // closest 5 (see discover.js), so one dense category (e.g. dance
  // schools in a dance-heavy suburb) can't crowd every other category out
  // of the list the way a single flat top-20 used to. Map preserves the
  // server's own category order (already ranked by interest match, then
  // distance), so no re-sorting needed here.
  const groups = useMemo(() => {
    const map = new Map();
    for (const org of orgs) {
      const key = org.category || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(org);
    }
    return Array.from(map.entries());
  }, [orgs]);

  return (
    <div>
      {locationStatus === 'locating' && <div style={emptyMiniStyle}>Finding organizations near you…</div>}
      {loading && <div style={emptyMiniStyle}>Loading nearby organizations…</div>}
      {error && <div style={emptyMiniStyle}>{error}</div>}
      {!loading && !error && locationStatus !== 'locating' && orgs.length === 0 && (
        <div style={emptyMiniStyle}>
          No organizations found nearby yet. Try searching a city or ZIP code above, or widening your radius.
        </div>
      )}

      {groups.map(([category, list]) => {
        const { icon: Icon, color } = categoryMeta(category);
        return (
          <div key={category} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon size={15} color={color} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3d2008' }}>{categoryLabel(category)}</span>
            </div>
            <ScrollRow>
              {list.map((org) => (
                <OrgCard key={org.org_id} org={org} identity={identity} followBusy={followBusy} onToggleFollow={onToggleFollow} />
              ))}
            </ScrollRow>
          </div>
        );
      })}

      {orgs.length > 0 && (
        <button onClick={onWiderSearch} style={{ marginTop: 4, background: 'none', border: 'none', color: '#c2410c', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
          Search a wider area →
        </button>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, action, onAction }) {
  const Icon = icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={20} color="#c2410c" />
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 800, color: '#3d2008', margin: 0 }}>{title}</h2>
        </div>
        {subtitle && <p style={{ color: '#9a7a55', fontSize: '0.88rem', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: '#c2410c', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function PublicRadarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all'); // all|today|weekend
  const [searchTerm, setSearchTerm] = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [savedEventIds, setSavedEventIds] = useState(() => getSavedEventIds());

  const [identityToken, setIdentityTokenState] = useState(getIdentityToken());
  const [identity, setIdentity] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(!!identityToken);
  const [editingInterests, setEditingInterests] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);
  const [followBusy, setFollowBusy] = useState(null);

  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('locating');
  const [searchRadius, setSearchRadius] = useState(15);
  const [manualAddress, setManualAddress] = useState('');
  const [nearbyOrgs, setNearbyOrgs] = useState([]);
  // A second, always-wide-radius copy of the same nearby-orgs data, used
  // only by "Top picks by interest" below (see wideFlatEvents/
  // swimLaneEvents) -- see that section's own comment for why it can't
  // just reuse nearbyOrgs (that one follows the visitor's own, often much
  // tighter, searchRadius).
  const [wideNearbyOrgs, setWideNearbyOrgs] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');

  // Cuisine/language preferences persist to the Community Passport
  // (identity.languages/identity.cuisines) once one exists, same as
  // interests -- but plenty of visitors browse Explore before ever
  // completing the passport flow, so these two also work standalone via
  // local-only state until an identity shows up (see toggleLanguage/
  // toggleCuisine below).
  const [localLanguages, setLocalLanguages] = useState([]);
  const [localCuisines, setLocalCuisines] = useState([]);
  const activeLanguages = identity ? (identity.languages || []) : localLanguages;
  const activeCuisines = identity ? (identity.cuisines || []) : localCuisines;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/radar')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load Explore.');
        return data;
      })
      .then((data) => { if (!cancelled) setEvents(data.events || []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!identityToken) { setIdentityLoading(false); return; }
    let cancelled = false;
    identityFetch('/api/identity/me', { token: identityToken })
      .then((data) => { if (!cancelled) setIdentity(data); })
      .catch(() => { if (!cancelled) { clearIdentityToken(); setIdentityTokenState(null); } })
      .finally(() => { if (!cancelled) setIdentityLoading(false); });
    return () => { cancelled = true; };
  }, [identityToken]);

  useEffect(() => {
    if (!('geolocation' in navigator)) { setLocationStatus('denied'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('granted'); },
      () => setLocationStatus('denied'),
      { timeout: 8000 },
    );
  }, []);

  const fetchNearby = async (params) => {
    setNearbyLoading(true);
    setNearbyError('');
    try {
      const qs = new URLSearchParams({
        radius: String(searchRadius),
        ...(identity && identity.interests.length ? { interests: identity.interests.join(',') } : {}),
        ...params,
      });
      const res = await fetch(`/api/discover/nearby?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load nearby organizations.');
      setNearbyOrgs(data.orgs || []);
    } catch (err) {
      setNearbyError(err.message);
    } finally {
      setNearbyLoading(false);
    }
  };

  const interestsKey = identity ? identity.interests.join(',') : '';
  useEffect(() => {
    if (coords) fetchNearby({ lat: coords.lat, lng: coords.lng });
    else if (manualAddress) fetchNearby({ address: manualAddress });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, interestsKey, searchRadius]);

  // "Top picks by interest" (InterestSwimLanes, below) wants breadth
  // across interests, not strict proximity -- "Happening near you" is
  // deliberately tight to whatever radius the visitor picked (default 15
  // miles), but a real event just outside that radius (a music school 28
  // miles out, say) shouldn't make an interest lane vanish just because it
  // missed a cutoff meant for a DIFFERENT section. So this always queries
  // the max radius /api/discover/nearby supports (60mi), independent of
  // the visitor's own searchRadius slider -- same location, wider net,
  // one extra request. Best-effort: a failure here just means fewer/no
  // swim lanes (see wideFlatEvents/swimLaneEvents below), the same silent
  // "no signal -> show less" degrade as everywhere else on this page,
  // never an error banner of its own.
  useEffect(() => {
    if (!coords && !manualAddress) { setWideNearbyOrgs([]); return; }
    let cancelled = false;
    const qs = new URLSearchParams({
      radius: '60',
      ...(identity && identity.interests.length ? { interests: identity.interests.join(',') } : {}),
      ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : { address: manualAddress }),
    });
    fetch(`/api/discover/nearby?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setWideNearbyOrgs(data.orgs || []); })
      .catch(() => { if (!cancelled) setWideNearbyOrgs([]); });
    return () => { cancelled = true; };
  }, [coords, manualAddress, interestsKey]);

  const toggleSaved = (eventId) => {
    setSavedEventIds((prev) => {
      const next = new Set(prev);
      next.has(eventId) ? next.delete(eventId) : next.add(eventId);
      persistSavedEventIds(next);
      return next;
    });
  };

  const looksLikeLocation = (q) => /^\d{5}(-\d{4})?$/.test(q) || /,/.test(q);
  const handleHeroSearch = () => {
    const q = heroQuery.trim();
    setSearchTerm(q);
    if (q && looksLikeLocation(q)) {
      setManualAddress(q);
      setLocationStatus('granted');
      fetchNearby({ address: q });
    }
  };

  const toggleInterest = (key) => {
    if (!identity) return;
    const has = identity.interests.includes(key);
    const next = has ? identity.interests.filter((k) => k !== key) : [...identity.interests, key];
    saveInterests(next);
  };

  const saveInterests = async (interests) => {
    setSavingInterests(true);
    try {
      const data = await identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ interests }) });
      setIdentity((prev) => ({ ...prev, interests: data.interests }));
      setEditingInterests(false);
    } catch {
      // Best-effort -- leave the picker open so they can retry.
    } finally {
      setSavingInterests(false);
    }
  };

  // Combined save for the full profile editor (InterestsPicker below --
  // interests, food preference, and language all in one screen/one Save
  // button, rather than three separate PATCHes).
  const saveProfilePrefs = async ({ interests, languages, cuisines }) => {
    setSavingInterests(true);
    try {
      const data = await identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ interests, languages, cuisines }) });
      setIdentity((prev) => ({ ...prev, interests: data.interests, languages: data.languages, cuisines: data.cuisines }));
      setEditingInterests(false);
    } catch {
      // Best-effort -- leave the picker open so they can retry.
    } finally {
      setSavingInterests(false);
    }
  };

  const toggleLanguage = (key) => {
    const has = activeLanguages.includes(key);
    const next = has ? activeLanguages.filter((k) => k !== key) : [...activeLanguages, key];
    if (!identity) { setLocalLanguages(next); return; }
    identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ languages: next }) })
      .then((data) => setIdentity((prev) => ({ ...prev, languages: data.languages })))
      .catch(() => {
        // Best-effort, same as toggleInterest -- keep the local pill state
        // even if the save itself failed, so the filter still works for
        // this visit.
        setIdentity((prev) => ({ ...prev, languages: next }));
      });
  };

  const toggleCuisine = (key) => {
    const has = activeCuisines.includes(key);
    const next = has ? activeCuisines.filter((k) => k !== key) : [...activeCuisines, key];
    if (!identity) { setLocalCuisines(next); return; }
    identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ cuisines: next }) })
      .then((data) => setIdentity((prev) => ({ ...prev, cuisines: data.cuisines })))
      .catch(() => {
        setIdentity((prev) => ({ ...prev, cuisines: next }));
      });
  };

  const clearFoodLanguageFilters = () => {
    setLocalLanguages([]);
    setLocalCuisines([]);
    if (!identity) return;
    identityFetch('/api/identity/me', { token: identityToken, method: 'PATCH', body: JSON.stringify({ languages: [], cuisines: [] }) })
      .then((data) => setIdentity((prev) => ({ ...prev, languages: data.languages, cuisines: data.cuisines })))
      .catch(() => setIdentity((prev) => ({ ...prev, languages: [], cuisines: [] })));
  };

  const toggleFollow = async (org, follow) => {
    const org_id = org.org_id;
    setFollowBusy(org_id);
    try {
      await identityFetch(`/api/identity/${follow ? 'follow' : 'unfollow'}/${org_id}`, { token: identityToken, method: 'POST' });
      setIdentity((prev) => ({
        ...prev,
        followed_orgs: follow
          ? [...prev.followed_orgs.filter((o) => o.org_id !== org_id), {
              org_id, name: org.name, subdomain: org.subdomain,
              category: org.category, logo_url: org.logo_url, primary_color: org.primary_color,
            }]
          : prev.followed_orgs.filter((o) => o.org_id !== org_id),
      }));
    } catch {
      // Best-effort -- UI just doesn't update on failure, no crash.
    } finally {
      setFollowBusy(null);
    }
  };

  const signOut = () => {
    clearIdentityToken();
    setIdentityTokenState(null);
    setIdentity(null);
  };

  const categories = useMemo(() => {
    const seen = new Map();
    for (const e of events) {
      if (e.org?.category) seen.set(e.org.category, (seen.get(e.org.category) || 0) + 1);
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]).map(([key]) => key);
  }, [events]);

  const visibleEvents = useMemo(() => {
    let list = events;
    if (activeCategory !== 'all') list = list.filter((e) => e.org?.category === activeCategory);
    if (quickFilter === 'today') { const t = todayIsoLocal(); list = list.filter((e) => e.date === t); }
    if (quickFilter === 'weekend') list = list.filter((e) => isThisWeekend(e.date));
    if (searchTerm && !looksLikeLocation(searchTerm)) {
      const q = searchTerm.toLowerCase();
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.org?.name || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q));
    }
    return list;
  }, [events, activeCategory, quickFilter, searchTerm]);

  // "Happening near you" used to just be the whole platform's radar feed
  // (unscoped -- same events regardless of where the visitor actually is),
  // which didn't match its own name. It now derives from the same
  // GET /api/discover/nearby response already fetched for "Organizations
  // near you" (which carries each nearby org's upcoming_events -- see
  // discover.js), so a ZIP/city typed into the hero search (handleHeroSearch
  // sets manualAddress -> fetchNearby) or granted geolocation drives BOTH
  // sections from one real, location-aware source instead of two
  // disconnected ones.
  const hasLocation = !!(coords || manualAddress);

  // Flattens wideNearbyOrgs (always 60mi -- see the fetch effect above) into
  // one real, ranked event list. wideNearbyOrgs is a strict radius-superset
  // of nearbyOrgs (searchRadius maxes out at the same 60mi this always
  // queries), so this single list now serves BOTH "Happening near you"
  // (visibleNearbyEvents, capped back down with real distance in mind) and
  // "Top picks by interest" (swimLaneEvents).
  //
  // Ranked by interest match, then real distance, then soonest date --
  // "based on interest and distance", not just interest-then-date like
  // before. interest_match comes from the visitor's saved Community
  // Passport interests (identity.interests), the same real signal
  // /api/discover/nearby already ranks orgs by; anonymous visitors with no
  // passport get interest_match 0 for everyone, which just degrades to
  // distance-then-date -- still real, never fabricated relevance.
  const wideFlatEvents = useMemo(() => {
    const flat = [];
    for (const org of wideNearbyOrgs) {
      for (const ev of (org.upcoming_events || [])) {
        flat.push({
          ...ev,
          org: {
            org_id: org.org_id, name: org.name, subdomain: org.subdomain,
            category: org.category, logo_url: org.logo_url, primary_color: org.primary_color,
            cuisine_tags: org.cuisine_tags || [], distance_miles: org.distance_miles,
          },
          _interestMatch: org.interest_match || 0,
        });
      }
    }
    flat.sort((a, b) => {
      if (b._interestMatch !== a._interestMatch) return b._interestMatch - a._interestMatch;
      const ad = a.org?.distance_miles ?? Infinity;
      const bd = b.org?.distance_miles ?? Infinity;
      if (ad !== bd) return ad - bd;
      return (a.date || '').localeCompare(b.date || '');
    });
    return flat;
  }, [wideNearbyOrgs]);

  // Interest swim lanes (InterestSwimLanes, below) want the same real
  // breadth of content "Happening near you" already has -- not just this
  // app's own hosted events (the `events` state, from /api/radar) but also
  // the directory-sourced ones wideFlatEvents pulls in (scraped/Google-
  // Places orgs with their own upcoming_events, which never go through
  // getRadarEvents/discoverability='radar' since they're not real DB rows
  // -- see server/utils/directorySources.js), at the WIDE 60mi radius so
  // an interest lane doesn't disappear just because its only matching
  // event happens to sit outside whatever tighter radius "Happening near
  // you" is using right now. Without the directory-sourced half of this at
  // all, a market like this app's own early one -- real orgs haven't
  // started opting events into Radar yet, but plenty of directory-sourced
  // events already show in "Happening near you" -- would show a
  // "Happening near you" full of events and an empty, seemingly-broken
  // "Top picks by interest" right under it. Deduped by event_id in case a
  // real CalendarFly org's radar event is ALSO within the wide radius and
  // would otherwise count (and display) twice.
  const swimLaneEvents = useMemo(() => {
    const byId = new Map();
    for (const event of events) byId.set(event.event_id, event);
    for (const event of wideFlatEvents) if (!byId.has(event.event_id)) byId.set(event.event_id, event);
    return [...byId.values()];
  }, [events, wideFlatEvents]);

  const visibleNearbyEvents = useMemo(() => {
    let list = wideFlatEvents;
    if (activeCategory !== 'all') list = list.filter((e) => e.org?.category === activeCategory);
    if (quickFilter === 'today') { const t = todayIsoLocal(); list = list.filter((e) => e.date === t); }
    if (quickFilter === 'weekend') list = list.filter((e) => isThisWeekend(e.date));
    // "Language"/"Food" preferences (see LANGUAGE_META/CUISINE_META above)
    // -- narrows the 10 language-association categories to just the
    // language(s) picked, and 'restaurant' to just the cuisine(s) picked;
    // everything else is untouched.
    list = list.filter((e) => orgMatchesPrefs(e.org, activeLanguages, activeCuisines));
    if (searchTerm && !looksLikeLocation(searchTerm)) {
      const q = searchTerm.toLowerCase();
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.org?.name || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q));
    }
    // At most 2 from the same org (see capByOrg above), then top 10 --
    // still the same curated "near you" pick, just no longer one busy org
    // filling every slot the moment it has more events than anyone else.
    return capByOrg(list, 2, 10);
  }, [wideFlatEvents, activeCategory, quickFilter, searchTerm, activeLanguages, activeCuisines]);

  // True when this list had to reach past the visitor's own searchRadius
  // to fill out -- i.e. wideFlatEvents (60mi) supplied something
  // nearbyOrgs (searchRadius) alone wouldn't have. Drives the honest
  // subtitle below instead of silently claiming "within N miles" for a
  // list that no longer strictly is.
  const usedWiderRadius = useMemo(
    () => visibleNearbyEvents.some((e) => (e.org?.distance_miles ?? 0) > searchRadius),
    [visibleNearbyEvents, searchRadius]
  );

  // Same language/cuisine narrowing for "Organizations near you" -- that
  // section (NearbyOrgs) groups nearbyOrgs by category itself and isn't
  // affected by activeCategory today, but it should still respect a
  // language/cuisine preference the same way the events list above does.
  const visibleNearbyOrgs = useMemo(
    () => nearbyOrgs.filter((org) => orgMatchesPrefs(org, activeLanguages, activeCuisines)),
    [nearbyOrgs, activeLanguages, activeCuisines]
  );

  const isFirstTimeIdentity = identity && identity.interests.length === 0 && !identity.display_name;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <PublicPageBackdrop />
      <ExploreTopBar identity={identity} identityLoading={identityLoading} onSignOut={signOut} />

      <ExploreHero
        heroQuery={heroQuery}
        setHeroQuery={setHeroQuery}
        onSearchSubmit={handleHeroSearch}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        showCategoryFilters={showCategoryFilters}
        setShowCategoryFilters={setShowCategoryFilters}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '-56px auto 0', padding: '0 24px 72px', overflowX: 'hidden' }}>
        <style>{`
          /* Below 640px, the horizontally-scrolling "Happening near you" /
             "Organizations near you" carousels (ScrollRow, .cf-explore-
             scrollrow) become impossible to scan on a phone -- only a
             sliver of one card is visible at a time, and the chevron nav
             buttons (.cf-explore-scrollbtn) sit awkwardly on top of card
             content instead of real UI chrome. Below that width, the row
             becomes a plain vertical list instead, and each card swaps its
             photo-style desktop layout (.cf-card-visual-desktop) for a
             compact row (.cf-card-row) -- a small category-colored icon
             tile up front (reusing the same per-category icons from the
             "Organizations near you" section headers) plus the essentials,
             full-width and thumb-scannable.
          */
          .cf-card-row { display: none; }
          /* Elevated Minimal: the desktop event card lifts and its shadow
             deepens on hover, instead of sitting flat -- the card itself
             already carries the transition, this just supplies the target
             state. */
          .cf-event-card:hover { transform: translateY(-6px); box-shadow: 0 4px 10px rgba(61,32,8,0.07), 0 20px 44px rgba(61,32,8,0.18); }
          @media (max-width: 640px) {
            .cf-explore-scrollrow { flex-direction: column !important; overflow-x: visible !important; scroll-snap-type: none !important; }
            .cf-explore-scrollbtn { display: none !important; }
            .cf-event-card, .cf-org-card { flex: 1 1 auto !important; width: 100% !important; }
            .cf-card-visual-desktop { display: none !important; }
            .cf-card-row { display: flex !important; align-items: center; gap: 12px; padding: 12px; text-decoration: none; width: 100%; box-sizing: border-box; }
          }
        `}</style>

        {!identityToken && <PassportOnboarding onVerified={(newIdentity) => { setIdentityTokenState(getIdentityToken()); setIdentity(newIdentity); }} />}
        {identityToken && identityLoading && (
          <div id="passport-card" style={{ ...passportCardStyle, color: '#9a7a55', fontSize: '0.88rem' }}>Loading your passport…</div>
        )}
        {identityToken && !identityLoading && identity && (isFirstTimeIdentity || editingInterests) && (
          <InterestsPicker
            initialInterests={identity.interests}
            initialLanguages={identity.languages || []}
            initialCuisines={identity.cuisines || []}
            busy={savingInterests}
            onSave={saveProfilePrefs}
            onSkip={isFirstTimeIdentity ? () => setIdentity((prev) => ({ ...prev, interests: [], languages: [], cuisines: [] })) : undefined}
          />
        )}
        {identityToken && !identityLoading && identity && !isFirstTimeIdentity && !editingInterests && (
          <PassportCard
            identity={identity}
            savedCount={savedEventIds.size}
            onEditInterests={() => setEditingInterests(true)}
            onToggleFollow={toggleFollow}
            followBusy={followBusy}
            onSignOut={signOut}
          />
        )}

        {showCategoryFilters && (
          <div style={{ marginBottom: 28 }}>
            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                <button onClick={() => setActiveCategory('all')} style={pillStyle(activeCategory === 'all')}>All</button>
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={pillStyle(activeCategory === cat)}>{categoryLabel(cat)}</button>
                ))}
              </div>
            )}

            {/* Food preference -- narrows 'restaurant' orgs/events to the
                cuisine(s) picked (see CUISINE_META/orgMatchesPrefs above).
                Shown regardless of whether a restaurant is in view right
                now, same as the category row above lets you pick ahead. */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                Food preference
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CUISINE_META.map(({ key, label }) => (
                  <button key={key} onClick={() => toggleCuisine(key)} style={pillStyle(activeCuisines.includes(key))}>{label}</button>
                ))}
              </div>
            </div>

            {/* Language -- narrows the 10 language-association categories
                to the language(s) picked (multi-select, unlike the single
                activeCategory pill above). */}
            <div>
              <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#9a7a55', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                Language
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LANGUAGE_META.map(({ key, label }) => (
                  <button key={key} onClick={() => toggleLanguage(key)} style={pillStyle(activeLanguages.includes(key))}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasLocation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            <label htmlFor="cf-radius-slider" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3d2008', whiteSpace: 'nowrap' }}>
              Search radius
            </label>
            <input
              id="cf-radius-slider"
              type="range"
              min={5}
              max={60}
              step={5}
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              style={{ flex: '1 1 200px', maxWidth: 320, accentColor: '#c2410c' }}
            />
            <span style={{ fontSize: '0.82rem', color: '#9a7a55', minWidth: 64 }}>{searchRadius} miles</span>
          </div>
        )}

        <div id="happening-near-you" style={{ marginBottom: 48, scrollMarginTop: 90 }}>
          <SectionHeader
            icon={MapPin}
            title="Happening near you"
            subtitle={
              !hasLocation
                ? 'Enter a ZIP or city above to see what\'s coming up near you'
                : usedWiderRadius
                ? `Ranked by interest and distance -- a couple of picks reach past ${searchRadius} miles since there wasn't more variety closer in`
                : `Top picks within ${searchRadius} miles${identity && identity.interests.length ? ', based on your interests' : ''}`
            }
            action={(activeCategory !== 'all' || quickFilter !== 'all' || searchTerm || activeLanguages.length || activeCuisines.length) ? 'Clear filters' : null}
            onAction={() => { setActiveCategory('all'); setQuickFilter('all'); setSearchTerm(''); setHeroQuery(''); clearFoodLanguageFilters(); }}
          />
          {!hasLocation && locationStatus === 'locating' ? (
            <div style={emptyState}>Finding events near you…</div>
          ) : !hasLocation ? (
            <div style={emptyState}>Enter your ZIP code or city in the search box above to see real events happening near you.</div>
          ) : nearbyLoading ? (
            <div style={emptyState}>Finding events near you…</div>
          ) : nearbyError ? (
            <div style={emptyState}>{nearbyError}</div>
          ) : visibleNearbyEvents.length === 0 ? (
            <div style={emptyState}>No upcoming events match right now near you. Try a wider area or clear your filters.</div>
          ) : (
            <ScrollRow>
              {visibleNearbyEvents.map((event) => (
                <EventCard key={event.event_id} event={event} saved={savedEventIds.has(event.event_id)} onToggleSave={toggleSaved} />
              ))}
            </ScrollRow>
          )}
        </div>

        <InterestSwimLanes events={swimLaneEvents} identity={identity} />

        {categories.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <SectionHeader icon={Sparkles} title="Explore your community" subtitle="Browse events by organization type" />
            <CategoryGrid events={events} categories={categories} onPick={(cat) => { setActiveCategory(cat); scrollToId('happening-near-you'); }} />
          </div>
        )}

        <div id="organizations-near-you" style={{ marginBottom: 12, scrollMarginTop: 90 }}>
          <SectionHeader icon={Users} title="Organizations near you" subtitle={locationStatus === 'denied' ? 'Search a city or ZIP above to find organizations' : undefined} />
          <NearbyOrgs
            orgs={visibleNearbyOrgs}
            loading={nearbyLoading}
            error={nearbyError}
            locationStatus={locationStatus}
            identity={identity}
            followBusy={followBusy}
            onToggleFollow={toggleFollow}
            onWiderSearch={() => setSearchRadius((r) => Math.min(r + 25, 100))}
          />
        </div>

      </div>

      {/* Full-bleed, edge-to-edge like the hero and top bar -- not boxed
          inside the maxWidth:1200 content column above -- with a real
          sunset-gradient photo background (public/marketing/explore-cta-
          sunset.jpg, generated in-house rather than sourced/fabricated
          stock photography of people) instead of the earlier hand-drawn
          silhouette attempt, which didn't read well at real size. */}
      <div style={ctaBannerStyle}>
        <div style={ctaBannerInnerStyle}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, fontSize: '1.3rem', color: '#3d2008' }}>
              Stronger communities, happier people. ♥
            </div>
            <p style={{ color: '#5a3414', fontSize: '0.88rem', margin: '6px 0 0', maxWidth: 420 }}>
              Run an organization? Turn on <b>Show on Explore</b> when creating an event to be listed here — free to start.
            </p>
          </div>
          <a href="/signup" style={ctaButtonStyle}>Get started free <ArrowRight size={15} /></a>
        </div>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    border: active ? 'none' : '1px solid #e8d5a3',
    background: active ? '#3d2008' : '#ffffff',
    color: active ? '#fff' : '#7a3b00',
    fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function interestPillStyle(active) {
  return {
    border: active ? 'none' : '1px solid #e8d5a3',
    background: active ? '#3d2008' : '#ffffff',
    color: active ? '#fff' : '#7a3b00',
    fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function heroPillStyle(active) {
  return {
    border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.4)',
    background: active ? '#fff' : 'rgba(0,0,0,0.2)',
    color: active ? '#7a3b00' : '#fff',
    fontSize: 12.5, fontWeight: 700, padding: '8px 16px', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  };
}

function categoryTileStyle(color) {
  return {
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start',
    padding: '18px 16px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
    background: `linear-gradient(150deg, ${color}, #2b160a)`, minHeight: 110,
  };
}

const categoryIconWrapStyle = {
  width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.22)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
};

const topBarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '12px 24px', background: '#1a0e04', borderBottom: '1px solid #3a2008',
  position: 'sticky', top: 0, zIndex: 500, fontFamily: "'DM Sans', sans-serif",
};
const topBarLinkStyle = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.85rem',
  padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap',
};
const topBarLinkActiveStyle = { background: '#c2410c', color: '#fff' };
const topBarAccountStyle = {
  display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: 'none',
  borderRadius: 999, padding: '6px 14px 6px 6px', cursor: 'pointer', color: '#fff', fontSize: '0.85rem', fontWeight: 700,
};
const topBarAvatarStyle = {
  width: 26, height: 26, borderRadius: '50%', background: '#c2410c', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0,
};

const heroStyle = {
  padding: '48px 24px 96px', background: 'radial-gradient(120% 160% at 85% 15%, #2b1608 0%, #000000 55%)',
  position: 'relative', overflow: 'hidden',
};

const heroSearchBtnStyle = {
  width: 40, height: 40, borderRadius: 10, background: '#c2410c', border: 'none', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
};

const scrollRowStyle = {
  display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity',
};
const scrollBtnStyle = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%',
  background: '#fff', border: '1px solid #e8d5a3', boxShadow: '0 2px 10px rgba(180,120,0,0.18)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7a3b00', zIndex: 2,
};

const eventCardStyle = {
  position: 'relative', flex: '0 0 260px', scrollSnapAlign: 'start', background: '#fff',
  borderRadius: 18, overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(61,32,8,0.06), 0 8px 24px rgba(61,32,8,0.09)',
  transition: 'transform 0.22s ease, box-shadow 0.22s ease',
};
const laneColumnStyle = {
  flex: '0 0 260px', scrollSnapAlign: 'start', background: '#fff', border: '1px solid #f0e4c8',
  borderRadius: 16, padding: 14, boxShadow: '0 2px 10px rgba(180,120,0,0.06)',
};
const laneCardStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10,
  textDecoration: 'none', transition: 'background 0.15s ease',
};

const cardPrimaryBtnStyle = {
  flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 999, background: '#c2410c', color: '#fff',
  fontWeight: 700, fontSize: 12.5, textDecoration: 'none', boxShadow: '0 6px 14px rgba(194,65,12,0.3)',
};
const cardSecondaryBtnStyle = {
  flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 999, background: '#fff', border: '1px solid #e8d5a3',
  color: '#7a3b00', fontWeight: 700, fontSize: 12.5, textDecoration: 'none',
};

const orgCardStyle = {
  flex: '0 0 140px', scrollSnapAlign: 'start', background: '#fff', border: '1px solid #e8d5a3',
  borderRadius: 14, padding: 14, boxShadow: '0 2px 10px rgba(180,120,0,0.06)',
};

const editProfileBtnStyle = {
  padding: '9px 16px', background: '#fff', border: '1px solid #d4af37', color: '#7a3b00',
  borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
};

const ctaBannerStyle = {
  marginTop: 40,
  // position+zIndex matter here, not just cosmetic: PublicPageBackdrop is a
  // position:fixed, z-index:0 layer behind the whole page. Per CSS paint
  // order, ANY positioned element paints above non-positioned (static)
  // content regardless of z-index value -- so without this, the backdrop's
  // near-white background silently painted over this banner even though it
  // was correctly sized and present in the DOM (hence "it's there but I
  // can't see it").
  position: 'relative', zIndex: 1,
  backgroundImage: "url('/marketing/explore-cta-sunset.jpg')",
  backgroundSize: 'cover', backgroundPosition: 'center',
};
const ctaBannerInnerStyle = {
  maxWidth: 1200, margin: '0 auto', padding: '40px 24px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18,
};
const ctaButtonStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '12px 22px', borderRadius: 10,
  background: '#fff', color: '#7a3b00', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap',
};

const passportCardStyle = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 16,
  padding: '20px 22px', marginBottom: 28, boxShadow: '0 10px 32px rgba(120,70,0,0.14)', scrollMarginTop: 90,
};

// ── Dark "hero" treatment for the fully-loaded My CalendarFly passport card
// only (the sign-in / onboarding / loading states above still use the
// light passportCardStyle) -- a premium, magazine-style welcome moment
// rather than a plain settings panel. ───────────────────────────────────
const passportHeroStyle = {
  position: 'relative', overflow: 'hidden',
  background: 'radial-gradient(ellipse 900px 500px at 82% 8%, rgba(217,119,6,0.35), transparent 60%), linear-gradient(160deg, #1c1108 0%, #120b05 55%, #050302 100%)',
  border: '1px solid rgba(212,175,55,0.25)', borderRadius: 26,
  padding: '36px 40px', marginBottom: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', scrollMarginTop: 90,
};

const heroSectionLabelStyle = {
  fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8,
};

const heroEditProfileBtnStyle = {
  padding: '9px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.4)', color: '#f5e6c8',
  borderRadius: 999, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
};

const heroEditLinkStyle = {
  background: 'none', border: 'none', color: '#e8b84a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
};

const heroChipStyle = {
  fontSize: 12, fontWeight: 700, color: '#f0d9a0', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 999, padding: '4px 10px',
};

const heroFollowedOrgCardStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: 10,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
};

const emptyMiniStyle = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 14,
  padding: '18px 16px', textAlign: 'center', color: '#92400e', fontSize: '0.88rem',
  boxShadow: '0 4px 20px rgba(180,120,0,0.08)',
};

const emptyState = {
  background: '#ffffff', border: '1px solid #d4af37', borderRadius: 14,
  padding: '40px 16px', textAlign: 'center', color: '#92400e', fontSize: '0.92rem',
  fontFamily: "'DM Sans', sans-serif",
  boxShadow: '0 4px 20px rgba(180,120,0,0.08)',
};
