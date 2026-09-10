/**
 * CalendarGrid.jsx
 * Warm charcoal theme — no EventCard dependency.
 * - Panchang: styled lavender pill (parses raw title string OR tithi/nakshatra fields)
 * - Public (isAdmin=false) events: +GCal / RSVP visible
 * - Admin events: only Edit / Flyer / Del below each event (no +GCal — that stays public-only)
 * - Mobile: agenda list view under 768px
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, FileText, Trash2 } from 'lucide-react';
import { getRsvpUrl } from '../utils/rsvpUrl';

// ── Theme-aware palette (reads CSS variables set by themeManager) ─────────────
const P = {
  get root()    { return 'var(--cf-bg-base)' },
  get toolbar() { return 'var(--cf-header-bg)' },
  get sidebar() { return 'var(--cf-sidebar-bg)' },
  get card()    { return 'var(--cf-bg-card)' },
  get cardHov() { return 'var(--cf-bg-card)' },
  get border()  { return 'var(--cf-border)' },
  get today()   { return 'var(--cf-bg-card)' },
  // Plain calendar text (day numbers, event labels, muted metadata) is
  // pure black for readability — color-coding now lives entirely in the
  // pastel event-pill backgrounds, not the text itself.
  get textPri() { return '#000000' },
  get textMut() { return '#000000' },
  get textSec() { return '#000000' },
};

// The exact gold gradient + ink text used by the "+ Add Event" button
// (see .cf-nav-btn.cf-nav-cta in index.css) — reused here so "today" is
// highlighted with the same color as that button.
const TODAY_GRADIENT = 'linear-gradient(135deg,#d9a847,#b17f26)';
const TODAY_INK = '#1a0e04';
// ── Event type colors ─────────────────────────────────────────────────────────
// Each real, creatable event type (see AddEventModal.jsx's EVENT_TYPES) gets
// its own distinct color so the calendar reads at a glance. `solid` is used
// for the pill-style event chips; `border`/`bg`/`text` are used for outlines,
// selection rings, and the shared action toolbar.
// `solid` = a vivid dot for the legend (small dots read fine in saturated
// color); `pastel` = the soft, light background used on the actual event
// chips; `text` = a darkened version of the same hue for readable contrast
// on the pastel background; `border` = a mid-tone used for outlines/rings.
const TYPE_COLORS = {
  pooja:      { solid: '#f97316', pastel: '#ffe4c2', border: '#f0b877', text: '#9a5b12' },
  festival:   { solid: '#dc2626', pastel: '#ffd9d6', border: '#eba9a4', text: '#a13a35' },
  holiday:    { solid: '#8b5cf6', pastel: '#e6ddfb', border: '#c4b0ee', text: '#6b46a8' },
  kalyanam:   { solid: '#eab308', pastel: '#fbf0bd', border: '#e6d182', text: '#8a6a0a' },
  abhishekam: { solid: '#06b6d4', pastel: '#cdf1f6', border: '#93dbe6', text: '#0e7a8a' },
  class:      { solid: '#0d9488', pastel: '#cdece3', border: '#93d5c3', text: '#0f6d5c' },
  default:    { solid: '#c9943a', pastel: '#f2e3c4', border: '#dfc68e', text: '#8a6a2a' },
};

// Events synced in from the WhatsApp/panchang bot (and some older imports)
// were saved with type:'event' or no type at all instead of one of the real
// EVENT_TYPES — that's why every event was rendering in the same default
// gold color. Since we can't safely rewrite those records from here, when
// the type is missing/generic we infer a color from keywords in the title
// so the calendar still reads as color-coded instead of one flat color.
function inferTypeFromTitle(title = '') {
  const t = title.toLowerCase();
  if (t.includes('abhishekam')) return 'abhishekam';
  if (t.includes('kalyanam')) return 'kalyanam';
  if (t.includes('pooja') || t.includes('puja') || t.includes('homam') || t.includes('vratam') || t.includes('archana')) return 'pooja';
  if (
    t.includes('jayanti') || t.includes('festival') || t.includes('utsav') ||
    t.includes('panchami') || t.includes('krittika') || t.includes('upakarma') ||
    t.includes('purnima') || t.includes('purnama') || t.includes('amavasya') ||
    t.includes('navratri') || t.includes('ekadashi') || t.includes('sankranti')
  ) return 'festival';
  return null;
}

function getTypeColor(type = '', title = '') {
  const key = (type || '').toLowerCase();
  if (key && key !== 'event' && TYPE_COLORS[key]) return TYPE_COLORS[key];
  const inferred = inferTypeFromTitle(title);
  if (inferred) return TYPE_COLORS[inferred];
  return TYPE_COLORS[key] || TYPE_COLORS.default;
}

// Real, creatable event types (matches AddEventModal.jsx's EVENT_TYPES, minus
// 'panchang' which has its own tab/UI) — used for the top-row color legend
// and the header's type filter dropdown.
export const EVENT_TYPE_LEGEND = [
  { key: 'pooja',      label: 'Pooja',      color: TYPE_COLORS.pooja.solid },
  { key: 'festival',   label: 'Festival',   color: TYPE_COLORS.festival.solid },
  { key: 'holiday',    label: 'Holiday',    color: TYPE_COLORS.holiday.solid },
  { key: 'kalyanam',   label: 'Kalyanam',   color: TYPE_COLORS.kalyanam.solid },
  { key: 'abhishekam', label: 'Abhishekam', color: TYPE_COLORS.abhishekam.solid },
];
// ── Panchang parts extractor ─────────────────────────────────────────────────
// Returns { tithi, nakshatra } separately so T/N badges can be shown
// Handles structured fields AND raw strings like "Prathama 8:10 PM - Chitta 7:19 AM Fri"
function getPanchangParts(p) {
  if (!p) return null;
  if (p.tithi || p.nakshatra) {
    return { tithi: p.tithi || null, nakshatra: p.nakshatra || null };
  }
  const raw = (p.title || '').trim();
  if (!raw) return null;
  const DAY_NAMES  = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i;
  const SKIP_WORDS = /^(AM|PM|also|afterwards|after|and|the|at|to|from)$/i;
  const extractName = seg => {
    const words = [];
    for (const tok of seg.trim().split(/\s+/)) {
      if (/\d/.test(tok) || DAY_NAMES.test(tok) || SKIP_WORDS.test(tok)) break;
      if (/^[A-Za-z]+$/.test(tok)) words.push(tok);
    }
    return words.join(' ').trim();
  };
  const dashParts       = raw.split(/\s*[-\u2013]\s*/);
  const firstCommaParts = dashParts[0].split(/\s*,\s*/);
  const tithi     = extractName(firstCommaParts[0]) || null;
  const nakshatra = dashParts.length > 1 ? (extractName(dashParts[1]) || null) : null;
  if (!tithi && !nakshatra) return null;
  return { tithi, nakshatra };
}

