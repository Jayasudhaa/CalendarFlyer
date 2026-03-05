/**
 * src/pages/RSVPAdmin.jsx
 * Premium RSVP Admin Dashboard — light theme, elegant design
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const decodeEventInfo = (eventId) => {
  try { return JSON.parse(atob(eventId)); } catch { return { title: 'Event', date: '' }; }
};

const MEAL_COLORS = {
  'Vegetarian Prasadam': '#16a34a',
  'Veg Lunch':           '#2563eb',
  'No Meal':             '#9ca3af',
  'not specified':       '#d1d5db',
};
export default function RSVPAdmin() {
  const { eventId }       = useParams();
  const [searchParams]    = useSearchParams();
  const secret         = searchParams.get('secret') || import.meta.env.VITE_ADMIN_SECRET || '';
  const eventInfo         = decodeEventInfo(eventId);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [deleting, setDeleting] = useState(null);
  const [search,  setSearch]  = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/rsvp/${eventId}`, {
        headers: { 'x-admin-secret': secret },
      });
      if (res.status === 401) throw new Error('Invalid admin secret');
      if (!res.ok) throw new Error('Failed to fetch RSVP data');
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId, secret]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (rsvpId, name) => {
    if (!window.confirm(`Remove RSVP for ${name}?`)) return;
    setDeleting(rsvpId);
    await fetch(`${API}/api/rsvp/${eventId}/${rsvpId}`, {
      method: 'DELETE', headers: { 'x-admin-secret': secret },
    });
    setDeleting(null);
    fetchData();
  };

  const exportCSV = () => {
    if (!data?.items?.length) return;
    const rows = [
      ['Name', 'Attendees', 'Meal Preference', 'Submitted At'],
      ...data.items.map(i => [i.name, i.count, i.meal, new Date(i.createdAt).toLocaleString()]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `rsvp_${eventInfo.title?.replace(/\s+/g,'_') || 'event'}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Timeline bar chart ──────────────────────────────────────────────────────
  const TimelineChart = ({ timeline }) => {
    const entries = Object.entries(timeline).sort(([a],[b]) => a.localeCompare(b));
    if (!entries.length) return <div style={{ color:'#9ca3af', fontSize:'0.85rem', padding:'24px 0', textAlign:'center' }}>No timeline data yet</div>;
    const max = Math.max(...entries.map(([,v]) => v));
    return (
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120, paddingTop:8 }}>
        {entries.map(([date, val]) => (
          <div key={date} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, minWidth:0 }}>
            <div style={{ fontSize:'0.72rem', color:'#7c3aed', fontWeight:'700', marginBottom:4 }}>{val}</div>
            <div style={{ width:'100%',
              background:'linear-gradient(to top, #7c3aed, #a78bfa)',
              height:`${Math.round((val/max)*90)+8}px`,
              borderRadius:'6px 6px 0 0', minHeight:10,
              boxShadow:'0 4px 12px rgba(124,58,237,0.2)' }} />
            <div style={{ fontSize:'0.62rem', color:'#9ca3af', marginTop:5, textAlign:'center',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>
              {new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Meal breakdown bars ─────────────────────────────────────────────────────
  const MealBreakdown = ({ breakdown, total }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {Object.entries(breakdown).map(([meal, cnt]) => (
        <div key={meal}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:'0.82rem', color:'#374151', fontWeight:'500' }}>{meal}</span>
            <span style={{ fontSize:'0.82rem', color: MEAL_COLORS[meal]||'#6b7280', fontWeight:'700' }}>
              {cnt} guest{cnt!==1?'s':''}
            </span>
          </div>
          <div style={{ background:'#f3f4f6', borderRadius:8, height:10, overflow:'hidden' }}>
            <div style={{
              width:`${Math.round((cnt/total)*100)}%`, height:'100%',
              background: MEAL_COLORS[meal]||'#9ca3af',
              borderRadius:8, transition:'width 0.6s ease',
              boxShadow:`0 2px 8px ${MEAL_COLORS[meal]||'#9ca3af'}44`
            }} />
            </div>
          <div style={{ fontSize:'0.68rem', color:'#9ca3af', marginTop:3 }}>
            {Math.round((cnt/total)*100)}% of total guests
          </div>
        </div>
        ))}
      </div>
    );

  const filtered = data?.items?.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.page}>
      <div style={{ textAlign:'center', paddingTop:80 }}>
        <div style={{ fontSize:'2rem', marginBottom:12 }}>⏳</div>
        <div style={{ color:'#6b7280', fontSize:'1rem' }}>Loading RSVP data…</div>
      </div>
    </div>
  );
  if (error) return (
    <div style={s.page}>
      <div style={{ maxWidth:480, margin:'80px auto', padding:32, background:'white',
        borderRadius:16, border:'1px solid #fecaca', textAlign:'center',
        boxShadow:'0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:12 }}>⚠️</div>
        <div style={{ color:'#dc2626', fontWeight:'700', fontSize:'1.1rem', marginBottom:8 }}>Access Error</div>
        <div style={{ color:'#6b7280', fontSize:'0.88rem' }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── Page header ── */}
        <div style={s.pageHeader}>
          <div style={s.breadcrumb}>🛕 Sri Venkateswara Swamy Temple · RSVP Analytics</div>
            <div style={s.eventTitle}>{eventInfo.title}</div>
          {eventInfo.date && (
            <div style={s.eventDate}>
              📅 {new Date(eventInfo.date+'T12:00:00').toLocaleDateString('en-US',{
                weekday:'long', year:'numeric', month:'long', day:'numeric'
              })}
          </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
            <button onClick={fetchData} style={s.btnOutline}>↺ Refresh</button>
            <button onClick={exportCSV} disabled={!data?.items?.length} style={s.btnPrimary}>
              ⬇ Export CSV
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={s.statsGrid}>
          {[
            { label:'Total RSVPs',    value: data.items.length,  icon:'📋', color:'#7c3aed', bg:'#f5f3ff' },
            { label:'Total Guests',   value: data.totalCount,    icon:'👥', color:'#059669', bg:'#f0fdf4' },
            { label:'Avg Party Size', value: data.items.length ? (data.totalCount/data.items.length).toFixed(1) : '—', icon:'👨‍👩‍👧', color:'#d97706', bg:'#fffbeb' },
            { label:'Days Active',    value: Object.keys(data.timeline).length, icon:'📅', color:'#2563eb', bg:'#eff6ff' },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} style={{ ...s.statCard, background: bg, borderColor: color+'33' }}>
              <div style={{ fontSize:'2rem', marginBottom:8 }}>{icon}</div>
              <div style={{ fontSize:'2.4rem', fontWeight:'900', color, lineHeight:1 }}>{value}</div>
              <div style={{ fontSize:'0.78rem', color:'#6b7280', marginTop:6, fontWeight:'500' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div style={s.chartsRow}>
          <div style={s.card}>
            <div style={s.cardTitle}>📈 RSVPs Over Time</div>
            <div style={{ color:'#9ca3af', fontSize:'0.72rem', marginBottom:16 }}>Guests per day</div>
            <TimelineChart timeline={data.timeline} />
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>🍽 Meal Preferences</div>
            <div style={{ color:'#9ca3af', fontSize:'0.72rem', marginBottom:20 }}>
              {data.totalCount} total guests
            </div>
            {Object.keys(data.mealBreakdown).length
              ? <MealBreakdown breakdown={data.mealBreakdown} total={data.totalCount} />
              : <div style={{ color:'#9ca3af', fontSize:'0.85rem' }}>No meal data yet</div>}
          </div>
        </div>

        {/* ── RSVP table ── */}
        <div style={s.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={s.cardTitle}>👥 All RSVPs</div>
              <div style={{ color:'#9ca3af', fontSize:'0.72rem', marginTop:2 }}>
                {filtered.length} {filtered.length===1?'entry':'entries'}
              </div>
            </div>
            <input
              placeholder="🔍 Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📭</div>
              <div style={{ fontSize:'0.9rem' }}>No RSVPs yet for this event</div>
            </div>
          ) : (
              <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                  <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
                    {['#','Name','Guests','Meal Preference','Submitted',''].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left',
                        color:'#9ca3af', fontWeight:'600', fontSize:'0.72rem',
                        textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        {h}
                      </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                    <tr key={item.rsvpId}
                      style={{ borderBottom:'1px solid #f9fafb', transition:'background 0.1s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#fafafa'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'14px 14px', color:'#d1d5db', fontSize:'0.8rem' }}>{idx+1}</td>
                      <td style={{ padding:'14px 14px', fontWeight:'600', color:'#111827', fontSize:'0.92rem' }}>
                        {item.name}
                      </td>
                      <td style={{ padding:'14px 14px', textAlign:'center' }}>
                        <span style={{ background:'#f0fdf4', color:'#16a34a', fontWeight:'800',
                          fontSize:'0.92rem', padding:'3px 12px', borderRadius:20 }}>
                          {item.count}
                        </span>
                      </td>
                      <td style={{ padding:'14px 14px' }}>
                        <span style={{ background:`${MEAL_COLORS[item.meal]||'#9ca3af'}18`,
                          color: MEAL_COLORS[item.meal]||'#6b7280',
                          padding:'3px 10px', borderRadius:20, fontSize:'0.78rem', fontWeight:'500' }}>
                          {item.meal}
                        </span>
                      </td>
                      <td style={{ padding:'14px 14px', color:'#9ca3af', fontSize:'0.78rem' }}>
                        {new Date(item.createdAt).toLocaleDateString('en-US',{
                          month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
                        })}
                        </td>
                      <td style={{ padding:'14px 14px' }}>
                          <button onClick={()=>handleDelete(item.rsvpId, item.name)}
                            disabled={deleting===item.rsvpId}
                          style={{ padding:'5px 12px', background:'white',
                            border:'1.5px solid #fca5a5', color:'#ef4444',
                            borderRadius:7, cursor:'pointer', fontSize:'0.75rem',
                            transition:'all 0.15s' }}
                          onMouseEnter={e=>{ e.currentTarget.style.background='#fef2f2'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.background='white'; }}>
                          {deleting===item.rsvpId ? '…' : '🗑 Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div style={{ textAlign:'center', color:'#d1d5db', fontSize:'0.72rem', marginTop:24, paddingBottom:24 }}>
          Sri Venkateswara Swamy Temple of Colorado · RSVP Analytics Platform
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #faf5ff 0%, #f8fafc 50%, #f0f9ff 100%)',
    padding: '32px 24px',
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  container:   { maxWidth: 1100, margin: '0 auto' },
  pageHeader:  { marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid #e5e7eb' },
  breadcrumb:  { fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  eventTitle:  { fontSize: '2rem', fontWeight: '900', color: '#111827', marginBottom: 6, lineHeight: 1.2 },
  eventDate:   { fontSize: '0.92rem', color: '#6b7280' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  statCard:    { borderRadius: 16, padding: '24px 20px', textAlign: 'center', border: '1.5px solid', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' },
  chartsRow:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
  card:        { background: 'white', borderRadius: 16, padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  cardTitle:   { fontSize: '0.88rem', fontWeight: '700', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  btnOutline:  { padding: '10px 20px', background: 'white', border: '1.5px solid #e5e7eb', color: '#374151', borderRadius: 9, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' },
  btnPrimary:  { padding: '10px 20px', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', border: 'none', color: 'white', borderRadius: 9, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' },
  searchInput: { padding: '9px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', color: '#374151', borderRadius: 9, fontSize: '0.85rem', outline: 'none', minWidth: 220 },
};
