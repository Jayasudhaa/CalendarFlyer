/**
 * PublicCalendar.jsx
 * Standalone public-facing calendar page for [Your Organization Name]
 * - Fetches events from /api/events
 * - Fetches announcements from /api/announcements
 * - WhatsApp chatbot widget (opens WA with pre-filled message)
 * - No admin controls, no auth required
 *
 * Add to App.jsx:
 *   import PublicCalendar from './PublicCalendar';
 *   <Route path="/calendar" element={<PublicCalendar />} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useTempleConfig } from './hooks/useTempleConfig';
import { getRsvpUrl, getPhotoAlbumUrl } from './utils/rsvpUrl';
import PublicPageBackdrop from './components/PublicPageBackdrop';

// ── Constants ─────────────────────────────────────────────────────────────────
// These are now fallback defaults only — actual values come from the org's
// settings (useTempleConfig) once loaded, so each org shows their own info.
const TEMPLE_NAME    = 'Sample Temple Name';
const TEMPLE_ADDRESS = '123 Main Street, Your City, ST 00000';
const TEMPLE_PHONE   = '555-555-5555';
const TEMPLE_WA      = '17203313601'; // WhatsApp Business number — update to your org's number
const TEMPLE_WEBSITE = 'www.example.org';

const SUGGESTED_QS = [
  'What events are coming up this week?',
  'When is the next abhishekam?',
  'What are the temple timings?',
  'How do I RSVP for an event?',
  'Tell me about kalyanam',
  'What is the temple address?',
];

const TYPE_META = {
  abhishekam: { color: '#f97316', bg: '#f9731618', label: 'Abhishekam' },
  kalyanam:   { color: '#eab308', bg: '#eab30818', label: 'Kalyanam'   },
  festival:   { color: '#dc2626', bg: '#dc262618', label: 'Festival'   },
  holiday:    { color: '#dc2626', bg: '#dc262618', label: 'Holiday'    },
  class:      { color: '#0d9488', bg: '#0d948818', label: 'Class'      },
  pooja:      { color: '#f97316', bg: '#f9731618', label: 'Pooja'      },
  community:  { color: '#8b5cf6', bg: '#8b5cf618', label: 'Community'  },
  panchang:   { color: '#8B4513', bg: '#8B451318', label: 'Panchangam' },
  default:    { color: '#c9943a', bg: '#c9943a18', label: 'Event'      },
};

function typeOf(t = '') { return TYPE_META[(t || '').toLowerCase()] || TYPE_META.default; }

// Local-only "saved events" -- same cf_saved_events localStorage key
// PublicRadarPage.jsx's Explore feed already uses, so an event saved from
// either page shows up saved on the other (both pages key events by the
// same event_id, and share this browser's localStorage). No account or
// server sync either way -- this is the same fail-open, nothing-to-break
// pattern as Explore's heart toggle, not a new mechanism.
const SAVED_EVENTS_KEY = 'cf_saved_events';
function getSavedEventIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_EVENTS_KEY) || '[]')); } catch { return new Set(); }
}
function persistSavedEventIds(set) {
  try { localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify([...set])); } catch { /* private browsing etc */ }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS   = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildGCalUrl(ev, config = {}) {
  const base  = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const d     = (ev.date || '').replace(/-/g, '');
  const title = encodeURIComponent(`${ev.title} — ${config.temple_name || TEMPLE_NAME}`);
  const loc   = encodeURIComponent(config.address || TEMPLE_ADDRESS);
  const desc  = encodeURIComponent(ev.description || '');
  const nd    = ev.date
    ? new Date(new Date(ev.date + 'T12:00:00').getTime() + 86400000)
        .toISOString().slice(0, 10).replace(/-/g, '')
    : d;
  if (ev.time) {
    const [tp]  = ev.time.split(' ');
    let [h, m]  = (tp || '10:00').split(':').map(Number);
    if (isNaN(h)) h = 10; if (isNaN(m)) m = 0;
    if (ev.time.includes('PM') && h !== 12) h += 12;
    if (ev.time.includes('AM') && h === 12) h  = 0;
    const p = n => String(n).padStart(2, '0');
    return `${base}&text=${title}&dates=${d}T${p(h)}${p(m)}00/${d}T${p(Math.min(h+2,23))}${p(m)}00&details=${desc}&location=${loc}`;
  }
  return `${base}&text=${title}&dates=${d}/${nd}&details=${desc}&location=${loc}`;
}

// getRsvpUrl is now imported from ./utils/rsvpUrl — the same slug algorithm
// used everywhere an RSVP link is built or matched (RSVPPage, RSVPShare,
// CalendarGrid), so a link generated here always resolves on the RSVP page.

