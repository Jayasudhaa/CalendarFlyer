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
import { useTempleConfig } from './hooks/useTempleConfig';
import { getRsvpUrl, getPhotoAlbumUrl } from './utils/rsvpUrl';

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
  if (!ev) return null;
  const m = typeOf(ev.type);
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
            <button onClick={onClose} style={{ background:'rgba(0,0,0,0.06)', border:'none', color:'#92400e', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:12 }}>×</button>
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
          border: following ? '2px solid #ffffff' : '2px solid rgba(255,255,255,0.7)',
          background: following ? 'rgba(255,255,255,0.95)' : 'transparent',
          color: following ? '#8a2c08' : '#ffffff',
          fontWeight: 800, fontSize: '0.88rem', cursor: busy ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)', marginTop: 4,
        }}
      >
        {following ? '✓ Following' : '🔔 Follow'}
      </button>
      {following && (
        <div style={{ marginTop: 10, fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
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
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
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
    if (!phone.trim()) return setError('Enter your phone number.');
    setError(''); setBusy(true);
    try {
      await communityFetch('/api/community/request-code', { method: 'POST', body: JSON.stringify({ phone: phone.trim() }) });
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return setError('Enter the code we texted you.');
    setError(''); setBusy(true);
    try {
      const data = await communityFetch('/api/community/verify-code', { method: 'POST', body: JSON.stringify({ phone: phone.trim(), code: code.trim() }) });
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
          To follow, verify your phone number -- this keeps updates going to people who are actually part of this community.
        </div>
        {step === 'phone' ? (
          <>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Phone Number</label>
            <input type="tel" placeholder="+1 (719) 555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...input, marginBottom: 16 }} />
            {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
            <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? 'Sending...' : 'Text me a code'}</button>
            <button onClick={onClose} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.8rem', cursor: 'pointer', padding: 6 }}>Cancel</button>
          </>
        ) : (
          <>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>6-digit code sent to {phone}</label>
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

function PublicCalendar() {
  const { config: templeConfig } = useTempleConfig();
  const heroIcon = HERO_ICON_BY_CATEGORY[templeConfig.category] || HERO_ICON_BY_CATEGORY.other;
  const [events,        setEvents]        = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingNews,   setLoadingNews]   = useState(true);
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Replaces the old per-category filter pills (Pooja/Festival/Holiday/
  // Kalyanam/Abhishekam) with the same Monthly Events / Monthly Panchang
  // tab switcher the admin dashboard uses (CalendarGrid.jsx's ViewTabs) —
  // see the comment further down at showPanchangTab for why.
  const [viewMode, setViewMode] = useState('events'); // 'events' | 'panchang'
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 900);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fetch events — same org resolution as the admin dashboard (useEvents),
  // so this page always reflects whatever was just added/edited there.
  // Panchang entries come back in this same list (type: 'panchang'); there's
  // no separate panchang endpoint, so we derive it from `events` below
  // instead of a second fetch.
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

  // Fetch each event's Live/Photos state (🔴 live now / 📺 livestream
  // available / 📷 N photos badges on the calendar, plus the modal's Live
  // and Photos sections) -- one batch call for the whole loaded month
  // list rather than one request per event card. Re-runs whenever the
  // event list itself changes (new month loaded, admin adds an event).
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

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build calendar grid
  const getDays = useCallback(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDay  = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const days = [];
    for (let i = firstDay - 1; i >= 0; i--) days.push({ day: prevLast - i, current: false });
    for (let d = 1; d <= lastDay; d++)       days.push({ day: d,           current: true  });
    while (days.length < 42)                 days.push({ day: days.length - firstDay - lastDay + 1, current: false });
    return days;
  }, [year, month]);

  const getEventsForDay = useCallback((day, current) => {
    if (!day || !current) return [];
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return events.filter(e => e.date === ds);
  }, [events, year, month]);
  const allEvents = events;

  const monthEvents = allEvents.filter(e => {
    if (!e.date) return false;
    const [ey, em] = e.date.split('-').map(Number);
    return ey === year && em === month + 1;
  });

  const filteredMonthEvents = viewMode === 'panchang'
    ? monthEvents.filter(e => e.type === 'panchang')
    : monthEvents.filter(e => e.type !== 'panchang');
  const monthCountLabel = viewMode === 'panchang'
    ? `${filteredMonthEvents.length} panchang ${filteredMonthEvents.length === 1 ? 'entry' : 'entries'} this month`
    : `${filteredMonthEvents.length} event${filteredMonthEvents.length !== 1 ? 's' : ''} this month`;

  const today    = new Date();
  const isToday  = (day, current) => current && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Panchang (Hindu lunar calendar data) only makes sense for temple orgs —
  // same org-category gate CalendarGrid.jsx's admin view already uses for
  // its own Panchang tab (`orgCategory === 'temple'`). Non-temple orgs
  // (nonprofit/community/other) just get the single Monthly Events tab,
  // same as the admin dashboard.
  const showPanchangTab = templeConfig.category === 'temple';

  const days = getDays();

  // ── Agenda view for mobile ────────────────────────────────────────────────
  function AgendaView() {
    const agendaDays = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const showEvents = viewMode === 'events';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEvs = showEvents ? events.filter(e => e.date === ds && e.type !== 'panchang') : [];
      const panchangRaw = events.find(e => e.date === ds && e.type === 'panchang');
      const panchang = showEvents ? null : panchangRaw;
      // Panchang tab: skip days with no panchang data (reference-only view,
      // same as the admin dashboard's AgendaView). Events tab: skip empty
      // days, same behavior as before.
      if (showEvents ? !dayEvs.length : !panchang) continue;
      const dt = new Date(ds + 'T12:00:00');
      const isTod = dt.toDateString() === today.toDateString();
      agendaDays.push(
        <div key={d} style={{ display:'flex', gap:10, padding:'10px 12px', background: isTod ? 'linear-gradient(145deg,#fffde8,#fff9cc,#fffbe6)' : 'linear-gradient(145deg,#ffffff,#fffdf8)', border:`1px solid ${isTod ? '#c9943a':'#e8d5a3'}`, borderRadius:8, marginBottom:6 }}>
          <div style={{ textAlign:'center', flexShrink:0, width:38 }}>
            <div style={{ fontSize:21, fontWeight:800, color:'#000', lineHeight:1, fontFamily: "'Playfair Display', Georgia, serif" }}>{d}</div>
            <div style={{ fontSize:10, color:'#000', textTransform:'uppercase' }}>{dt.toLocaleDateString('en-US',{weekday:'short'})}</div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            {panchang && <PanchangBadge ev={panchang} />}
            {dayEvs.map(ev => <EventPill key={ev.id||ev.title} ev={ev} onClick={setSelectedEvent} />)}
          </div>
        </div>
      );
    }
    return agendaDays.length > 0
      ? <div>{agendaDays}</div>
      : <div style={{ textAlign:'center', color:'#000', padding:'40px 0', fontSize:'0.95rem' }}>No events this month</div>;
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#fdf6e9 0%,#fef9f0 50%,#fdf3e3 100%)', fontFamily:"'DM Sans', sans-serif", color:'#000' }}>

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
          <div style={{ display:'flex', justifyContent:'center', gap:'1.2rem', flexWrap:'wrap', fontSize:'clamp(0.75rem,1.6vw,0.92rem)', color:'rgba(255,255,255,0.88)', marginBottom: 14 }}>
            {templeConfig.address && <span>📍 {templeConfig.address}</span>}
            {templeConfig.phone && <span>📞 {templeConfig.phone}</span>}
          </div>
        </div>
      </div>
      )}

      {/* ── Main layout ── */}
      <div className='pub-cal-main' style={{ maxWidth:2000, width:'100%', margin:'0 auto', padding:'20px 16px', display:'grid', gridTemplateColumns: isMobile ? '1fr' : '220px minmax(0,1fr)', gap:16, alignItems:'start' }}>
        {/* ── Sidebar: news feed ── */}
        <div>
          {/* Upcoming events quick list */}
          <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, overflow:'hidden', marginTop:14, boxShadow:'0 6px 24px rgba(180,120,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            <div style={{ background:'linear-gradient(135deg,#1a3a6a12,#0e294a12)', padding:'12px 14px', borderBottom:'1px solid #e8d5a3' }}>
              <div style={{ fontSize:'0.72rem', color:'#000', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>📅 Upcoming Events</div>
            </div>
            <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
              {events
                .filter(e => e.type !== 'panchang' && e.date >= new Date().toISOString().slice(0,10))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 6)
                .map((ev, i) => {
                  return (
                    <div key={i} onClick={() => setSelectedEvent(ev)} style={{ display:'flex', gap:8, cursor:'pointer', padding:'7px 8px', background:'#fffaf4', border:'1px solid #e8d5a3', borderRadius:7, transition:'border-color 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#c9943a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#e8d5a3'}>
                      <div style={{ width:32, flexShrink:0, textAlign:'center' }}>
                        <div style={{ fontSize:15, fontWeight:800, color:'#000', lineHeight:1 }}>
                          {new Date(ev.date+'T12:00:00').getDate()}
                        </div>
                        <div style={{ fontSize:11, color:'#000', textTransform:'uppercase' }}>
                          {new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'})}
                        </div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.9rem', fontWeight:700, color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                        {ev.time && <div style={{ fontSize:'0.8rem', color:'#000' }}>{ev.time}</div>}
                      </div>
                    </div>
                  );
                })}
              {events.filter(e => e.type !== 'panchang' && e.date >= new Date().toISOString().slice(0,10)).length === 0 && !loadingEvents && (
                <div style={{ color:'#000', fontSize:'0.85rem', textAlign:'center', padding:'16px 0' }}>No upcoming events</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Calendar panel ── */}
        <div>
          {/* Nav + filters */}
          <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, padding:'14px 16px', marginBottom:14, boxShadow:'0 4px 20px rgba(180,120,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            {/* Month navigation */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <button onClick={prevMonth} style={{ background:'linear-gradient(135deg,#fff9f0,#fff8ee,#fff)', border:'1px solid #c9943a', color:'#000', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:'0.95rem', boxShadow:'0 2px 8px rgba(180,120,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' }}>‹ Prev</button>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#000' }}>{MONTHS[month]} {year}</div>
                <div style={{ fontSize:'0.85rem', color:'#000' }}>{monthCountLabel}</div>
              </div>
              {/* Next stays on its own dark button background — needs light
                  text for contrast, so it's excluded from the black-font pass
                  (same reasoning as the hero header). */}
              <button onClick={nextMonth} style={{ background:'#2a1a08', border:'1px solid #3a2008', color:'#c9943a', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:'0.95rem' }}>Next ›</button>
            </div>
            {/* View tabs — Monthly Events / Monthly Panchang, the same
                switcher the admin dashboard uses (CalendarGrid.jsx's
                ViewTabs), replacing the old Pooja/Festival/Holiday/Kalyanam/
                Abhishekam filter pills. Panchang tab only for temple orgs. */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {[
                { key:'events',   label:'📅 Monthly Events' },
                ...(showPanchangTab ? [{ key:'panchang', label:'🪔 Monthly Panchang' }] : []),
              ].map(t => {
                const active = viewMode === t.key;
                return (
                  <button key={t.key} onClick={() => setViewMode(t.key)} style={{
                    // Same font family/weight/size as the Prev/Next month-nav
                    // buttons right above, so the tabs read as part of the
                    // same page rather than a smaller, different typeface.
                    padding:'7px 16px', borderRadius:18, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:'0.95rem',
                    border:`1px solid ${active ? '#c9943a' : '#e8d5a3'}`,
                    background: active ? 'linear-gradient(135deg,#c9943a,#e6a800)' : '#fff',
                    color: '#000',
                    transition:'all 0.12s',
                  }}>{t.label}</button>
                );
              })}
            </div>
          </div>

          {loadingEvents ? (
            <div style={{ textAlign:'center', color:'#000', padding:'60px 0', fontSize:'0.95rem' }}>🕉️ Loading events...</div>
          ) : isMobile ? (
            <AgendaView />
          ) : (
            <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, padding:'16px', overflow:'hidden', boxShadow:'0 8px 32px rgba(180,120,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
              {/* Weekday headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:4 }}>
                {WEEKDAYS.map((d, i) => {
                  return (
                    <div key={d} style={{ textAlign:'center', fontSize:13, fontWeight:700, color:'#000', letterSpacing:'0.08em', padding:'4px 0' }}>
                      {d.toUpperCase()}
                    </div>
                  );
                })}
              </div>
              {/* Grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0,1fr))', gap:3 }}>
                {days.map(({ day, current }, idx) => {
                  const dayEvs = getEventsForDay(day, current);
                  return (
                    <CalendarCell
                      key={idx}
                      day={current ? day : null}
                      isToday={isToday(day, current)}
                      isOther={!current}
                      events={dayEvs}
                      viewMode={viewMode}
                      onSelect={setSelectedEvent}
                      mediaByEvent={mediaByEvent}
                    />
                  );
                })}
              </div>
              {/* Legend — same temple-only gate as the filter pills above;
                  non-temple orgs get the generic categories only. */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:12, paddingTop:10, borderTop:'1px solid #e8d5a3' }}>
                {(templeConfig.category === 'temple' ? [
                  { label:'Abhishekam', color:'#f97316' },
                  { label:'Kalyanam',   color:'#eab308' },
                  { label:'Festival',   color:'#dc2626' },
                  { label:'Class',      color:'#0d9488' },
                  { label:'Panchang',   color:'#c9943a' },
                ] : [
                  { label:'Festival',   color:'#dc2626' },
                  { label:'Holiday',    color:'#dc2626' },
                  { label:'Class',      color:'#0d9488' },
                  { label:'Community',  color:'#8b5cf6' },
                ]).map(({ label, color }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:color }} />
                    <span style={{ fontSize:12, color:'#000' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


      </div>

      {/* ── Global styles ── */}
      <style>{`
        @keyframes haloGlow {
          0%,100% { box-shadow: 0 0 0 2px rgba(212,175,55,0.2), 0 4px 12px rgba(180,120,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9); }
          50%      { box-shadow: 0 0 0 3px rgba(212,175,55,0.35), 0 6px 20px rgba(180,120,0,0.2), 0 0 30px rgba(255,200,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .pub-cal-main { animation: fadeInUp 0.5s ease; }
        .temple-header h1 { font-family: 'Playfair Display', Georgia, serif !important; letter-spacing:0.06em; }
        .event-pill:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(180,120,0,0.18); transition:all 0.15s; }
        /* ── Today's calendar cell — diagonal shine sweep, same effect as the admin toolbar's "+ Add Event" ── */
        @keyframes pubTodayShine { 0%{left:-60%} 30%{left:130%} 100%{left:130%} }
        .pub-today-shine { position: relative; }
        .pub-today-shine::after {
          content: '';
          position: absolute;
          top: 0; left: -60%;
          width: 35%; height: 100%;
          background: linear-gradient(115deg, transparent, rgba(255,235,180,0.65), transparent);
          transform: skewX(-20deg);
          animation: pubTodayShine 3.6s ease-in-out infinite;
          pointer-events: none;
          z-index: 2;
        }
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
  );
}

export default PublicCalendar;