// ── Moon phase ────────────────────────────────────────────────────────────────
function getMoonPhase(events) {
  for (const e of events) {
    // Events are stored/returned with a snake_case moon_phase field (see
    // server/events.js and AdminDashboard.jsx's panchang import) — this
    // was checking the camelCase name, which the API never actually sends,
    // so an explicitly-set moon phase silently fell through to the
    // title/tithi keyword guess below instead of being used directly.
    const mp = e.moon_phase || e.moonPhase;
    if (mp === 'new') return 'new';
    if (mp === 'full') return 'full';
    const t = (e.tithi || e.title || '').toLowerCase();
    if (t.includes('amavasya')) return 'new';
    if (t.includes('purnima') || t.includes('purnama')) return 'full';
  }
  return null;
}
// ── Google Calendar URL ───────────────────────────────────────────────────────
function buildGCalUrl(event) {
  const base     = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const d        = (event.date || '').replace(/-/g, '');
  const title    = encodeURIComponent(`${event.title} — Sample Temple Name`);
  const location = encodeURIComponent('123 Main Street, Your City, ST 00000');
  const rsvpLine = event.id ? `\n\nRSVP: ${getRsvpUrl(event)}` : '';
  const details  = encodeURIComponent((event.description || '') + rsvpLine);
  if (event.time) {
    const [tp] = event.time.split(' ');
    let [h, m] = (tp || '10:00').split(':').map(Number);
    if (isNaN(h)) h = 10; if (isNaN(m)) m = 0;
    if (event.time.includes('PM') && h !== 12) h += 12;
    if (event.time.includes('AM') && h === 12) h = 0;
    const pad = n => String(n).padStart(2,'0');
    return `${base}&text=${title}&dates=${d}T${pad(h)}${pad(m)}00/${d}T${pad(Math.min(h+2,23))}${pad(m)}00&details=${details}&location=${location}`;
  }
  const nd = event.date ? new Date(new Date(event.date+'T12:00:00').getTime()+86400000).toISOString().slice(0,10).replace(/-/g,'') : d;
  return `${base}&text=${title}&dates=${d}/${nd}&details=${details}&location=${location}`;
}
// ── Calendar icon ─────────────────────────────────────────────────────────────
function CalIcon({ size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ display:'block', flexShrink:0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  );
}
// ── Action button ─────────────────────────────────────────────────────────────
function ActBtn({ bg, fg, onClick, children, title: tip }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick && onClick(e); }}
      title={tip}
      style={{
        padding: '2px 6px', borderRadius: 3, border: 'none',
        background: bg, color: fg,
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", display: 'flex',
        alignItems: 'center', gap: 3, flexShrink: 0,
        lineHeight: 1.4,
      }}
    >{children}</button>
  );
}