function parsePanchang(ev) {
  if (ev.tithi || ev.nakshatra) return { tithi: ev.tithi || null, nakshatra: ev.nakshatra || null };
  const raw = (ev.title || '').trim();
  if (!raw) return null;
  const DAY  = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i;
  const SKIP = /^(AM|PM|also|afterwards|after|and|the|at|to|from)$/i;
  const extract = seg => {
    const words = [];
    for (const tok of seg.trim().split(/\s+/)) {
      if (/\d/.test(tok) || DAY.test(tok) || SKIP.test(tok)) break;
      if (/^[A-Za-z]+$/.test(tok)) words.push(tok);
    }
    return words.join(' ').trim();
  };
  const dashes  = raw.split(/\s*[-–]\s*/);
  const commas  = dashes[0].split(/\s*,\s*/);
  const tithi   = extract(commas[0]) || null;
  const nakshatra = dashes.length > 1 ? (extract(dashes[1]) || null) : null;
  if (!tithi && !nakshatra) return null;
  return { tithi, nakshatra };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PanchangBadge({ ev }) {
  const parts = parsePanchang(ev);
  if (!parts) return null;
  const { tithi, nakshatra } = parts;
  return (
    <div style={{ background:'linear-gradient(135deg,#fef9ec,#fef6e4)', borderLeft:'2px solid #c9943a', borderRadius:'0 4px 4px 0', padding:'3px 6px', marginBottom:3 }}>
      {tithi && (
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#000', borderRadius:2, padding:'1px 4px' }}>T</span>
          <span style={{ fontSize:12, color:'#000', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tithi}</span>
        </div>
      )}
      {nakshatra && (
        <div style={{ display:'flex', gap:4, alignItems:'center', marginTop: tithi ? 2 : 0 }}>
          <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#000', borderRadius:2, padding:'1px 4px' }}>N</span>
          <span style={{ fontSize:12, color:'#000', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nakshatra}</span>
        </div>
      )}
    </div>
  );
}

// One compact glyph per pill -- priority order matches the Media spec's
// own event-card indicator list (live beats everything else, a photo
// count only shows once there's nothing more urgent to flag).
function mediaGlyph(media) {
  if (!media) return null;
  if (media.glimpses && media.glimpses.length > 0) return '🎬';
  if (media.photo_count > 0) return '📷';
  return null;
}

function EventPill({ ev, onClick, media }) {
  const m = typeOf(ev.type);
  const glyph = mediaGlyph(media);
  return (
    <div onClick={() => onClick(ev)}
      style={{ borderLeft:`2px solid ${m.color}`, background:m.bg, borderRadius:'0 4px 4px 0',
        padding:'3px 6px 4px', marginBottom:3, cursor:'pointer',
        transition:'filter 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
    >
      <div style={{ fontSize:13, fontWeight:700, color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {glyph && <span style={{ marginRight:4 }}>{glyph}</span>}{ev.title}
      </div>
      {ev.time && <div style={{ fontSize:12, color:'#000', marginTop:1 }}>🕐 {ev.time}</div>}
    </div>
  );
}

function CalendarCell({ day, isToday, isOther, events, viewMode = 'events', onSelect, mediaByEvent = {} }) {
  // Panchang and regular events are now exclusive to their own tab (same
  // split the admin dashboard's CalendarCell uses) instead of always
  // showing panchang alongside whatever category pills were active.
  const panchang = viewMode === 'panchang' ? (events.find(e => e.type === 'panchang') || null) : null;
  const regular  = viewMode === 'events' ? events.filter(e => e.type !== 'panchang') : [];
  const MAX = 2;
  const visible = regular.slice(0, MAX);
  const extra   = regular.length - MAX;

  return (
    <div className={isToday ? 'pub-today-shine' : undefined} style={{
      background:   isOther ? '#fdf5e8' : isToday ? 'linear-gradient(135deg,#fffbe6,#fff3d4)' : 'linear-gradient(135deg,#ffffff,#fffdf8)',
      border:       `1px solid ${isToday ? '#d4af37' : '#edd9a3'}`, boxShadow: isToday ? '0 0 0 2px rgba(212,175,55,0.2), 0 4px 12px rgba(180,120,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
      borderRadius: 8,
      padding:      6,
      minHeight:    90,
      minWidth:     0,
      overflow:     'hidden',
      opacity:      isOther ? 0.28 : 1,
      display:      'flex',
      flexDirection:'column',
      transition:   'border-color 0.15s',
    }}>
      {day && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{
              fontSize: 17, fontWeight: 700,
              color:    '#000',
              // Matches the admin dashboard's calendar grid: Playfair Display
              // reserved for the day number only, everything else (event
              // titles, panchang badges, legend) stays on the page's default
              // DM Sans — same rule, same reasoning, so both calendars read
              // consistently.
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>{day}</span>
            {isToday && <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#000', border:'none', boxShadow:'0 1px 3px rgba(180,120,0,0.3)', borderRadius:3, padding:'1px 5px' }}>TODAY</span>}
          </div>
          {panchang && <PanchangBadge ev={panchang} />}
          {viewMode === 'panchang' && !panchang && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#000', fontSize:12 }}>—</div>
          )}
          {visible.map(ev => <EventPill key={ev.event_id || ev.title} ev={ev} onClick={onSelect} media={mediaByEvent[ev.event_id]} />)}
          {extra > 0 && (
            <div onClick={() => onSelect(regular[MAX])}
              style={{ fontSize:13, color:'#000', fontWeight:700, cursor:'pointer', padding:'2px 6px',
                background:'#fde8c8', borderRadius:3, borderLeft:'2px solid #c9943a' }}>
              +{extra} more
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IndicatorBadge({ color, text }) {
  return (
    <span style={{ fontSize:'0.72rem', fontWeight:800, padding:'3px 9px', borderRadius:20, background:`${color}18`, color }}>
      {text}
    </span>
  );
}

function EventDetailModal({ ev, onClose, config = {}, media }) {
  // Hooks run unconditionally (before the `if (!ev)` bailout below) so this
  // stays a valid hook call even though ev is only ever null for a single
  // render right as the modal is closing.
  const [saved, setSaved] = useState(() => !!ev && getSavedEventIds().has(ev.event_id));
  if (!ev) return null;
  const m = typeOf(ev.type);
  const toggleSaved = () => {
    const key = ev.event_id;
    if (!key) return; // nothing stable to key on -- e.g. a panchang-only entry
    const ids = getSavedEventIds();
    if (ids.has(key)) ids.delete(key); else ids.add(key);
    persistSavedEventIds(ids);
    setSaved(ids.has(key));
  };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#fffdf7', border:'1px solid #e8d5a3', borderRadius:16,
        maxWidth:480, width:'100%', overflow:'hidden',
        boxShadow:'0 24px 60px rgba(0,0,0,0.6)',
        fontFamily:"'DM Sans', sans-serif",
      }}>
        <div style={{ background:`linear-gradient(135deg,${m.color}22,#1a0e04)`, borderBottom:'1px solid #3a2008', padding:'20px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:m.color, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>{m.label}</div>
              <h2 style={{ color:'#3d2008', fontWeight:800, fontSize:'1.15rem', margin:0, lineHeight:1.3 }}>{ev.title}</h2>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:12 }}>
              <button
                onClick={toggleSaved}
                aria-label={saved ? 'Unsave event' : 'Save event'}
                style={{ background:'rgba(0,0,0,0.06)', border:'none', width:32, height:32, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                <Heart size={15} color={saved ? '#dc2626' : '#92400e'} fill={saved ? '#dc2626' : 'none'} />
              </button>
              <button onClick={onClose} style={{ background:'rgba(0,0,0,0.06)', border:'none', color:'#92400e', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          </div>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, color:'#000', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Date</div>
              <div style={{ color:'#000', fontWeight:700 }}>
                {ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '—'}
              </div>
            </div>
            {ev.time && (
              <div>
                <div style={{ fontSize:11, color:'#000', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Time</div>
                <div style={{ color:'#000', fontWeight:700 }}>{ev.time}</div>
              </div>
            )}
          </div>
          {ev.description && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:'#000', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Details</div>
              <div style={{ color:'#000', fontSize:'0.92rem', lineHeight:1.7 }}>{ev.description}</div>
            </div>
          )}
          {media && ((media.glimpses && media.glimpses.length > 0) || media.photo_count > 0 || media.registration_required || media.members_only) && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {media.glimpses && media.glimpses.length > 0 && <IndicatorBadge color="#2563eb" text="🎬 Event glimpse" />}
              {media.photo_count > 0 && <IndicatorBadge color="#7c3aed" text={`📷 ${media.photo_count} photos`} />}
              {media.registration_required && <IndicatorBadge color="#d97706" text="🎟 Registration required" />}
              {media.members_only && <IndicatorBadge color="#6b7280" text="🔒 Members only" />}
            </div>
          )}

          {media && media.glimpses && media.glimpses.length > 0 && (
            <div style={{ marginBottom:16, padding:'12px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10 }}>
              <div style={{ fontSize:11, color:'#1e40af', fontWeight:800, textTransform:'uppercase', marginBottom:8 }}>Event glimpse</div>
              <video
                src={media.glimpses[0].video_url}
                controls
                playsInline
                style={{ width:'100%', maxHeight:320, borderRadius:8, background:'#000', display:'block' }}
              />
            </div>
          )}

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <a href={getRsvpUrl(ev)} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#065f46,#047857)', border:'none', borderRadius:8, color:'#6ee7b7', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:"'DM Sans', sans-serif" }}>
              🙏 RSVP
            </a>
            <a href={getPhotoAlbumUrl(ev)} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#7c2d12,#9a3412)', border:'none', borderRadius:8, color:'#fdba74', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:"'DM Sans', sans-serif" }}>
              📸 Photos
            </a>
            <a href={buildGCalUrl(ev, config)} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#1a3a6a,#1e4080)', border:'none', borderRadius:8, color:'#93c5fd', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:"'DM Sans', sans-serif" }}>
              📅 Add to Google Cal
            </a>
            {(config.phone || '').replace(/[^0-9]/g, '') && (
              <a href={`https://wa.me/${(config.phone || '').replace(/[^0-9]/g, '') || TEMPLE_WA}?text=${encodeURIComponent(`I want to know more about: ${ev.title} on ${ev.date}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#128c3e,#25d366)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:"'DM Sans', sans-serif" }}>
                💬 Ask on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const openWA = q => {
    const msg = q || 'Namaste! I have a question about the temple.';
    window.open(`https://wa.me/${TEMPLE_WA}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9000, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10, fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`@keyframes waSlide{from{opacity:0;transform:translateY(12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      {open && (
        <div style={{ width:320, maxWidth:'calc(100vw - 48px)', background:'#fffdf7', borderRadius:16,
          boxShadow:'0 20px 60px rgba(139,69,19,0.2)', border:'1.5px solid #e8d5a3', overflow:'hidden', animation:'waSlide 0.22s ease' }}>
          <div style={{ background:'linear-gradient(135deg,#8B4513,#c2410c)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'1.3rem' }}>🛕</span>
            <div style={{ flex:1 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:'0.92rem' }}>Temple Assistant</div>
              <div style={{ color:'rgba(255,255,255,0.72)', fontSize:'0.68rem', marginTop:1 }}>Replies via WhatsApp · +1 720 331 3601</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ padding:14 }}>
            <div style={{ background:'#fff8ee', border:'1px solid #f0e0c0', borderRadius:'10px 10px 10px 3px', padding:'10px 12px', color:'#3d2008', fontSize:'0.82rem', lineHeight:1.6, marginBottom:12 }}>
              🙏 <strong>Namaste!</strong> I'm the SV Temple assistant. Tap a question or open WhatsApp to ask anything!
            </div>
            <div style={{ fontSize:'0.65rem', color:'#92400e', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:7 }}>Quick Questions</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
              {SUGGESTED_QS.map((q, i) => (
                <button key={i} onClick={() => openWA(q)}
                  style={{ padding:'5px 10px', borderRadius:18, border:'1px solid #e8d5a3', background:'#fffaf0', color:'#8B4513', fontSize:'0.72rem', cursor:'pointer', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}
                  onMouseEnter={e => { e.target.style.background='#fef3e2'; e.target.style.borderColor='#c4a35a'; }}
                  onMouseLeave={e => { e.target.style.background='#fffaf0'; e.target.style.borderColor='#e8d5a3'; }}
                >{q}</button>
              ))}
            </div>
            <button onClick={() => openWA()}
              style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#25d366,#128c3e)', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:"'DM Sans', sans-serif", boxShadow:'0 3px 12px rgba(37,211,102,0.3)' }}>
              💬 Open WhatsApp Chat
            </button>
            <div style={{ color:'#b8966a', fontSize:'0.65rem', textAlign:'center', marginTop:8, lineHeight:1.4 }}>
              Opens WhatsApp with your question pre-filled · 24/7 bot replies 🙏
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(v => !v)}
        style={{ width:54, height:54, borderRadius:'50%', background:'linear-gradient(135deg,#8B4513,#c2410c)', border:'3px solid #fff', boxShadow:'0 4px 20px rgba(139,69,19,0.4)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', transition:'transform 0.18s' }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
        {open ? '×' : '🛕'}
      </button>
    </div>
  );
}

function NewsFeedPanel({ announcements, loading }) {
  return (
    <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, overflow:'hidden', height:'fit-content', boxShadow:'0 6px 24px rgba(180,120,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
      <div style={{ background:'linear-gradient(135deg,#c2410c15,#7c2d1215)', padding:'12px 14px', borderBottom:'1px solid #e8d5a3' }}>
        <div style={{ fontSize:'0.72rem', color:'#000', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>📢 Announcements</div>
      </div>
      <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading && (
          <div style={{ color:'#000', fontSize:'0.85rem', textAlign:'center', padding:'20px 0' }}>Loading...</div>
        )}
        {!loading && announcements.length === 0 && (
          <div style={{ color:'#000', fontSize:'0.85rem', textAlign:'center', padding:'20px 0' }}>No announcements</div>
        )}
        {announcements.map((a, i) => (
          <div key={i} style={{ background:'#fffaf4', border:'1px solid #e8d5a3', borderRadius:8, padding:'10px 12px' }}>
            {a.date && <div style={{ fontSize:'0.72rem', color:'#000', fontWeight:700, marginBottom:3 }}>
              {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}
            </div>}
            <div style={{ fontSize:'0.92rem', fontWeight:700, color:'#000', marginBottom:a.body ? 4 : 0 }}>{a.title || a.subject}</div>
            {a.body && <div style={{ fontSize:'0.88rem', color:'#000', lineHeight:1.5 }}>{a.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const HERO_ICON_BY_CATEGORY = { temple: '🕉️', nonprofit: '💛', community: '🏘️', other: '📅' };
// Small text label shown under the org name in the hero -- category only
// used to pick the icon above (no visible text), per user request to
// surface it.
const HERO_CATEGORY_LABEL = { temple: 'Temple', nonprofit: 'Nonprofit', community: 'Community Org', other: 'Organization' };

// Same convention as useEvents/useTempleConfig — respects a ?org= override
// for local testing, since Vite's dev proxy doesn't carry real subdomain
// info to the backend. Without this, the public page and the admin
// dashboard can resolve to two different orgs and "sync" would look broken.
function orgQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

// ── Follow (Connect) -- phone-verified, no public count, no feed of other
// people's activity. See connect-follow-design mockup: a follow button
// that unlocks one weekly digest + early access to sign-up sheets, nothing
// Instagram-shaped. Reuses the same community identity (and localStorage
// key) as SignupPage.jsx / PhotoSharePage.jsx -- one phone verification
// covers all three features.
const COMMUNITY_TOKEN_KEY = 'cf_community_token';

function getCommunityToken() {
  try { return localStorage.getItem(COMMUNITY_TOKEN_KEY); } catch { return null; }
}
function setCommunityToken(token) {
  try { localStorage.setItem(COMMUNITY_TOKEN_KEY, token); } catch { /* private browsing etc */ }
}
function clearCommunityToken() {
  try { localStorage.removeItem(COMMUNITY_TOKEN_KEY); } catch { /* noop */ }
}

async function communityFetch(path, { token, ...opts } = {}) {
  const res = await fetch(path + orgQueryParam(), {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong -- please try again.');
  return data;
}

function FollowButton() {
  const [token, setToken] = useState(getCommunityToken());
  const [following, setFollowing] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    communityFetch('/api/community/me', { token })
      .then((d) => setFollowing(!!d.following))
      .catch((err) => {
        if (/expired|verify/i.test(err.message)) { clearCommunityToken(); setToken(null); }
      });
  }, [token]);

  const doFollow = async (t) => {
    setBusy(true);
    try {
      const data = await communityFetch('/api/community/follow', { token: t, method: 'POST' });
      setFollowing(!!data.following);
    } catch (err) {
      // ignore -- verify modal already closed, nothing actionable to show here
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!token) { setShowVerify(true); return; }
    setBusy(true);
    try {
      const path = following ? '/api/community/unfollow' : '/api/community/follow';
      const data = await communityFetch(path, { token, method: 'POST' });
      setFollowing(!!data.following);
    } catch (err) {
      if (/expired|verify/i.test(err.message)) { clearCommunityToken(); setToken(null); setShowVerify(true); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          padding: '10px 22px', borderRadius: 30,
          border: following ? '2px solid #78350f' : '2px solid #b45309',
          background: following ? 'linear-gradient(135deg,#b45309,#78350f)' : 'transparent',
          color: following ? '#fff' : '#92400e',
          fontWeight: 800, fontSize: '0.88rem', cursor: busy ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {following ? '✓ Following' : '🔔 Follow'}
      </button>
      {following && (
        <div style={{ width:'100%', marginTop: 8, fontSize: '0.76rem', color: '#92400e', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', textAlign:'center', lineHeight: 1.5 }}>
          You'll get one weekly update -- plus early access to sign-ups before they open to everyone.
        </div>
      )}
      {showVerify && (
        <FollowVerifyModal
          onVerified={(t) => { setCommunityToken(t); setToken(t); setShowVerify(false); doFollow(t); }}
          onClose={() => setShowVerify(false)}
        />
      )}
    </>
  );
}

function FollowVerifyModal({ onVerified, onClose }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#fffdf7', border: '1px solid #e8d5b7', borderRadius: 10,
    color: '#3d2008', fontSize: '0.95rem', outline: 'none',
  };
  const button = (disabled) => ({
    width: '100%', padding: '14px',
    background: disabled ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
    border: 'none', color: 'white', borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '1rem',
  });

  const requestCode = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError(''); setBusy(true);
    try {
      await communityFetch('/api/community/request-code', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
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
      const data = await communityFetch('/api/community/verify-code', { method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      onVerified(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fffdf7', borderRadius: 16, border: '1px solid #e8d5b7', padding: 28, maxWidth: 380, width: '100%', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ color: '#92400e', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20 }}>
          To follow, verify your email address -- this keeps updates going to people who are actually part of this community.
        </div>
        {step === 'email' ? (
          <>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginBottom: 16 }} />
            {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
            <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? 'Sending...' : 'Email me a code'}</button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.8rem', cursor: 'pointer', padding: 6 }}>Cancel</button>
          </>
        ) : (
          <>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>6-digit code sent to {email}</label>
            <input type="text" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, marginBottom: 12, letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.2rem' }} />
            {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
            <button onClick={verifyCode} disabled={busy} style={button(busy)}>{busy ? 'Verifying...' : 'Verify & follow'}</button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.8rem', cursor: 'pointer', padding: 6 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Merged-page section styles (Events / Announcements / Glimpses / Photos) ──
const sectionHeading = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.25rem', fontWeight: 800, color: '#3d2008', margin: 0 };
const sectionCount = { fontSize: '0.82rem', color: '#92400e' };
const sectionEmpty = {
  background: 'linear-gradient(135deg,#fffdf7,#fff8ee)', border: '1px solid #d4af37', borderRadius: 14,
  padding: '28px 16px', textAlign: 'center', color: '#92400e', fontSize: '0.92rem',
  boxShadow: '0 4px 20px rgba(180,120,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
};
const eventRow = {
  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px',
  background: 'linear-gradient(135deg,#fffdf7,#fff8ee)', border: '1px solid #e8d5a3', borderRadius: 12,
  boxShadow: '0 2px 10px rgba(180,120,0,0.06)',
};
const adminLoginLinkStyle = {
  padding: '10px 20px', borderRadius: 30, border: '2px solid #e8d5a3',
  background: 'transparent', color: '#92400e', fontWeight: 800, fontSize: '0.88rem',
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
  fontFamily: "'DM Sans', sans-serif",
};
const rsvpBtn = {
  padding: '7px 12px', background: 'linear-gradient(135deg,#065f46,#047857)', border: 'none', borderRadius: 7,
  color: '#6ee7b7', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center', textDecoration: 'none',
  fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
};
const gcalBtn = {
  padding: '7px 12px', background: 'linear-gradient(135deg,#1a3a6a,#1e4080)', border: 'none', borderRadius: 7,
  color: '#93c5fd', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center', textDecoration: 'none',
  fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
};
const mediaCard = {
  background: '#fff', border: '1px solid #e8d5a3', borderRadius: 14, padding: 10,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};
const albumCard = {
  display: 'block', textDecoration: 'none', background: '#fff', border: '1px solid #e8d5a3', borderRadius: 14,
  overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};
const albumCover = {
  aspectRatio: '4/3', background: '#fff8ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
};

function PublicCalendar() {
  const location = useLocation();
  const { config: templeConfig } = useTempleConfig();
  const heroIcon = HERO_ICON_BY_CATEGORY[templeConfig.category] || HERO_ICON_BY_CATEGORY.other;
  const [events,        setEvents]        = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [glimpses,       setGlimpses]       = useState([]);
  const [albums,         setAlbums]         = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingNews,   setLoadingNews]   = useState(true);
  const [loadingGlimpses, setLoadingGlimpses] = useState(true);
  const [loadingAlbums,  setLoadingAlbums]    = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Fetch events — same org resolution as the admin dashboard (useEvents),
  // so this page always reflects whatever was just added/edited there.
  useEffect(() => {
    fetch('/api/events' + orgQueryParam())
      .then(r => {
        if (!r.ok) throw new Error('not ok');
        return r.json();
      })
      .then(data => setEvents(Array.isArray(data) ? data : data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  // Fetch announcements
  useEffect(() => {
    fetch('/api/announcements' + orgQueryParam())
      .then(r => r.json())
      .then(data => { setAnnouncements(Array.isArray(data) ? data : data.announcements || []); })
      .catch(() => setAnnouncements([]))
      .finally(() => setLoadingNews(false));
  }, []);

  // Fetch glimpses — this section used to be its own route (/live,
  // PublicLive.jsx). Same endpoint, same communityFetch helper this file
  // already uses for Follow, just rendered as a section here (see
  // PublicNav.jsx's header comment on the merge).
  useEffect(() => {
    let cancelled = false;
    communityFetch('/api/public-media/glimpses-recent', { token: getCommunityToken() })
      .then((d) => { if (!cancelled) setGlimpses(d.recent || []); })
      .catch(() => { if (!cancelled) setGlimpses([]); })
      .finally(() => { if (!cancelled) setLoadingGlimpses(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch photo albums — this section used to be its own route (/photos,
  // PublicPhotosPage.jsx). Same endpoint, same reasoning as glimpses above.
  useEffect(() => {
    let cancelled = false;
    communityFetch('/api/public-media/albums', { token: getCommunityToken() })
      .then((d) => { if (!cancelled) setAlbums(d.albums || []); })
      .catch(() => { if (!cancelled) setAlbums([]); })
      .finally(() => { if (!cancelled) setLoadingAlbums(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch each event's Live/Photos state (🎬 glimpse / 📷 N photos badges,
  // plus the detail modal's glimpse video and indicator badges) -- one
  // batch call for the whole loaded event list rather than one request per
  // event card.
  const [mediaByEvent, setMediaByEvent] = useState({});
  useEffect(() => {
    const eventIds = events.filter(e => e.type !== 'panchang' && e.event_id).map(e => e.event_id);
    if (!eventIds.length) { setMediaByEvent({}); return undefined; }
    let cancelled = false;
    fetch('/api/public-media/events/batch' + orgQueryParam(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    })
      .then(r => (r.ok ? r.json() : { results: {} }))
      .then(data => { if (!cancelled) setMediaByEvent(data.results || {}); })
      .catch(() => { if (!cancelled) setMediaByEvent({}); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.map(e => e.event_id).join(',')]);

  // Jump to whichever section the URL names in its hash (a PublicNav tab,
  // or an old /announcements, /live or /photos link that App.jsx's
  // RedirectToSection forwarded here with one). Depends on location.hash
  // so it re-fires on every nav click, not just on first mount, and on
  // loadingEvents so it still finds the section once real content (not
  // just the loading placeholder) has replaced it.
  useEffect(() => {
    const id = (location.hash || '').replace('#', '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, loadingEvents]);

  const todayIso = new Date().toISOString().slice(0, 10);
  // Two-week window, not "every event forever" -- a flat list has no month
  // boundary to naturally stop at, so without a cap it would just keep
  // growing as admins add events further out. 14 days matches what
  // someone glancing at "what's coming up" actually wants to see. The
  // "Full calendar" link (below) lifts this cap on demand rather than
  // linking out to a separate page -- there's only the one merged page now.
  const twoWeeksIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Real, RSVP-able events only, soonest first. Panchang rows (daily
  // lunar-calendar reference entries some temple orgs keep, type:
  // 'panchang') are deliberately left out here -- there's often one per
  // day, which would bury actual events under a month of Tithi/Nakshatra
  // trivia in a flat list. A panchang row still shows inside a real
  // event's own PanchangBadge when that event carries tithi/nakshatra data.
  const upcomingEvents = events
    .filter(e => e.type !== 'panchang' && e.date && e.date >= todayIso && (showAllEvents || e.date <= twoWeeksIso))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
    <PublicPageBackdrop />
    <div style={{ minHeight:'100vh', position:'relative', fontFamily:"'DM Sans', sans-serif", color:'#000' }}>

      {/* ── Hero: banner image with logo/name overlaid directly on it when a
           banner is set (no separate gold bar); falls back to the plain
           gold gradient hero when there's no banner. ── */}
      {templeConfig.banner_url ? (
        <div style={{ position:'relative', width:'100%', overflow:'hidden' }}>
          <img
            src={templeConfig.banner_url}
            alt={`${templeConfig.temple_name || TEMPLE_NAME} banner`}
            style={{ width:'100%', height:280, objectFit:'cover', display:'block' }}
          />
          {/* Scrim so white text/logo stay legible over any photo */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)' }} />
          <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'20px 20px 22px', textAlign:'center' }}>
            {templeConfig.logo_url ? (
              <img
                src={templeConfig.logo_url}
                alt={templeConfig.temple_name || TEMPLE_NAME}
                style={{ width:68, height:68, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.9)', margin:'0 auto 14px', display:'block', boxShadow:'0 0 0 4px rgba(255,215,0,0.3), 0 0 0 8px rgba(255,215,0,0.1), 0 0 40px rgba(255,180,0,0.4), 0 10px 30px rgba(0,0,0,0.3)' }}
              />
            ) : (
            <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#ffd700,#e6a600,#ffb700)', border:'2px solid rgba(255,255,255,0.9)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 0 4px rgba(255,215,0,0.3), 0 0 0 8px rgba(255,215,0,0.1), 0 0 40px rgba(255,180,0,0.4), 0 10px 30px rgba(0,0,0,0.3)', fontSize:'1.8rem' }}>{heroIcon}</div>
            )}
            <h1 style={{ fontSize:'clamp(1.5rem,4vw,2.6rem)', fontWeight:700, color:'#fff', margin:'0 0 8px', letterSpacing:'0.03em', textShadow:'0 2px 10px rgba(0,0,0,0.5)' }}>
              {(templeConfig.temple_name || TEMPLE_NAME).toUpperCase()}
            </h1>
            <div style={{ fontSize:11, letterSpacing:1.2, fontWeight:700, color:'rgba(255,255,255,0.85)', textTransform:'uppercase', marginBottom:8, textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>
              {HERO_CATEGORY_LABEL[templeConfig.category] || HERO_CATEGORY_LABEL.other}
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:'1.2rem', flexWrap:'wrap', fontSize:'clamp(0.75rem,1.6vw,0.92rem)', color:'rgba(255,255,255,0.92)', textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>
              {templeConfig.address && <span>📍 {templeConfig.address}</span>}
              {templeConfig.phone && <span>📞 {templeConfig.phone}</span>}
            </div>
          </div>
        </div>
      ) : (
      <div style={{
        background: `linear-gradient(135deg, ${templeConfig.primary_color || '#b83a0a'} 0%, ${templeConfig.primary_color || '#8a2c08'} 35%, ${templeConfig.primary_color || '#6b210a'} 65%, ${templeConfig.primary_color || '#a34508'} 100%)`,
        borderBottom:'1px solid rgba(139,69,19,0.3)',
        padding:'28px 20px 22px',
        textAlign:'center',
        position:'relative',
        overflow:'hidden',
      }}>
        {/* Glow accents */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.22) 0%, transparent 55%), radial-gradient(ellipse at 20% 100%, rgba(255,150,0,0.12), transparent 40%), radial-gradient(ellipse at 80% 100%, rgba(255,100,0,0.08), transparent 40%)' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          {templeConfig.logo_url ? (
            <img
              src={templeConfig.logo_url}
              alt={templeConfig.temple_name || TEMPLE_NAME}
              style={{ width:68, height:68, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(255,255,255,0.9)', margin:'0 auto 14px', display:'block', boxShadow:'0 0 0 4px rgba(255,215,0,0.3), 0 0 0 8px rgba(255,215,0,0.1), 0 0 40px rgba(255,180,0,0.4), 0 10px 30px rgba(0,0,0,0.3)' }}
            />
          ) : (
          <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#ffd700,#e6a600,#ffb700)', border:'2px solid rgba(255,255,255,0.9)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 0 4px rgba(255,215,0,0.3), 0 0 0 8px rgba(255,215,0,0.1), 0 0 40px rgba(255,180,0,0.4), 0 10px 30px rgba(0,0,0,0.3)', fontSize:'1.8rem' }}>{heroIcon}</div>
          )}
          <h1 style={{ fontSize:'clamp(1.5rem,4vw,2.6rem)', fontWeight:700, color:'#fff', margin:'0 0 8px', letterSpacing:'0.03em' }}>
            {(templeConfig.temple_name || TEMPLE_NAME).toUpperCase()}
          </h1>
          <div style={{ fontSize:11, letterSpacing:1.2, fontWeight:700, color:'rgba(255,255,255,0.8)', textTransform:'uppercase', marginBottom:8 }}>
            {HERO_CATEGORY_LABEL[templeConfig.category] || HERO_CATEGORY_LABEL.other}
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:'1.2rem', flexWrap:'wrap', fontSize:'clamp(0.75rem,1.6vw,0.92rem)', color:'rgba(255,255,255,0.88)' }}>
            {templeConfig.address && <span>📍 {templeConfig.address}</span>}
            {templeConfig.phone && <span>📞 {templeConfig.phone}</span>}
          </div>
        </div>
      </div>
      )}

      {/* ── Follow + Admin login: a separate solid card below the hero,
           deliberately NOT overlaid on the banner image/gradient -- those
           backgrounds (a photo, or busy glow accents) were swallowing
           these two actions. A plain light card guarantees contrast no
           matter what the org's banner looks like. ── */}
      <div style={{ background:'#fffdf7', borderBottom:'1px solid #e8d5a3', padding:'14px 20px', display:'flex', justifyContent:'center', alignItems:'center', gap:10, flexWrap:'wrap', boxShadow:'0 2px 10px rgba(180,120,0,0.06)' }}>
        <FollowButton />
        <a href="/login" style={adminLoginLinkStyle}>Admin login</a>
      </div>

      {/* ── Main layout: events in the main column, Announcements/Glimpses/
           Photos in a sidebar (see .pub-cal-layout below — it drops to a
           single stacked column under 900px). Each section keeps its id so
           PublicNav's tab and the old /announcements, /live, /photos
           redirects can still scroll straight to it. ── */}
      <div className='pub-cal-main' style={{ maxWidth:1400, width:'100%', margin:'0 auto', padding:'24px 24px 60px' }}>
      <div className='pub-cal-layout'>

      <div className='pub-cal-events-col'>
        {/* ── Events ── */}
        <section id="events">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap' }}>
            <div>
              <h2 style={sectionHeading}>📅 {templeConfig.temple_name || TEMPLE_NAME} Events</h2>
              <div style={{ fontSize:'0.78rem', color:'#92400e', marginTop:2 }}>Official {(HERO_CATEGORY_LABEL[templeConfig.category] || HERO_CATEGORY_LABEL.other).toLowerCase()} calendar</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={sectionCount}>{upcomingEvents.length}{showAllEvents ? ' upcoming' : ' in the next 2 weeks'}</div>
              <button
                onClick={() => setShowAllEvents(v => !v)}
                style={{ background:'none', border:'none', padding:0, marginTop:4, color:'#c2410c', fontWeight:700, fontSize:'0.8rem', cursor:'pointer', fontFamily:"'DM Sans', sans-serif", textDecoration:'underline' }}
              >
                {showAllEvents ? 'Next 2 weeks' : 'Full calendar'}
              </button>
            </div>
          </div>
          {loadingEvents ? (
            <div style={sectionEmpty}>🕉️ Loading events...</div>
          ) : upcomingEvents.length === 0 ? (
            <div style={sectionEmpty}>No upcoming events right now — check back soon.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcomingEvents.map((ev) => {
                const m = typeOf(ev.type);
                const d = new Date(ev.date + 'T12:00:00');
                // Media (image/glimpse/photos) already fetched per-event for the
                // detail modal's badges -- reused here so the list itself shows
                // what's available without opening each event.
                const media = mediaByEvent[ev.event_id];
                const thumbSrc = ev.image_url || (media && media.glimpses && media.glimpses[0] && media.glimpses[0].thumbnail_url);
                const hasGlimpse = media && media.glimpses && media.glimpses.length > 0;
                const photoCount = media && media.photo_count;
                return (
                  <div key={ev.event_id || ev.title} onClick={() => setSelectedEvent(ev)} style={eventRow}>
                    <div style={{ width:44, flexShrink:0, textAlign:'center' }}>
                      <div style={{ fontSize:19, fontWeight:800, color:'#000', lineHeight:1 }}>{d.getDate()}</div>
                      <div style={{ fontSize:11, color:'#000', textTransform:'uppercase' }}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
                    </div>
                    {(thumbSrc || hasGlimpse || photoCount > 0) && (
                      <div style={{ width:44, height:44, borderRadius:8, flexShrink:0, overflow:'hidden', position:'relative', background:'#e8d5a3' }}>
                        {thumbSrc ? (
                          <img src={thumbSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                        ) : (
                          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                            {hasGlimpse ? '🎬' : '📷'}
                          </div>
                        )}
                        {hasGlimpse && (
                          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.25)', fontSize:14 }}>▶</div>
                        )}
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:800, color:'#000', fontSize:'0.98rem' }}>{ev.title}</span>
                        <span style={{ fontSize:10, fontWeight:800, color:m.color, background:m.bg, padding:'2px 8px', borderRadius:20, textTransform:'uppercase', letterSpacing:'0.04em' }}>{m.label}</span>
                      </div>
                      {ev.time && <div style={{ fontSize:'0.82rem', color:'#000', marginTop:2 }}>{ev.time}</div>}
                      {(hasGlimpse || photoCount > 0) && (
                        <div style={{ display:'flex', gap:6, marginTop:4 }}>
                          {hasGlimpse && <span style={{ fontSize:10, fontWeight:700, color:'#2563eb' }}>🎬 Glimpse</span>}
                          {photoCount > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#7c3aed' }}>📷 {photoCount} photos</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={(e) => e.stopPropagation()}>
                      <a href={getRsvpUrl(ev)} target="_blank" rel="noopener noreferrer" style={rsvpBtn}>🙏 RSVP</a>
                      <a href={buildGCalUrl(ev, templeConfig)} target="_blank" rel="noopener noreferrer" style={gcalBtn}>📅 Add to Cal</a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className='pub-cal-sidebar'>
        {/* ── Announcements ── */}
        <section id="announcements">
          <h2 style={{ ...sectionHeading, marginBottom: 12, fontSize:'1.05rem' }}>📢 Announcements</h2>
          <NewsFeedPanel announcements={announcements} loading={loadingNews} />
        </section>

        {/* ── Glimpses ── */}
        <section id="glimpses">
          <h2 style={{ ...sectionHeading, marginBottom: 12, fontSize:'1.05rem' }}>🎬 Glimpses</h2>
          {loadingGlimpses ? (
            <div style={sectionEmpty}>Loading…</div>
          ) : glimpses.length === 0 ? (
            <div style={sectionEmpty}>No glimpse videos yet.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {glimpses.map((s) => (
                <div key={s.stream_id} style={mediaCard}>
                  <video
                    src={s.video_url}
                    controls
                    playsInline
                    style={{ width:'100%', aspectRatio:'9/16', maxHeight:220, objectFit:'cover', background:'#000', borderRadius:10, display:'block' }}
                  />
                  <div style={{ padding:'8px 2px 0' }}>
                    <div style={{ fontWeight:800, color:'#3d2008', fontSize:'0.82rem' }}>{s.event_title || s.title || 'Event glimpse'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Photos ── */}
        <section id="photos">
          <h2 style={{ ...sectionHeading, marginBottom: 12, fontSize:'1.05rem' }}>📷 Photos</h2>
          {loadingAlbums ? (
            <div style={sectionEmpty}>Loading albums…</div>
          ) : albums.length === 0 ? (
            <div style={sectionEmpty}>No photo albums published yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
              {albums.map((a) => (
                <a
                  key={a.album_id}
                  href={a.has_event ? getPhotoAlbumUrl({ title: a.event_title, date: a.event_date }) : `/photos/album/${a.album_id}${orgQueryParam()}`}
                  style={albumCard}
                >
                  <div style={albumCover}>
                    {a.cover_photo_url ? (
                      <img src={a.cover_photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    ) : '📷'}
                  </div>
                  <div style={{ padding:'8px 10px' }}>
                    <div style={{ fontWeight:800, color:'#3d2008', fontSize:'0.78rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.name || a.event_title}
                    </div>
                    <div style={{ color:'#92400e', fontSize:'0.68rem', marginTop:2 }}>{a.photo_count || 0} photos</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </aside>

      </div>
      </div>

      {/* ── Global styles ── */}
      <style>{`
        .pub-cal-layout { display:grid; grid-template-columns: minmax(0,1fr) 360px; gap:32px; align-items:start; }
        .pub-cal-events-col { display:flex; flex-direction:column; gap:32px; min-width:0; }
        .pub-cal-sidebar { display:flex; flex-direction:column; gap:28px; min-width:0; }
        @media (max-width: 900px) {
          .pub-cal-layout { grid-template-columns: 1fr; }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .pub-cal-main { animation: fadeInUp 0.5s ease; }
        .temple-header h1 { font-family: 'Playfair Display', Georgia, serif !important; letter-spacing:0.06em; }
      `}</style>
      {/* ── Footer ── */}
      <div style={{ borderTop:'1px solid #e8d5a3', padding:'18px 20px', textAlign:'center', color:'#000', fontSize:'0.88rem', marginTop:8 }}>
        {heroIcon} {templeConfig.temple_name || TEMPLE_NAME}
        {(templeConfig.phone || TEMPLE_PHONE) && (
          <> · <a href={`tel:${templeConfig.phone || TEMPLE_PHONE}`} style={{ color:'#000', textDecoration:'none' }}>{templeConfig.phone || TEMPLE_PHONE}</a></>
        )}
      </div>

      {/* ── Event detail modal ── */}
      {selectedEvent && <EventDetailModal ev={selectedEvent} onClose={() => setSelectedEvent(null)} config={templeConfig} media={mediaByEvent[selectedEvent.event_id]} />}

      {/* Temple Assistant (WebChatWidget) now renders once from App.jsx's
          PublicOrgLayout, shared across every visitor-facing org page
          (calendar, RSVP, photos, sign-ups) instead of only here — see the
          comment on PublicOrgLayout in App.jsx. */}
    </div>
    </>
  );
}

export default PublicCalendar;
