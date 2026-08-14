/**
 * src/components/CalendarSidebar.jsx
 * Right sidebar — Add to Google Calendar, QR code, per-event add buttons
 */
import React, { useState, useEffect, useRef } from 'react';
import { getRsvpUrl } from '../utils/rsvpUrl';

// ── Build Google Calendar URL for a single event ─────────────────────────────
function buildGoogleCalendarUrl(event) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const d    = event.date?.replace(/-/g, '') || '';
  const title = encodeURIComponent(`${event.title} — Sample Temple Name`);
  const details = encodeURIComponent(
    `${event.description || ''}\n\nSample Temple Name\n123 Main Street, Your City, ST 00000\nPhone: 555-555-5555\nRSVP: ${getRsvpUrl(event)}`
  );
  const location = encodeURIComponent('123 Main Street, Your City, ST 00000');

  if (event.time) {
    // Parse time like "10:00 AM" → datetime string
    const [timePart, ampm] = event.time.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const pad   = n => String(n).padStart(2,'0');
    const start = `${d}T${pad(h)}${pad(m)}00`;
    const end   = `${d}T${pad(h+2)}${pad(m)}00`; // +2 hours
    return `${base}&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  }
  // All-day event
  const nextDay = event.date
    ? new Date(new Date(event.date + 'T12:00:00').getTime() + 86400000)
        .toISOString().slice(0,10).replace(/-/g,'')
    : d;
  return `${base}&text=${title}&dates=${d}/${nextDay}&details=${details}&location=${location}`;
};

// ── Build Google Calendar subscription URL for whole calendar ─────────────────
function buildCalendarSubscribeUrl() {
  // iCal feed URL — users subscribe to this in Google Calendar
  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(appUrl + '/api/calendar.ics')}`;
};

