/**
 * CalendarGrid.jsx
 * Warm charcoal theme — no EventCard dependency.
 * - Panchang: styled lavender pill (parses raw title string OR tithi/nakshatra fields)
 * - All events: +GCal always visible
 * - Admin events: Edit / Flyer / Del always visible below each event
 * - Mobile: agenda list view under 768px
 */

import React from 'react';

// ── Theme-aware palette (reads CSS variables set by themeManager) ─────────────
const P = {
  get root()    { return 'var(--cf-bg-base)' },
  get toolbar() { return 'var(--cf-header-bg)' },
  get sidebar() { return 'var(--cf-sidebar-bg)' },
  get card()    { return 'var(--cf-bg-card)' },
  get cardHov() { return 'var(--cf-bg-card)' },
  get border()  { return 'var(--cf-border)' },
  get today()   { return 'var(--cf-bg-card)' },
  get textPri() { return 'var(--cf-text-primary)' },
  get textMut() { return 'var(--cf-text-muted)' },
  get textSec() { return 'var(--cf-accent)' },
};
// ── Event type colors ─────────────────────────────────────────────────────────
const TYPE_COLORS = {
  abhishekam: { border: '#ea580c', bg: '#ea580c18', text: '#c2410c' },
  kalyanam:   { border: '#ca8a04', bg: '#ca8a0415', text: '#92400e' },
  festival:   { border: '#dc2626', bg: '#dc262615', text: '#991b1b' },
  holiday:    { border: '#dc2626', bg: '#dc262615', text: '#991b1b' },
  class:      { border: '#0d9488', bg: '#0d948815', text: '#0f766e' },
  pooja:      { border: '#ea580c', bg: '#ea580c18', text: '#c2410c' },
  default:    { border: '#c9943a', bg: '#c9943a15', text: '#92400e' },

  };