// ── Panchang row — gold-bordered block, T/N only, no buttons ────────────────
function PanchangRow({ panchang }) {
  const parts = getPanchangParts(panchang);
  if (!parts) return null;
  const { tithi, nakshatra } = parts;

  const lbl = {
    fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
    background: 'var(--cf-accent)', color: 'var(--cf-bg-base)',
    borderRadius: 2, padding: '1px 4px', flexShrink: 0,
  };
  return (
    <div style={{
      background: 'var(--cf-accent-glow)', border: '1px solid var(--cf-border-accent)',
      borderLeft: '2px solid var(--cf-accent)', borderRadius: '0 4px 4px 0',
      padding: '4px 6px', marginBottom: 4,
    }}>
        {tithi && (
        <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom: nakshatra ? 2 : 0 }}>
          <span style={lbl}>T</span>
          <span style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--cf-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={tithi}>{tithi}</span>
          </div>
        )}
        {nakshatra && (
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={lbl}>N</span>
          <span style={{ flex:1, fontSize:11, fontWeight:700, color:'var(--cf-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={nakshatra}>{nakshatra}</span>
          </div>
        )}
    </div>
  );
}
// getRsvpUrl is now imported from ../utils/rsvpUrl — same canonical slug
// algorithm used by RSVPPage.jsx to match incoming links, so a link built
// here always resolves instead of silently mismatching on punctuation.

// ── Event row — white card with a color-coded dot (title + time), sitting
// inside a radial "halo" wrapper: bright glow near the card in the event's
// own type color, fading out to nothing toward the corners.
function EventRow({ event }) {
  const c = getTypeColor(event.type, event.title);
  return (
    <div style={{
      marginBottom: 3,
      padding: 6,
      borderRadius: 10,
      background: `radial-gradient(circle at center, ${c.solid}40 0%, transparent 72%)`,
    }}>
      <div style={{
        background: '#fff',
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:c.solid, flexShrink:0 }} />
          <span style={{
              flex:1, minWidth: 0, maxWidth: 150, fontSize: 13, fontWeight: 800, color: '#000',
              fontFamily: "'DM Sans', sans-serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1.3,
          }} title={event.title}>{event.title}</span>
        </div>
          {event.time && (
          // Bumped a size step and darkened from a faint #4b4b4b — Playfair's
          // thin hairline strokes were reading blurry at the old 10.5px/light-gray.
          <div style={{ fontSize: 11, fontWeight: 600, color: '#3f3f46', marginTop: 1, marginLeft: 11, fontFamily: "'DM Sans', sans-serif" }}>🕐 {event.time}</div>
          )}
      </div>
    </div>
  );
}

// ── Floating action popup — Edit / Flyer / Delete, anchored under whichever
// event was clicked. Portaled to <body> so it always escapes the calendar
// cell's clipped, scrollable ancestors instead of being cut off.
function EventActionPopup({ event, rect, onEdit, onFlyer, onDelete, onClose }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    function onDocDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function onScroll() { onClose(); }
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (!rect) return null;
  const top  = rect.bottom + 8;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);

  const btn = (danger) => ({
    display:'flex', alignItems:'center', gap:6, padding:'9px 14px',
    background:'none', border:'none', cursor:'pointer',
    fontSize:12.5, fontWeight:700, fontFamily:"'DM Sans', sans-serif",
    color: danger ? '#dc2626' : '#1f1f1f', whiteSpace:'nowrap',
  });

  return createPortal(
    <div ref={ref} style={{
      position:'fixed', top, left, transform:'translateX(-50%)', zIndex:9999,
      background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:12,
      boxShadow:'0 12px 32px rgba(0,0,0,0.18)', display:'flex', alignItems:'stretch',
      overflow:'hidden',
    }}>
      <button style={btn(false)} onClick={onEdit}><Pencil size={13} /> Edit</button>
      <div style={{ width:1, background:'rgba(0,0,0,0.08)' }} />
      <button style={btn(false)} onClick={onFlyer}><FileText size={13} /> Flyer</button>
      <div style={{ width:1, background:'rgba(0,0,0,0.08)' }} />
      <button style={btn(true)} onClick={onDelete}><Trash2 size={13} /> Delete</button>
    </div>,
    document.body
  );
}