// ── QR code generator (using free API) ───────────────────────────────────────
function QRImage({ url, size = 120 }) {
  return (
  <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&qzone=2&format=png`}
    alt="QR Code"
    width={size} height={size}
    style={{ borderRadius:8, border:'1px solid #e5e7eb' }}
  />
);
}

export default function CalendarSidebar({ events = [], currentDate }) {
  const [copiedId,   setCopiedId]   = useState(null);
  const [showQR,     setShowQR]     = useState(null); // eventId
  const [activeTab,  setActiveTab]  = useState('gcal');

  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const year  = currentDate ? currentDate.getFullYear() : new Date().getFullYear();

  // Temple events only (non-panchang), sorted by date
  const templeEvents = events
    .filter(e => e.type !== 'panchang')
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  const calendarUrl = window.location.origin;

  const handleCopyRsvp = async (event) => {
    const url = getRsvpUrl(event);
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const typeColors = {
    pooja:'#f97316', festival:'#8b5cf6', holiday:'#3b82f6',
    kalyanam:'#ec4899', abhishekam:'#10b981',
  };

  const tabs = [
    { id:'gcal', label:'📅 Google Cal' },
    { id:'qr',   label:'📲 QR Codes'  },
  ];

  return (
    <div style={{ width:'100%', fontFamily:"'Georgia', serif" }}>


      {/* ── Tabs ── */}
      <div style={{ display:'flex', borderBottom:'1px solid #e8d5a3', background:'linear-gradient(135deg,#fffdf7,#fff8ee)', borderRadius:'12px 12px 0 0' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex:1, padding:'10px 6px', border:'none', cursor:'pointer',
              fontSize:'1.1rem', fontWeight: activeTab===tab.id ? '600' : '300',
              color: activeTab===tab.id ? '#1e40af' : '#9ca3af',
              background: activeTab===tab.id ? 'white' : 'transparent',
              borderBottom: activeTab===tab.id ? '2px solid #1e40af' : '2px solid transparent',
              marginBottom:-2, transition:'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{
        background:'linear-gradient(135deg,#fffdf7,#fff8ee)', borderRadius:'0 0 12px 12px',
        border:'1px solid #d4af37', borderTop:'none',
        overflowY:'auto', maxHeight:'calc(100vh - 200px)', minHeight:500,
      }}>

        {/* GOOGLE CALENDAR TAB */}
        {activeTab === 'gcal' && (
          <div style={{ padding:'12px' }}>

            {/* Subscribe whole calendar */}
            <div style={{
              padding:'12px', background:'linear-gradient(135deg,#fffdf7,#fff8ee)',
              border:'1px solid #d4af37', borderRadius:10, marginBottom:12,
            }}>
              <div style={{ fontSize:'1.2rem', fontWeight:'700', color:'#8B4513', marginBottom:6 }}>
                📅 Subscribe to All Temple Events
              </div>
              <div style={{ fontSize:'1.2rem', color:'#b97a3a', marginBottom:10, lineHeight:1.65 }}>
                Add all temple events to your Google Calendar and get automatic updates.
              </div>
              <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=Subscribe+to+Sample+Temple+Name&details=${encodeURIComponent('Visit ' + calendarUrl + ' to add all temple events')}&location=${encodeURIComponent('123 Main Street, Your City, ST 00000')}`}
                target="_blank" rel="noreferrer"
                style={{
                  display:'block', textAlign:'center', padding:'12px 14px',
                  background:'linear-gradient(135deg,#c2410c,#9a3412)',
                  color:'white', borderRadius:8, textDecoration:'none',
                  fontSize:'1.2rem', fontWeight:'700',
                  boxShadow:'0 2px 8px rgba(30,64,175,0.25)',
                }}>
                🗓 Open Google Calendar
              </a>
            </div>

            {/* Individual event add buttons */}
            <div style={{ fontSize:'1.1rem', fontWeight:'700', color:'#b97a3a',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
              Add Individual Events
            </div>

            {templeEvents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#b97a3a', fontSize:'1.4rem' }}>
                No events this month
              </div>
            ) : templeEvents.map(event => {
              const d = new Date(event.date + 'T12:00:00');
              const dayNum  = d.getDate();
              const dayName = d.toLocaleDateString('en-US', { weekday:'short' });
              const color   = typeColors[event.type] || '#6b7280';
              const gcalUrl = buildGoogleCalendarUrl(event);
              return (
                <div key={event.id} style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'11px 13px', marginBottom:5,
                  background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1px solid #e8d5a3',
                  borderLeft:`3px solid ${color}`, borderRadius:9,
                }}>
                  {/* Date badge */}
                  <div style={{ textAlign:'center', flexShrink:0, width:40 }}>
                    <div style={{ fontSize:'1.0rem', fontWeight:'800', color, lineHeight:1 }}>{dayNum}</div>
                    <div style={{ fontSize:'1.0rem', color:'#b97a3a', textTransform:'uppercase' }}>{dayName}</div>
                  </div>
                  {/* Title */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'1.1rem', fontWeight:'600', color:'#3d2008',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {event.title}
                    </div>
                    {event.time && (
                      <div style={{ fontSize:'1rem', color:'#b97a3a' }}>{event.time}</div>
                    )}
                  </div>
                  {/* Add to Google Cal button */}
                  <a href={gcalUrl} target="_blank" rel="noreferrer"
                    title="Add to Google Calendar"
                    style={{
                      flexShrink:0, padding:'4px 8px',
                      background:'linear-gradient(135deg,#fffdf7,#fff8ee)', border:'1.5px solid #dbeafe',
                      borderRadius:7, textDecoration:'none',
                      fontSize:'1.1rem', color:'#8B4513', fontWeight:'600',
                      display:'flex', alignItems:'center', gap:3,
                      transition:'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='#eff6ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='white'; }}>
                    <span style={{fontWeight:'700'}}>+</span><span style={{marginLeft:2}}>GCal</span>
                  </a>
                </div>
              );
            })}

            {/* Footer note */}
            <div style={{
              marginTop:10, padding:'11px 13px', background:'linear-gradient(135deg,#fffdf7,#fff8ee)',
              border:'1px solid #e8d5a3', borderRadius:8,
              fontSize:'1.4rem', color:'#6b2d0a', lineHeight:1.65,
            }}>
              💡 Tip: After clicking "+ GCal", Google Calendar will open. Click "Save" to add the event.
            </div>
          </div>
        )}

        {/* QR CODE TAB */}
        {activeTab === 'qr' && (
          <div style={{ padding:'12px' }}>

            {/* Temple calendar QR */}
            <div style={{
              padding:'12px', background:'linear-gradient(135deg,#fffdf7,#fff8ee)',
              border:'1px solid #d4af37', borderRadius:10,
              marginBottom:12, textAlign:'center',
            }}>
              <div style={{ fontSize:'1.4rem', fontWeight:'700', color:'#8B4513', marginBottom:8 }}>
                📲 Scan to Open Temple Calendar
              </div>
              <QRImage url={calendarUrl} size={130} />
              <div style={{ fontSize:'1.4rem', color:'#b97a3a', marginTop:8, lineHeight:1.6 }}>
                Share this QR code to let devotees access<br/>the temple calendar on their phone
              </div>
              <a href={calendarUrl} target="_blank" rel="noreferrer"
                style={{ display:'inline-block', marginTop:8, padding:'5px 12px',
                  background:'#c2410c', color:'white', borderRadius:7,
                  textDecoration:'none', fontSize:'1.4rem', fontWeight:'600' }}>
                🔗 Open Calendar
              </a>
            </div>

            {/* Per-event RSVP QR codes */}
            <div style={{ fontSize:'1.4rem', fontWeight:'700', color:'#b97a3a',
              textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
              Event RSVP QR Codes
            </div>

            {templeEvents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#b97a3a', fontSize:'1.4rem' }}>
                No events this month
              </div>
            ) : templeEvents.map(event => {
              const rsvpUrl = getRsvpUrl(event);
              const color   = typeColors[event.type] || '#6b7280';
              const isOpen  = showQR === event.id;
              return (
                <div key={event.id} style={{
                  marginBottom:6, background:'linear-gradient(135deg,#fffdf7,#fff8ee)',
                  border:'1px solid #e8d5a3', borderLeft:`3px solid ${color}`,
                  borderRadius:9, overflow:'hidden',
                }}>
                  {/* Event row */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 13px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'1.4rem', fontWeight:'600', color:'#3d2008',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {event.title}
                      </div>
                      <div style={{ fontSize:'1.4rem', color:'#b97a3a' }}>
                        {new Date(event.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                        {event.time ? ` · ${event.time}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      {/* Copy RSVP link */}
                      <button onClick={() => handleCopyRsvp(event)}
                        title="Copy RSVP link"
                        style={{ padding:'4px 7px', border:'1.5px solid #e5e7eb',
                          background:'linear-gradient(135deg,#fffdf7,#fff8ee)', borderRadius:6, cursor:'pointer',
                          fontSize:'1.4rem', color: copiedId===event.id ? '#16a34a' : '#6b7280',
                          fontWeight:'600', transition:'all 0.12s' }}>
                        {copiedId === event.id ? '✓ Copied' : '🔗 Copy'}
                      </button>
                      {/* Toggle QR */}
                      <button onClick={() => setShowQR(isOpen ? null : event.id)}
                        title="Show QR code"
                        style={{ padding:'4px 7px', border:'1.5px solid #dbeafe',
                          background: isOpen ? '#eff6ff' : 'white',
                          borderRadius:6, cursor:'pointer',
                          fontSize:'1.4rem', color:'#8B4513', fontWeight:'600' }}>
                        📲 QR
                      </button>
                    </div>
                  </div>

                  {/* Expanded QR */}
                  {isOpen && (
                    <div style={{
                      padding:'12px 14px', background:'linear-gradient(135deg,#fffdf7,#fff8ee)',
                      borderTop:'1px solid #f3f4f6', textAlign:'center',
                    }}>
                      <div style={{ fontSize:'1.4rem', color:'#b97a3a', marginBottom:8 }}>
                        Scan to RSVP for this event
                      </div>
                      <QRImage url={rsvpUrl} size={110} />
                      <div style={{ fontSize:'1.4rem', color:'#b97a3a', marginTop:8,
                        wordBreak:'break-all', lineHeight:1.6 }}>
                        {rsvpUrl}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