function getTypeColor(type = '') {
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.default;
}
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
    if (e.moonPhase === 'new') return 'new';
    if (e.moonPhase === 'full') return 'full';
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
  const rsvpLine = event.id ? `\n\nRSVP: ${window.location.origin}/rsvp/${event.date}-${(event.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}` : '';
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
        fontFamily: 'Georgia, serif', display: 'flex',
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
// ── RSVP URL builder ──────────────────────────────────────────────────────────
function getRsvpUrl(event) {
  const slug = (event.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${window.location.origin}/rsvp/${event.date}-${slug}`;
}

// ── Event row — title + time only (buttons are in cell action bar) ───────────
function EventRow({ event }) {
  const c = getTypeColor(event.type);
  return (
    <div style={{
      marginBottom: 3,
      borderLeft: `2px solid ${c.border}`,
      background: c.bg,
      borderRadius: '0 3px 3px 0',
      padding: '3px 6px 4px',
    }}>
      <div style={{
          fontSize: 11, fontWeight: 700, color: c.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    lineHeight: 1.3,
      }} title={event.title}>{event.title}</div>
        {event.time && (
        <div style={{ fontSize: 10, color: P.textMut, marginTop: 1 }}>🕐 {event.time}</div>
        )}
    </div>
  );
}

// ── Calendar cell — click an event to load it into the shared toolbar ────────
function CalendarCell({ day, today, otherMonth, panchang, regularEvents, isAdmin, viewMode = 'events', selectedId, onSelectEvent, dateStr, onAddEvent }) {
  const showEvents   = viewMode === 'events';
  const showPanchang = viewMode === 'panchang';
  const moon = getMoonPhase([...(panchang ? [panchang] : []), ...regularEvents]);
  const MAX       = 3;
  const visible = showEvents ? regularEvents.slice(0, MAX) : [];
  const extra   = showEvents ? regularEvents.length - MAX : 0;

  return (
      
    <div style={{
      background:   otherMonth ? 'transparent' : today
        ? 'var(--cf-bg-card)'
        : 'var(--cf-bg-surface)',
      borderRadius: 8,
      border:       `1px solid ${today ? 'var(--cf-accent)' : 'var(--cf-border)'}`,
        animation: today ? 'cfGlow 3s ease-in-out infinite' : 'none',
      padding:      6,
      minHeight:    today ? 110 : 100,
      position:     'relative',
      opacity:      otherMonth ? 0.25 : 1,
      fontFamily:   'Georgia, serif',
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
      {/* Saffron bottom tint */}
      {!otherMonth && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '25%',
          background: 'linear-gradient(0deg, rgba(201,148,58,0.06) 0%, transparent 100%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

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
              <span style={{ fontSize:15, fontWeight:700, color: today ? 'var(--cf-accent)' : P.textSec, fontFamily:'Georgia,serif' }}>
              {day}
                </span>
              {today && (
                <span style={{ fontSize:9, fontWeight:700, background:'var(--cf-accent-glow)', color:'var(--cf-accent)', border:'1px solid var(--cf-border-accent)', borderRadius:3, padding:'1px 5px' }}>TODAY</span>
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
                  width:16, height:16, borderRadius:4, border:'1px solid var(--cf-border-accent)',
                  background:'var(--cf-accent-glow)', color:'var(--cf-accent)',
                  fontSize:12, fontWeight:800, lineHeight:1, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:0,
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
              <div key={ev.id} onClick={() => onSelectEvent && onSelectEvent(ev)}
                style={{
                  cursor: 'pointer',
                  outline: isSel ? `2px solid ${getTypeColor(ev.type).border}` : 'none',
                  borderRadius:3,
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
        color:P.textMut, fontFamily:'Georgia, serif', fontSize:13,
      }}>
        👆 Click any event on the calendar to manage it here
      </div>
    );
  }
  const c = getTypeColor(event.type);
  return (
    <div style={{
      display:'flex', alignItems:'center', flexWrap:'wrap', gap:10,
      background:'var(--cf-bg-surface)', border:`1px solid ${c.border}`,
      borderLeft:`4px solid ${c.border}`,
      borderRadius: 8, padding:'10px 14px', marginBottom:10,
      fontFamily:'Georgia, serif',
    }}>
      <div style={{ flex:1, minWidth:160 }}>
        <div style={{ fontSize:14, fontWeight:700, color:c.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{event.title}</div>
        <div style={{ fontSize:11, color:P.textMut, marginTop:1 }}>
          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
          {event.time ? ` · ${event.time}` : ''}
        </div>
      </div>
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        <ActBtn bg="#1a3a6a" fg="#93c5fd"
          onClick={() => window.open(buildGCalUrl(event), '_blank', 'noopener')}
          title="Add to Google Calendar">
          <CalIcon size={10}/> +GCal
        </ActBtn>
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
          color:P.textMut, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'Georgia, serif',
        }}>✕</button>
      </div>
    </div>
  );
}
// ── Tab switcher — Monthly Events / Monthly Panchang ──────────────────────────
function ViewTabs({ viewMode, onChange }) {
  const tabs = [
    { key: 'events',   label: '📅 Monthly Events'   },
    { key: 'panchang', label: '🪔 Monthly Panchang' },
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
              padding: '7px 16px',
              borderRadius: 7,
              border: `1px solid ${active ? 'var(--cf-accent)' : 'var(--cf-border)'}`,
              background: active ? 'var(--cf-accent-glow)' : 'var(--cf-bg-surface)',
              color: active ? 'var(--cf-accent)' : P.textMut,
              fontFamily: 'Georgia, serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
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
function AgendaView({ currentDate, events, isAdmin, viewMode = 'events', selectedId, onSelectEvent, onAddEvent }) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toDateString();
  const rows = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    const showEvents = viewMode === 'events';
    const showPanchang = viewMode === 'panchang';
    const panchangRaw = dayEvents.find(e => e.type === 'panchang') || null;
    const regularRaw  = dayEvents.filter(e => e.type !== 'panchang');
    const panchang = showPanchang ? panchangRaw : null;
    const regular  = showEvents ? regularRaw : [];
    // Panchang tab: skip days with no panchang data (reference-only view).
    // Events tab: always render, so empty dates can still get a new event added.
    if (showPanchang && !panchangRaw) continue;
    const dt = new Date(dateStr + 'T12:00:00');
    const isToday = dt.toDateString() === todayStr;

    rows.push(
      <div key={d} style={{
        display: 'flex', gap: 10, padding: '12px 14px',
        background: isToday ? 'var(--cf-bg-deep)' : 'var(--cf-bg-card)',
        border:`1px solid ${isToday ? 'var(--cf-accent)' : 'var(--cf-border)'}`,
        borderRadius: 8, marginBottom: 6, fontFamily: 'Georgia, serif',
                    }}>
        {/* Date badge */}
        <div style={{ textAlign: 'center', flexShrink: 0, width: 40 }}>
          <div style={{ fontSize:20, fontWeight:800, color: isToday ? 'var(--cf-accent)' : P.textSec, lineHeight:1 }}>{d}</div>
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
                    style={{ cursor:'pointer', outline: isSel ? `2px solid ${getTypeColor(ev.type).border}` : 'none', borderRadius:3 }}>
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
                color:'var(--cf-accent)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Georgia, serif',
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
    <div style={{ fontFamily: 'Georgia, serif' }}>
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
function CalendarGrid({ currentDate, events, onEditEvent, onDeleteEvent, onCreateFlyer, onAddEvent, isAdmin }) {
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
  if (isMobile) {
    return (
      <>
        <ViewTabs viewMode={viewMode} onChange={setViewMode} />
        {viewMode === 'events' && (
          <SelectedEventBar event={selectedEvent} isAdmin={isAdmin}
            onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} onCreateFlyer={onCreateFlyer}
            onClear={handleClear} />
        )}
        <AgendaView currentDate={currentDate} events={events} isAdmin={isAdmin}
          viewMode={viewMode} selectedId={selectedEvent?.id} onSelectEvent={handleSelect}
          onAddEvent={onAddEvent} />
      </>
    );
  }
  const days = getDays();
  return (
    <div style={{ fontFamily: 'Georgia, serif' }}>
      <ViewTabs viewMode={viewMode} onChange={setViewMode} />
      {viewMode === 'events' && (
        <SelectedEventBar event={selectedEvent} isAdmin={isAdmin}
          onEditEvent={onEditEvent} onDeleteEvent={onDeleteEvent} onCreateFlyer={onCreateFlyer}
          onClear={handleClear} />
      )}
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
        {weekDays.map((d, i) => {
          const isCol = today.getDay()===i && currentDate.getMonth()===today.getMonth() && currentDate.getFullYear()===today.getFullYear();
          return (
            <div key={d} style={{
              textAlign:'center', fontSize:11, fontWeight:700,
              color: isCol ? 'var(--cf-accent)' : P.textMut,
              letterSpacing:'0.08em', padding:'4px 0', fontFamily:'Georgia,serif',
            }}>{d.toUpperCase()}</div>
          );
        })}
      </div>

      {/* Grid — wrapped in Spotlight B */}
      <SpotlightGrid>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {days.map(({ day, current }, idx) => {
          const dayEvents = getEventsForDay(day, current);
          const panchang  = dayEvents.find(e => e.type === 'panchang') || null;
          const regular   = dayEvents.filter(e => e.type !== 'panchang');
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
              dateStr={current ? getDateStr(day) : null}
              onAddEvent={onAddEvent}
                      />
          );
        })}
      </div>
      </SpotlightGrid>
      {/* Legend — swaps with the active tab */}
      <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap', padding:'8px 2px', alignItems:'center' }}>
        {(viewMode === 'events'
          ? [
              { label: 'Abhishekam', color: '#f97316' },
              { label: 'Kalyanam',   color: '#eab308' },
              { label: 'Festival',   color: '#dc2626' },
              { label: 'Class',      color: '#0d9488' },
            ]
          : [
              { label: 'Panchang (T=Tithi, N=Nakshatra)', color: '#8B4513' },
            ]
        ).map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize:12, color:P.textMut, fontFamily:'Georgia,serif' }}>{label}</span>
          </div>
                  ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f8e793', border: '2px solid #ca8a04', flexShrink: 0 }} />
          <span style={{ fontSize:12, color:P.textMut, fontFamily:'Georgia,serif' }}>Purnima</span>
                </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#979797', border: '2px solid #4b5563', flexShrink: 0 }} />
          <span style={{ fontSize:12, color:P.textMut, fontFamily:'Georgia,serif' }}>Amavasya</span>
        </div>
        {viewMode === 'events' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width:14, height:14, borderRadius:3, background:'#1a3a6a', border:'1px solid #1a56db44', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <CalIcon size={9}/>
            </div>
            <span style={{ fontSize:12, color:P.textMut, fontFamily:'Georgia,serif' }}>Add to Google Calendar</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarGrid;
