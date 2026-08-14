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
import WebChatWidget from './components/WebChatWidget';

// ── Constants ─────────────────────────────────────────────────────────────────
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
function buildGCalUrl(ev) {
  const base  = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const d     = (ev.date || '').replace(/-/g, '');
  const title = encodeURIComponent(`${ev.title} — Sample Temple Name`);
  const loc   = encodeURIComponent(TEMPLE_ADDRESS);
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

function getRsvpUrl(ev) {
  const slug = (ev.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/rsvp/${ev.date}-${slug}`;
}

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
          <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#fff', borderRadius:2, padding:'1px 4px' }}>T</span>
          <span style={{ fontSize:11, color:'#6b2d0a', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tithi}</span>
        </div>
      )}
      {nakshatra && (
        <div style={{ display:'flex', gap:4, alignItems:'center', marginTop: tithi ? 2 : 0 }}>
          <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#fff', borderRadius:2, padding:'1px 4px' }}>N</span>
          <span style={{ fontSize:11, color:'#6b2d0a', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nakshatra}</span>
        </div>
      )}
    </div>
  );
}

function EventPill({ ev, onClick }) {
  const m = typeOf(ev.type);
  return (
    <div onClick={() => onClick(ev)}
      style={{ borderLeft:`2px solid ${m.color}`, background:m.bg, borderRadius:'0 4px 4px 0',
        padding:'3px 6px 4px', marginBottom:3, cursor:'pointer',
        transition:'filter 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
    >
      <div style={{ fontSize:11, fontWeight:700, color:m.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
      {ev.time && <div style={{ fontSize:10, color:'#92400e', marginTop:1 }}>🕐 {ev.time}</div>}
    </div>
  );
}

function CalendarCell({ day, isToday, isOther, events, onSelect }) {
  const panchang = events.find(e => e.type === 'panchang') || null;
  const regular  = events.filter(e => e.type !== 'panchang');
  const MAX = 2;
  const visible = regular.slice(0, MAX);
  const extra   = regular.length - MAX;

  return (
    <div style={{
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
              fontSize: 14, fontWeight: 700,
              color:    isToday ? '#8B4513' : '#c9943a',
            }}>{day}</span>
            {isToday && <span style={{ fontSize:8, fontWeight:800, background:'linear-gradient(135deg,#c9943a,#e6a800)', color:'#fff', border:'none', boxShadow:'0 1px 3px rgba(180,120,0,0.3)', borderRadius:3, padding:'1px 5px' }}>TODAY</span>}
          </div>
          {panchang && <PanchangBadge ev={panchang} />}
          {visible.map(ev => <EventPill key={ev.id || ev.title} ev={ev} onClick={onSelect} />)}
          {extra > 0 && (
            <div onClick={() => onSelect(regular[MAX])}
              style={{ fontSize:11, color:'#7a5a30', fontWeight:700, cursor:'pointer', padding:'2px 6px',
                background:'#fde8c8', borderRadius:3, borderLeft:'2px solid #c9943a' }}>
              +{extra} more
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventDetailModal({ ev, onClose }) {
  if (!ev) return null;
  const m = typeOf(ev.type);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#fffdf7', border:'1px solid #e8d5a3', borderRadius:16,
        maxWidth:480, width:'100%', overflow:'hidden',
        boxShadow:'0 24px 60px rgba(0,0,0,0.6)',
        fontFamily:'Georgia,serif',
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
              <div style={{ fontSize:10, color:'#92400e', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Date</div>
              <div style={{ color:'#6b2d0a', fontWeight:700 }}>
                {ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '—'}
              </div>
            </div>
            {ev.time && (
              <div>
                <div style={{ fontSize:10, color:'#7a5a30', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Time</div>
                <div style={{ color:'#e8c878', fontWeight:700 }}>{ev.time}</div>
              </div>
            )}
          </div>
          {ev.description && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#7a5a30', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Details</div>
              <div style={{ color:'#6b3a1f', fontSize:'0.88rem', lineHeight:1.7 }}>{ev.description}</div>
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <a href={getRsvpUrl(ev)} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#065f46,#047857)', border:'none', borderRadius:8, color:'#6ee7b7', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:'Georgia,serif' }}>
              🙏 RSVP
            </a>
            <a href={buildGCalUrl(ev)} target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#1a3a6a,#1e4080)', border:'none', borderRadius:8, color:'#93c5fd', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:'Georgia,serif' }}>
              📅 Add to Google Cal
            </a>
            <a href={`https://wa.me/${TEMPLE_WA}?text=${encodeURIComponent(`I want to know more about: ${ev.title} on ${ev.date}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg,#128c3e,#25d366)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:'0.85rem', textAlign:'center', textDecoration:'none', fontFamily:'Georgia,serif' }}>
              💬 Ask on WhatsApp
            </a>
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
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9000, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10, fontFamily:'Georgia,serif' }}>
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
                  style={{ padding:'5px 10px', borderRadius:18, border:'1px solid #e8d5a3', background:'#fffaf0', color:'#8B4513', fontSize:'0.72rem', cursor:'pointer', fontWeight:600, fontFamily:'Georgia,serif' }}
                  onMouseEnter={e => { e.target.style.background='#fef3e2'; e.target.style.borderColor='#c4a35a'; }}
                  onMouseLeave={e => { e.target.style.background='#fffaf0'; e.target.style.borderColor='#e8d5a3'; }}
                >{q}</button>
              ))}
            </div>
            <button onClick={() => openWA()}
              style={{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#25d366,#128c3e)', border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'Georgia,serif', boxShadow:'0 3px 12px rgba(37,211,102,0.3)' }}>
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
        <div style={{ fontSize:'0.62rem', color:'#7a5a30', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>📢 Announcements</div>
      </div>
      <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading && (
          <div style={{ color:'#7a5a30', fontSize:'0.8rem', textAlign:'center', padding:'20px 0' }}>Loading...</div>
        )}
        {!loading && announcements.length === 0 && (
          <div style={{ color:'#7a5a30', fontSize:'0.8rem', textAlign:'center', padding:'20px 0' }}>No announcements</div>
        )}
        {announcements.map((a, i) => (
          <div key={i} style={{ background:'#fffaf4', border:'1px solid #e8d5a3', borderRadius:8, padding:'10px 12px' }}>
            {a.date && <div style={{ fontSize:'0.65rem', color:'#c9943a', fontWeight:700, marginBottom:3 }}>
              {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}
            </div>}
            <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#3d2008', marginBottom:a.body ? 4 : 0 }}>{a.title || a.subject}</div>
            {a.body && <div style={{ fontSize:'0.77rem', color:'#92400e', lineHeight:1.5 }}>{a.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function PublicCalendar() {
  const [events,        setEvents]        = useState([]);
  const [panchang,      setPanchang]      = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingNews,   setLoadingNews]   = useState(true);
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilter,  setActiveFilter]  = useState('all');
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 900);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Fetch events — try /api/events first, fall back to /api/events/upcoming
  useEffect(() => {
    fetch('/api/events')
      .then(r => {
        if (!r.ok) throw new Error('not ok');
        return r.json();
      })
      .then(data => {
        const evs = Array.isArray(data) ? data : data.events || [];
        if (evs.length > 0) { setEvents(evs); return; }
        // fallback to upcoming if empty
        return fetch('/api/events/upcoming')
      .then(r => r.json())
          .then(d => setEvents(Array.isArray(d) ? d : d.events || []));
      })
      .catch(() =>
        fetch('/api/events/upcoming')
          .then(r => r.json())
          .then(d => setEvents(Array.isArray(d) ? d : d.events || []))
      .catch(() => setEvents([]))
      )
      .finally(() => setLoadingEvents(false));
  }, []);

  // Fetch panchang
  useEffect(() => {
    fetch('/api/events/panchang')
      .then(r => r.json())
      .then(data => setPanchang(Array.isArray(data) ? data : []))
      .catch(() => setPanchang([]));
  }, []);
  // Fetch announcements
  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(data => { setAnnouncements(Array.isArray(data) ? data : data.announcements || []); })
      .catch(() => setAnnouncements([]))
      .finally(() => setLoadingNews(false));
  }, []);

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
    const combined = [...events, ...panchang];
    return combined.filter(e => e.date === ds);
  }, [events, panchang, year, month]);
  const allEvents = [...events, ...panchang];

  const monthEvents = allEvents.filter(e => {
    if (!e.date) return false;
    const [ey, em] = e.date.split('-').map(Number);
    return ey === year && em === month + 1;
  });

  const filteredMonthEvents = activeFilter === 'all'
    ? monthEvents
    : monthEvents.filter(e => (e.type || '').toLowerCase() === activeFilter);

  const today    = new Date();
  const isToday  = (day, current) => current && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const eventTypes = [...new Set(monthEvents.map(e => (e.type || '').toLowerCase()).filter(Boolean))];

  const days = getDays();

  // ── Agenda view for mobile ────────────────────────────────────────────────
  function AgendaView() {
    const agendaDays = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEvs = events.filter(e =>
        e.date === ds && e.type !== 'panchang' &&
        (activeFilter === 'all' || (e.type||'').toLowerCase() === activeFilter)
      );
      const panchangRaw = events.find(e => e.date === ds && e.type === 'panchang');
      const panchang = (activeFilter === 'all' || activeFilter === 'panchang') ? panchangRaw : null;
      if (!dayEvs.length && !panchang) continue;
      const dt = new Date(ds + 'T12:00:00');
      const isTod = dt.toDateString() === today.toDateString();
      agendaDays.push(
        <div key={d} style={{ display:'flex', gap:10, padding:'10px 12px', background: isTod ? 'linear-gradient(145deg,#fffde8,#fff9cc,#fffbe6)' : 'linear-gradient(145deg,#ffffff,#fffdf8)', border:`1px solid ${isTod ? '#c9943a':'#e8d5a3'}`, borderRadius:8, marginBottom:6 }}>
          <div style={{ textAlign:'center', flexShrink:0, width:38 }}>
            <div style={{ fontSize:20, fontWeight:800, color: isTod ? '#8B4513' : '#c9943a', lineHeight:1 }}>{d}</div>
            <div style={{ fontSize:9, color:'#92400e', textTransform:'uppercase' }}>{dt.toLocaleDateString('en-US',{weekday:'short'})}</div>
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
      : <div style={{ textAlign:'center', color:'#92400e', padding:'40px 0', fontSize:'0.9rem' }}>No events this month</div>;
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#fdf6e9 0%,#fef9f0 50%,#fdf3e3 100%)', fontFamily:'Georgia,serif', color:'#3d2008' }}>

      {/* ── Hero Header ── */}
      <div style={{
        background:'linear-gradient(135deg,#b83a0a 0%,#8a2c08 35%,#6b210a 65%,#a34508 100%)',
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
          <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#ffd700,#e6a600,#ffb700)', border:'2px solid rgba(255,255,255,0.9)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 0 4px rgba(255,215,0,0.3), 0 0 0 8px rgba(255,215,0,0.1), 0 0 40px rgba(255,180,0,0.4), 0 10px 30px rgba(0,0,0,0.3)', fontSize:'1.8rem' }}>🕉️</div>
          <h1 style={{ fontSize:'clamp(1.5rem,4vw,2.6rem)', fontWeight:700, color:'#fff', margin:'0 0 8px', letterSpacing:'0.03em' }}>
            {TEMPLE_NAME.toUpperCase()}
          </h1>
          <div style={{ display:'flex', justifyContent:'center', gap:'1.2rem', flexWrap:'wrap', fontSize:'clamp(0.75rem,1.6vw,0.92rem)', color:'rgba(255,255,255,0.88)' }}>
            <span>📍 {TEMPLE_ADDRESS}</span>
            <span>📞 {TEMPLE_PHONE}</span>
            <span>🌐 {TEMPLE_WEBSITE}</span>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className='pub-cal-main' style={{ maxWidth:2000, width:'100%', margin:'0 auto', padding:'20px 16px', display:'grid', gridTemplateColumns: isMobile ? '1fr' : '220px minmax(0,1fr)', gap:16, alignItems:'start' }}>
        {/* ── Sidebar: news feed ── */}
        <div>
          <NewsFeedPanel announcements={announcements} loading={loadingNews} />
          {/* Upcoming events quick list */}
          <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, overflow:'hidden', marginTop:14, boxShadow:'0 6px 24px rgba(180,120,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
            <div style={{ background:'linear-gradient(135deg,#1a3a6a12,#0e294a12)', padding:'12px 14px', borderBottom:'1px solid #e8d5a3' }}>
              <div style={{ fontSize:'0.62rem', color:'#7a5a30', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>📅 Upcoming Events</div>
            </div>
            <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
              {events
                .filter(e => e.type !== 'panchang' && e.date >= new Date().toISOString().slice(0,10))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 6)
                .map((ev, i) => {
                  const m = typeOf(ev.type);
                  return (
                    <div key={i} onClick={() => setSelectedEvent(ev)} style={{ display:'flex', gap:8, cursor:'pointer', padding:'7px 8px', background:'#fffaf4', border:'1px solid #e8d5a3', borderRadius:7, transition:'border-color 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#c9943a'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#e8d5a3'}>
                      <div style={{ width:32, flexShrink:0, textAlign:'center' }}>
                        <div style={{ fontSize:13, fontWeight:800, color:m.color, lineHeight:1 }}>
                          {new Date(ev.date+'T12:00:00').getDate()}
                        </div>
                        <div style={{ fontSize:9, color:'#7a5a30', textTransform:'uppercase' }}>
                          {new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'})}
                        </div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#3d2008', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                        {ev.time && <div style={{ fontSize:'0.68rem', color:'#7a5a30' }}>{ev.time}</div>}
                      </div>
                    </div>
                  );
                })}
              {events.filter(e => e.type !== 'panchang' && e.date >= new Date().toISOString().slice(0,10)).length === 0 && !loadingEvents && (
                <div style={{ color:'#92400e', fontSize:'0.8rem', textAlign:'center', padding:'16px 0' }}>No upcoming events</div>
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
              <button onClick={prevMonth} style={{ background:'linear-gradient(135deg,#fff9f0,#fff8ee,#fff)', border:'1px solid #c9943a', color:'#8B4513', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:700, fontSize:'0.9rem', boxShadow:'0 2px 8px rgba(180,120,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' }}>‹ Prev</button>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'1.15rem', fontWeight:800, color:'#e8c878' }}>{MONTHS[month]} {year}</div>
                <div style={{ fontSize:'0.7rem', color:'#7a5a30' }}>{filteredMonthEvents.length} event{filteredMonthEvents.length !== 1 ? 's' : ''} this month</div>
              </div>
              <button onClick={nextMonth} style={{ background:'#2a1a08', border:'1px solid #3a2008', color:'#c9943a', borderRadius:7, padding:'7px 14px', cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:700, fontSize:'0.9rem' }}>Next ›</button>
            </div>
            {/* Type filters */}
            {eventTypes.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {['all', ...eventTypes].map(t => {
                  const m = typeOf(t);
                  const active = activeFilter === t;
                  return (
                    <button key={t} onClick={() => setActiveFilter(t)} style={{
                      padding:'4px 12px', borderRadius:18, cursor:'pointer', fontFamily:'Georgia,serif', fontWeight:700, fontSize:'0.72rem',
                      border:`1px solid ${active ? m.color : '#e8d5a3'}`,
                      background: active ? m.bg : '#fff',
                      color: active ? m.color : '#92400e',
                      textTransform:'capitalize', transition:'all 0.12s',
                    }}>{t === 'all' ? '✦ All Events' : m.label}</button>
                  );
                })}
              </div>
            )}
          </div>

          {loadingEvents ? (
            <div style={{ textAlign:'center', color:'#92400e', padding:'60px 0', fontSize:'0.9rem' }}>🕉️ Loading events...</div>
          ) : isMobile ? (
            <AgendaView />
          ) : (
            <div style={{ background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #d4af37', borderRadius:14, padding:'16px', overflow:'hidden', boxShadow:'0 8px 32px rgba(180,120,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
              {/* Weekday headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:4 }}>
                {WEEKDAYS.map((d, i) => {
                  const isCol = today.getDay()===i && month===today.getMonth() && year===today.getFullYear();
                  return (
                    <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color: isCol ? '#8B4513' : '#b97a3a', letterSpacing:'0.08em', padding:'4px 0' }}>
                      {d.toUpperCase()}
                    </div>
                  );
                })}
              </div>
              {/* Grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, minmax(0,1fr))', gap:3 }}>
                {days.map(({ day, current }, idx) => {
                  const dayEvs = getEventsForDay(day, current);
                  // Apply filter to regular events only
                  const filtered = dayEvs.filter(e => activeFilter === 'all' || (e.type||'').toLowerCase() === activeFilter);
                  return (
                    <CalendarCell
                      key={idx}
                      day={current ? day : null}
                      isToday={isToday(day, current)}
                      isOther={!current}
                      events={filtered}
                      onSelect={setSelectedEvent}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:12, paddingTop:10, borderTop:'1px solid #e8d5a3' }}>
                {[
                  { label:'Abhishekam', color:'#f97316' },
                  { label:'Kalyanam',   color:'#eab308' },
                  { label:'Festival',   color:'#dc2626' },
                  { label:'Class',      color:'#0d9488' },
                  { label:'Panchang',   color:'#c9943a' },
                ].map(({ label, color }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:color }} />
                    <span style={{ fontSize:11, color:'#92400e' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


      </div>

      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');
        @keyframes haloGlow {
          0%,100% { box-shadow: 0 0 0 2px rgba(212,175,55,0.2), 0 4px 12px rgba(180,120,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9); }
          50%      { box-shadow: 0 0 0 3px rgba(212,175,55,0.35), 0 6px 20px rgba(180,120,0,0.2), 0 0 30px rgba(255,200,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .pub-cal-main { animation: fadeInUp 0.5s ease; }
        .temple-header h1 { font-family: 'Cinzel', 'Georgia', serif !important; letter-spacing:0.06em; }
        .event-pill:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(180,120,0,0.18); transition:all 0.15s; }
      `}</style>
      {/* ── Footer ── */}
      <div style={{ borderTop:'1px solid #e8d5a3', padding:'18px 20px', textAlign:'center', color:'#92400e', fontSize:'0.82rem', marginTop:8 }}>
        🕉️ {TEMPLE_NAME} · <a href={`tel:${TEMPLE_PHONE}`} style={{ color:'#c9943a', textDecoration:'none' }}>{TEMPLE_PHONE}</a>
      </div>

      {/* ── Event detail modal ── */}
      {selectedEvent && <EventDetailModal ev={selectedEvent} onClose={() => setSelectedEvent(null)} />}

      {/* ── WhatsApp Widget ── */}
      <WebChatWidget events={events} />
    </div>
  );
}

export default PublicCalendar;