// ── Calendar cell — click an event to load it into the shared toolbar ────────
function CalendarCell({ day, today, otherMonth, panchang, regularEvents, isAdmin, viewMode = 'events', selectedId, onSelectEvent, onEventClick, dateStr, onAddEvent }) {
  const showEvents   = viewMode === 'events';
  const showPanchang = viewMode === 'panchang';
  const moon = getMoonPhase([...(panchang ? [panchang] : []), ...regularEvents]);
  const MAX       = 3;
  const visible = showEvents ? regularEvents.slice(0, MAX) : [];
  const extra   = showEvents ? regularEvents.length - MAX : 0;

  return (

    <div className={today ? 'cf-today-shine' : undefined} style={{
      background:   otherMonth ? 'transparent' : 'var(--cf-bg-card)',
      borderRadius: 8,
      border:       `1px solid ${today ? '#b17f26' : 'var(--cf-border)'}`,
      boxShadow:    otherMonth ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
        animation: today ? 'cfGlow 3s ease-in-out infinite' : 'none',
      padding:      6,
      minHeight:    today ? 110 : 100,
      position:     'relative',
      opacity:      otherMonth ? 0.25 : 1,
      // Only the day number below keeps Playfair (explicitly, on those two
      // spans) — everything else in a cell (event titles/times, "+N more",
      // the panchang placeholder dash) is small enough that Playfair's thin
      // hairline strokes read blurry, so the cell itself now defaults to
      // DM Sans, same as the rest of the app's body text.
      fontFamily:   "'DM Sans', sans-serif",
      display:      'flex',
      flexDirection:'column',
      overflow:     'hidden',
    }}>
      {/* Pearl gloss top shine */}
      {!otherMonth && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
          borderRadius: '8px 8px 0 0',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}
      {/* Was a gold "saffron" tint on every cell's bottom edge — removed
          along with App.jsx's halo glow now that pages are pure white;
          it was the main source of the cream wash across the whole grid. */}

            {today && (
              <>
                <div
                style={{
                    position: 'absolute',
                    inset: -2,
                    borderRadius: 12,
                    pointerEvents: 'none',
                    background: 'radial-gradient(circle at center, rgba(255,215,120,0.18) 0%, rgba(255,215,120,0.08) 45%, rgba(255,215,120,0.00) 72%)',
                    filter: 'blur(10px)',
                    opacity: 0.95,
                    zIndex: 0,
                }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 10,
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 1px rgba(255,215,120,0.55), 0 0 24px rgba(255,215,120,0.22), 0 0 44px rgba(255,215,120,0.12)',
                    zIndex: 0,
                  }}
                />
              </>
            )}
            {day && (
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Date + moon */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              {today ? (
                <span style={{
                  width:23, height:23, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:TODAY_GRADIENT, color:TODAY_INK, fontSize:13, fontWeight:800,
                  fontFamily:"'Playfair Display', Georgia, serif", boxShadow:'0 2px 8px rgba(0,0,0,0.25)',
                  border:'1px solid rgba(255,230,170,0.6)',
                }}>
              {day}
                </span>
              ) : (
                <span style={{ fontSize:17, fontWeight:800, color: P.textSec, fontFamily:"'Playfair Display', Georgia, serif" }}>
                  {day}
                </span>
              )}
              {today && (
                <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.04em', background:TODAY_GRADIENT, color:TODAY_INK, border:'1px solid rgba(255,230,170,0.6)', borderRadius:3, padding:'1px 5px' }}>TODAY</span>
              )}
            </div>
            {moon && (
              <span style={{
                width:12, height:12, borderRadius:'50%', display:'inline-block', flexShrink:0,
                background: moon==='full' ? '#f8e793' : '#979797',
                border:     moon==='full' ? '2px solid #ca8a04' : '2px solid #4b5563',
              }} title={moon==='full' ? 'Purnima' : 'Amavasya'} />

          )}
            {isAdmin && showEvents && onAddEvent && (
              <button
                onClick={() => onAddEvent(dateStr)}
                title="Add event on this date"
                style={{
                  width:22, height:22, borderRadius:6, border:'none',
                  background:'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)',
                  color:'#ffffff',
                  fontSize:15, fontWeight:900, lineHeight:1, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:0,
                  boxShadow:'0 3px 8px -2px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >+</button>
            )}
          </div>
          {/* Panchang — panchang tab only */}
          {showPanchang && panchang && <PanchangRow panchang={panchang} />}
          {showPanchang && !panchang && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:P.textMut, fontSize:11 }}>—</div>
          )}

          {/* Regular events — events tab only, click to load into shared toolbar */}
          {showEvents && (
          <div style={{ flex:1 }}>
            {visible.map((ev) => {
              const isSel = selectedId === ev.id;
              return (
              <div key={ev.id} onClick={(e) => { onSelectEvent && onSelectEvent(ev); onEventClick && onEventClick(ev, e.currentTarget.getBoundingClientRect()); }}
                style={{
                  cursor: 'pointer',
                  outline: isSel ? `2px solid ${getTypeColor(ev.type, ev.title).border}` : 'none',
                  borderRadius:3,
                  display: 'inline-block',
                  maxWidth: '100%',
                }}>
                <EventRow event={ev} />
              </div>
              );
          })}
          {extra > 0 && (
              <div style={{ padding:'2px 6px', borderRadius:3, fontSize:11, fontWeight:700, background:P.cardHov, borderLeft:`2px solid ${P.border}`, color:P.textMut, marginBottom:3 }}>
                +{extra} more
              </div>
            )}
          </div>
          )}
        </div>
                    )}
                  </div>
  );
}
// ── Shared action toolbar — one bar, populated by whichever event is clicked ─
function SelectedEventBar({ event, isAdmin, onEditEvent, onDeleteEvent, onCreateFlyer, onClear }) {
  if (!event) {
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        background:'var(--cf-bg-surface)', border:`1px dashed ${P.border}`,
        borderRadius: 8, padding:'10px 14px', marginBottom:10,
        color:P.textMut, fontFamily:"'DM Sans', sans-serif", fontSize:13,
      }}>
        👆 Click any event on the calendar to manage it here
      </div>
    );
  }
  const c = getTypeColor(event.type, event.title);
  return (
    <div style={{
      display:'flex', alignItems:'center', flexWrap:'wrap', gap:10,
      background:'var(--cf-bg-surface)', border:`1px solid ${c.border}`,
      borderLeft:`4px solid ${c.border}`,
      borderRadius: 8, padding:'10px 14px', marginBottom:10,
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <div style={{ flex:1, minWidth:160 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{event.title}</div>
        <div style={{ fontSize:11, color:P.textMut, marginTop:1 }}>
          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
          {event.time ? ` · ${event.time}` : ''}
        </div>
      </div>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {!isAdmin && (
              <ActBtn bg="#1a3a6a" fg="#93c5fd"
          onClick={() => window.open(buildGCalUrl(event), '_blank', 'noopener')}
                title="Add to Google Calendar">
                <CalIcon size={10}/> +GCal
              </ActBtn>
        )}
        {!isAdmin && event.id && event.type !== 'panchang' && (
                <ActBtn bg="#065f46" fg="#6ee7b7"
            onClick={() => window.open(getRsvpUrl(event), '_blank', 'noopener')}
                  title="RSVP for this event">
                  🙏 RSVP
                </ActBtn>
              )}
        {isAdmin && onEditEvent && (
          <ActBtn bg="#312e81" fg="#c7d2fe" onClick={() => onEditEvent(event)} title="Edit">✏ Edit</ActBtn>
              )}
        {isAdmin && onCreateFlyer && (
          <ActBtn bg="#4c1d95" fg="#ddd6fe" onClick={() => onCreateFlyer(event)} title="Create flyer">🪔 Flyer</ActBtn>
              )}
        {isAdmin && onDeleteEvent && (
          <ActBtn bg="#7f1d1d" fg="#fecaca" onClick={() => { onDeleteEvent(event.id); onClear && onClear(); }} title="Delete">🗑 Del</ActBtn>
              )}
        <button onClick={onClear} title="Clear selection" style={{
          padding:'2px 8px', borderRadius:3, border:'none', background:'transparent',
          color:P.textMut, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans', sans-serif",
        }}>✕</button>
        </div>
                  </div>
  );
}
// ── Tab switcher — Monthly Events / Monthly Panchang ──────────────────────────
// Panchang (Hindu lunar calendar data) only makes sense for temple orgs —
// other org types (church, community center, etc.) never have panchang data,
// so the tab is hidden for them rather than showing an always-empty view.
function ViewTabs({ viewMode, onChange, showPanchang = true }) {
  const tabs = [
    { key: 'events',   label: '📅 Monthly Events'   },
    ...(showPanchang ? [{ key: 'panchang', label: '🪔 Monthly Panchang' }] : []),
  ];
  return (
    <div style={{ display:'flex', gap:6, marginBottom:10 }}>
      {tabs.map(t => {
        const active = viewMode === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 7,
              border: active ? 'none' : '1px solid var(--cf-border)',
              background: active
                ? 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)'
                : 'var(--cf-bg-surface)',
              color: active ? '#ffffff' : P.textMut,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: active ? '0 3px 8px -3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
// ── Mobile Agenda View ────────────────────────────────────────────────────────
function AgendaView({ currentDate, events, isAdmin, viewMode = 'events', selectedId, onSelectEvent, onAddEvent, panchangEnabled = true }) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toDateString();
  const rows = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    const showEvents = viewMode === 'events';
    const showPanchangTab = viewMode === 'panchang';
    // Only pull 'panchang'-typed events into their own slot when this org
    // actually has the Panchang tab (panchangEnabled, i.e. orgCategory ===
    // 'temple' — see CalendarGrid's showPanchang). Non-temple orgs never
    // get offered that tab at all, so an admin who still picked "Panchang"
    // as an event type in the Add Event modal used to have it silently
    // filtered out of the Events tab here with nowhere else to see it —
    // saved, but permanently invisible. Treating it as a regular event for
    // those orgs keeps it visible instead.
    const panchangRaw = panchangEnabled ? (dayEvents.find(e => e.type === 'panchang') || null) : null;
    const regularRaw  = panchangEnabled ? dayEvents.filter(e => e.type !== 'panchang') : dayEvents;
    const panchang = showPanchangTab ? panchangRaw : null;
    const regular  = showEvents ? regularRaw : [];
    // Panchang tab: skip days with no panchang data (reference-only view).
    // Events tab: always render, so empty dates can still get a new event added.
    if (showPanchangTab && !panchangRaw) continue;
    const dt = new Date(dateStr + 'T12:00:00');
    const isToday = dt.toDateString() === todayStr;

    rows.push(
      <div key={d} style={{
        display: 'flex', gap: 10, padding: '12px 14px',
        background: isToday ? 'var(--cf-bg-deep)' : 'var(--cf-bg-card)',
        border:`1px solid ${isToday ? '#b17f26' : 'var(--cf-border)'}`,
        borderRadius: 8, marginBottom: 6, fontFamily: "'DM Sans', sans-serif",
                    }}>
        {/* Date badge */}
        <div style={{ textAlign: 'center', flexShrink: 0, width: 40 }}>
          {isToday ? (
            <div style={{
              width:28, height:28, borderRadius:'50%', margin:'0 auto',
              display:'flex', alignItems:'center', justifyContent:'center',
              background:TODAY_GRADIENT, color:TODAY_INK, fontSize:15, fontWeight:800,
              fontFamily: "'Playfair Display', Georgia, serif",
              border:'1px solid rgba(255,230,170,0.6)', boxShadow:'0 2px 8px rgba(0,0,0,0.2)',
            }}>{d}</div>
          ) : (
            <div style={{ fontSize:20, fontWeight:800, color: P.textSec, lineHeight:1, fontFamily: "'Playfair Display', Georgia, serif" }}>{d}</div>
          )}
          <div style={{ fontSize:10, color:P.textMut, textTransform:'uppercase', marginTop:1 }}>
            {dt.toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display:'flex', alignItems: regular.length===0 && showEvents ? 'center' : 'stretch' }}>
          {showPanchang && panchang && <PanchangRow panchang={panchang} />}
          {showEvents && regular.length > 0 && (
            <div style={{ flex:1 }}>
              {regular.map(ev => {
            const isSel = selectedId === ev.id;
            return (
              <div key={ev.id} onClick={() => onSelectEvent && onSelectEvent(ev)}
                style={{ cursor:'pointer', outline: isSel ? `2px solid ${getTypeColor(ev.type, ev.title).border}` : 'none', borderRadius:3 }}>
                <EventRow event={ev} />
              </div>
            );
          })}
            </div>
          )}
          {showEvents && regular.length === 0 && (
            isAdmin && onAddEvent ? (
              <button onClick={() => onAddEvent(dateStr)} style={{
                display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:5,
                border:'1px dashed var(--cf-border-accent)', background:'var(--cf-accent-glow)',
                color:'var(--cf-accent)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans', sans-serif",
              }}>+ Add event</button>
            ) : (
              <div style={{ color:P.textMut, fontSize:11 }}>No events</div>
            )
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {rows.length === 0
        ? <div style={{ textAlign:'center', color:P.textMut, padding:'40px 0', fontSize:14 }}>🛕 No events this month</div>
        : rows}
    </div>
  );
}
// ── Effect B: Cursor spotlight wrapper ───────────────────────────────────────
function SpotlightGrid({ children }) {
  const ref = React.useRef(null);
  const spotRef = React.useRef(null);
  const handleMouseMove = React.useCallback((e) => {
    if (!ref.current || !spotRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotRef.current.style.left = x + 'px';
    spotRef.current.style.top  = y + 'px';
    spotRef.current.style.opacity = '1';
  }, []);
  const handleMouseLeave = React.useCallback(() => {
    if (spotRef.current) spotRef.current.style.opacity = '0';
  }, []);
  return (
    <div ref={ref} style={{ position:'relative', overflow:'hidden' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Spotlight layer */}
      <div ref={spotRef} style={{
        position:      'absolute',
        width:         '340px',
        height:        '340px',
        borderRadius:  '50%',
        background:    'radial-gradient(circle, #c9943a18 0%, #c9943a08 40%, transparent 70%)',
        pointerEvents: 'none',
        transform:     'translate(-50%, -50%)',
        opacity:       0,
        transition:    'opacity 0.4s ease',
        zIndex:        0,
      }} />
      <div style={{ position:'relative', zIndex:1 }}>
        {children}
      </div>
    </div>
  );
}
// ── Main Component ────────────────────────────────────────────────────────────
function CalendarGrid({ currentDate, events, onEditEvent, onDeleteEvent, onCreateFlyer, onAddEvent, isAdmin, orgCategory, listView = false }) {
  const showPanchang = orgCategory === 'temple';
  const weekDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today    = new Date();
  const isToday = day =>
    !!day &&
    day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();

  const getDateStr = (day) => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };
  const getDays = () => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay  = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const days     = [];
    for (let i = firstDay - 1; i >= 0; i--)     days.push({ day: prevLast - i, current: false });
    for (let d = 1; d <= lastDay; d++)            days.push({ day: d,           current: true  });
    for (let d = 1; d <= 42 - days.length; d++)  days.push({ day: d,           current: false });
    return days;
  };
  const getEventsForDay = (day, current) => {
    if (!day || !current) return [];
    return events.filter(e => e.date === getDateStr(day));
  };

  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [viewMode, setViewMode] = React.useState('events'); // 'events' | 'panchang'
  const [selectedEvent, setSelectedEvent] = React.useState(null);
  const handleSelect = (ev) => setSelectedEvent(prev => (prev && prev.id === ev.id ? null : ev));
  const handleClear  = () => setSelectedEvent(null);
  // Desktop admin view: clicking an event opens a small floating Edit/Flyer/
  // Delete popup right under it (see EventActionPopup) instead of the shared
  // bar above the grid. Public/non-admin view keeps SelectedEventBar as-is.
  const [popup, setPopup] = React.useState(null); // { event, rect } | null
  const openEventPopup = (ev, rect) => setPopup({ event: ev, rect });
  const closePopup = () => setPopup(null);
  if (isMobile || listView) {
    return (
      <>
        <ViewTabs viewMode={viewMode} onChange={setViewMode} showPanchang={showPanchang} />
        {viewMode === 'events' && (
          <SelectedEventBar event={selectedEvent} isAdmin={isAdmin}
          onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} onCreateFlyer={onCreateFlyer}
            onClear={handleClear} />
        )}
        <AgendaView currentDate={currentDate} events={events} isAdmin={isAdmin}
          viewMode={viewMode} selectedId={selectedEvent?.id} onSelectEvent={handleSelect}
          onAddEvent={onAddEvent} panchangEnabled={showPanchang} />
      </>
    );
  }
  const days = getDays();
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <ViewTabs viewMode={viewMode} onChange={setViewMode} showPanchang={showPanchang} />
      {viewMode === 'events' && !isAdmin && (
        <SelectedEventBar event={selectedEvent} isAdmin={isAdmin}
          onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} onCreateFlyer={onCreateFlyer}
          onClear={handleClear} />
      )}
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6, background:'var(--cf-bg-deep)', borderRadius: 8, border: '1px solid var(--cf-border)' }}>
        {weekDays.map((d, i) => {
          const isCol = today.getDay()===i && currentDate.getMonth()===today.getMonth() && currentDate.getFullYear()===today.getFullYear();
          return (
            <div key={d} style={{
              textAlign:'center', fontSize:14, fontWeight:800,
              color: '#000000',
              borderBottom: isCol ? '2px solid #000000' : '2px solid transparent',
              letterSpacing:'0.08em', padding:'8px 0 6px', fontFamily:"'DM Sans', sans-serif",
            }}>{d.toUpperCase()}</div>
          );
        })}
      </div>

      {/* Grid — wrapped in Spotlight B */}
      <SpotlightGrid>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {days.map(({ day, current }, idx) => {
          const dayEvents = getEventsForDay(day, current);
          // See AgendaView's panchangEnabled comment: only split
          // 'panchang'-typed events into their own slot for orgs that
          // actually have a Panchang tab to show them in (showPanchang,
          // from orgCategory). Otherwise they're just regular events.
          const panchang  = showPanchang ? (dayEvents.find(e => e.type === 'panchang') || null) : null;
          const regular   = showPanchang ? dayEvents.filter(e => e.type !== 'panchang') : dayEvents;
          return (
            <CalendarCell
              key={idx}
              day={current ? day : null}
              today={current && isToday(day)}
              otherMonth={!current}
              panchang={panchang}
              regularEvents={regular}
                        isAdmin={isAdmin}
              viewMode={viewMode}
              selectedId={selectedEvent?.id}
              onSelectEvent={handleSelect}
              onEventClick={isAdmin ? openEventPopup : undefined}
              dateStr={current ? getDateStr(day) : null}
              onAddEvent={onAddEvent}
                      />
          );
        })}
      </div>
      </SpotlightGrid>
      {isAdmin && popup && (
        <EventActionPopup
          event={popup.event}
          rect={popup.rect}
          onEdit={() => { onEditEvent && onEditEvent(popup.event); closePopup(); }}
          onFlyer={() => { onCreateFlyer && onCreateFlyer(popup.event); closePopup(); }}
          onDelete={() => { onDeleteEvent && onDeleteEvent(popup.event.id); closePopup(); handleClear(); }}
          onClose={closePopup}
        />
      )}
      {/* Legend — event-type colors now live in the top row (next to the month
          nav); this bottom row keeps only the moon-phase key (and, on the
          panchang tab, what T/N mean) so it isn't duplicated in two places. */}
      <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap', padding:'8px 2px', alignItems:'center' }}>
        {viewMode === 'panchang' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#8B4513', flexShrink: 0 }} />
            <span style={{ fontSize:12, color:P.textMut, fontFamily:"'DM Sans', sans-serif" }}>Panchang (T=Tithi, N=Nakshatra)</span>
          </div>
        )}
        {showPanchang && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f8e793', border: '2px solid #ca8a04', flexShrink: 0 }} />
          <span style={{ fontSize:12, color:P.textMut, fontFamily:"'DM Sans', sans-serif" }}>Purnima</span>
                </div>
        )}
        {showPanchang && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#979797', border: '2px solid #4b5563', flexShrink: 0 }} />
          <span style={{ fontSize:12, color:P.textMut, fontFamily:"'DM Sans', sans-serif" }}>Amavasya</span>
        </div>
        )}
        {viewMode === 'events' && !isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width:14, height:14, borderRadius:3, background:'#1a3a6a', border:'1px solid #1a56db44', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <CalIcon size={9}/>
          </div>
          <span style={{ fontSize:12, color:P.textMut, fontFamily:"'DM Sans', sans-serif" }}>Add to Google Calendar</span>
        </div>
        )}
      </div>
    </div>
  );
}

export default CalendarGrid;
