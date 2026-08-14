import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import NewsFeed from './components/NewsFeed';
import CalendarNavigation from './components/CalendarNavigation';
import CalendarGrid from './components/CalendarGrid';
import AdminDashboard from './AdminDashboard';
import EditEventModal from './components/EditEventModal';
import AddEventModal from './components/AddEventModal';
import FlyerEditor from './components/FlyerEditor';
import RSVPPage from './pages/RSVPPage';
import RSVPAdmin from './pages/RSVPAdmin';
import RSVPAnalyticsPage from './components/RSVPAnalyticsPage';
import BroadcastPage from './pages/BroadcastPage';
import PremiumLanding from './PremiumLanding';
import PremiumLogin from './PremiumLogin';
import PremiumSignup from './PremiumSignup';
import PremiumSettings from './PremiumSettings';
import { useTempleConfig } from './hooks/useTempleConfig';
import WelcomeModal from './components/WelcomeModal';
import AdminAssistant from './components/AdminAssistant';
import HelpPage from './components/HelpPage';
import PublicCalendar from './PublicCalendar';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import SyncChatbotModal from './SyncChatbotModal';

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function HamburgerIcon({ open }) {
  return open ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>

  );
}
function AdminCalendar() {
  const { isAuthenticated, logout } = useAuth();
  const { events, getEventsByMonth, addEvent, updateEvent, deleteEvent, importEvents, clearAll } = useEvents();
  const { config: templeConfig } = useTempleConfig();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showFlyerStudio, setShowFlyerStudio] = useState(false);
  const [showRSVPAnalytics, setShowRSVPAnalytics] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSyncChatbot, setShowSyncChatbot] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'success' | 'error'
  const [syncMessage, setSyncMessage] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [flyerEvent, setFlyerEvent] = useState(null);
  const [addEventDate, setAddEventDate] = useState(null);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!sessionStorage.getItem('welcome_dismissed'));
  const monthEvents = getEventsByMonth(currentDate.getFullYear(), currentDate.getMonth());

  const [adminModeVerified, setAdminModeVerified] = useState(sessionStorage.getItem('admin_mode') === 'true');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  function openModal(setter, hash) { setter(true); window.history.pushState({ modal: hash }, '', `#${hash}`); };
  function closeModal(setter) { setter(false); if (window.location.hash) window.history.back(); };
  const openFlyerForEvent = (ev)    => { setFlyerEvent(ev); window.history.pushState({modal:'flyer'},'','#flyer'); };
  const openEditEvent     = (ev)    => { setEditingEvent(ev); window.history.pushState({modal:'edit'},'','#edit-event'); };
  const openAddEventForDate = (dateStr) => { setAddEventDate(dateStr); openModal(setShowAddEvent, 'add-event'); };

  function handleAction(action) {
    setShowMobileMenu(false);
    switch (action) {
      case 'addEvent':   setAddEventDate(null); openModal(setShowAddEvent, 'add-event'); break;
      case 'broadcast':  openModal(setShowBroadcast, 'broadcast'); break;
      case 'flyer':      openModal(setShowFlyerStudio, 'flyer-studio'); break;
      case 'analytics':  openModal(setShowRSVPAnalytics, 'analytics'); break;
      case 'import':     setShowDashboard(true); break;
      case 'settings':   navigate('/settings'); break;
      case 'help':       setShowHelp(true); break;
      case 'syncChatbot': openModal(setShowSyncChatbot, 'sync-chatbot'); break;
      default: break;
    }
  };

  function dismissWelcome() { sessionStorage.setItem('welcome_dismissed','true'); setShowWelcome(false); };

  useEffect(() => {
    function onPop() { setShowBroadcast(false); setShowFlyerStudio(false); setShowRSVPAnalytics(false); setShowAddEvent(false); setEditingEvent(null); setFlyerEvent(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!adminModeVerified) {
    const handleAdminVerify = async (e) => {
      e.preventDefault();
      setAdminLoading(true); setAdminError('');
      try {
        const res = await fetch('/api/auth/verify-admin', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('cf_token')}`}, body:JSON.stringify({password:adminPassword}) });
        const data = await res.json();
        if (res.ok && data.verified) { sessionStorage.setItem('admin_mode','true'); setAdminModeVerified(true); }
        else { setAdminError('Incorrect password. Please try again.'); }
      } catch { setAdminError('Verification failed. Please try again.'); }
      finally { setAdminLoading(false); }
    };
    return (
      <div style={{ minHeight:'100vh', background:'var(--cf-bg-base)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',Georgia,serif", padding:16 }}>
        <div style={{ background:'var(--cf-bg-surface)', borderRadius:20, width:'100%', maxWidth:420, boxShadow:'0 24px 60px rgba(0,0,0,0.3)', overflow:'hidden', border:'1px solid var(--cf-border)' }}>
          <div style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🕉️</div>
            <h2 style={{ color:'white', fontWeight:900, fontSize:'1.3rem', margin:0 }}>Admin Verification</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', margin: '6px 0 0' }}>Enter your admin password to continue</p>
          </div>
          <form onSubmit={handleAdminVerify} style={{ padding: '28px 32px' }}>
            {adminError && <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, color:'#fca5a5', fontSize:'0.85rem' }}>{adminError}</div>}
            <label style={{ display:'block', color:'var(--cf-accent)', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Password</label>
            <div style={{ position:'relative', marginBottom:20 }}>
            <input
                type={showAdminPw ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
              placeholder="Enter admin password" autoFocus required
                style={{ width:'100%', padding:'12px 44px 12px 14px', background:'var(--cf-bg-surface)', border:'1.5px solid var(--cf-border)', borderRadius:10, color:'var(--cf-text-primary)', fontSize:'0.95rem', outline:'none', boxSizing:'border-box', fontFamily:"'Playfair Display',Georgia,serif" }}
                onFocus={e => e.target.style.borderColor='var(--cf-accent)'} onBlur={e => e.target.style.borderColor='var(--cf-border)'}
            />
              <button type="button" onClick={() => setShowAdminPw(v => !v)} tabIndex={-1}
                style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--cf-text-muted)', padding:0, display:'flex', alignItems:'center' }}>
                <EyeIcon open={showAdminPw} />
              </button>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <button type="button" onClick={() => navigate('/')} style={{ flex:1, padding:11, background:'transparent', border:'1px solid var(--cf-border)', color:'var(--cf-accent)', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:'0.9rem', fontFamily:"'Playfair Display',Georgia,serif" }}>Cancel</button>
              <button type="submit" disabled={adminLoading} style={{ flex:2, padding:11, background:adminLoading?'var(--cf-border)':'var(--cf-btn-bg)', border:'none', color:'white', borderRadius:10, cursor:adminLoading?'not-allowed':'pointer', fontWeight:800, fontSize:'0.95rem', fontFamily:"'Playfair Display',Georgia,serif" }}>
                {adminLoading ? 'Verifying…' : '🔐 Enter Admin'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const nb = (bc, bg) => ({ padding:'7px 12px', borderRadius:6, cursor:'pointer', fontSize:'0.78rem', fontWeight:700, display:'flex', alignItems:'center', gap:5, transition:'all 0.15s', fontFamily:"'Playfair Display',Georgia,serif", background:bg, border:`1px solid ${bc}`, color:'#f0e0b8', whiteSpace:'nowrap', letterSpacing:'0.02em' });
  const COMING_SOON_FEATURES = [
    { icon:'🎥', label:'Live Stream',          desc:'Broadcast pujas and events live to devotees who can\'t attend in person.' },
    { icon:'📸', label:'Live Photo Sharing',   desc:'Let devotees and volunteers share event photos to a shared live gallery in real time.' },
    { icon:'👥', label:'Community Followers',  desc:'Devotees can follow your temple to get updates, without needing WhatsApp or email.' },
    { icon:'🙋', label:'Volunteer Dashboard',  desc:'Coordinate seva sign-ups, shifts, and volunteer communication in one place.' },
  ];
  const mobileItems = [
    { label:'📊 Dashboard',    fn:() => { setShowDashboard(v=>!v); setShowMobileMenu(false); } },
    { label:'📢 Broadcast',    fn:() => handleAction('broadcast') },
    { label:'🪔 Flyer Studio', fn:() => handleAction('flyer') },
    { label:'📈 Analytics',    fn:() => handleAction('analytics') },
    { label:'⚙️ Settings',     fn:() => handleAction('settings') },
    { label:'❓ Help',         fn:() => handleAction('help') },
    { label:'🤖 Sync Chatbot',  fn:() => handleAction('syncChatbot') },
    ...COMING_SOON_FEATURES.map(f => ({
      label:`${f.icon} ${f.label} (Soon)`,
      fn:() => { setComingSoonFeature(f); setShowMobileMenu(false); },
    })),
    { label:'🌐 Public View',  fn:() => { window.open('/calendar','_blank','noopener'); setShowMobileMenu(false); } },
    { label:'+ Add Event',     fn:() => handleAction('addEvent'), accent:true },
    { label:'⎋ Logout',       fn:() => { logout(); setShowMobileMenu(false); }, danger:true },
  ];
  return (
    <div style={{ minHeight:'100vh', background:'var(--cf-bg-base)' }}>

      {/* TOOLBAR — fixed temple colors always */}
      <div className="cf-toolbar" style={{ height:58, background:'#231206', borderBottom:'1px solid #e8d5a3', display:'flex', alignItems:'center', padding:'0 16px', gap:8, flexShrink:0, position:'relative', zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:'linear-gradient(135deg,#9d6b2a,#6a3a10)', border:'1px solid #c9943a55', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🕉</div>
          <div>
            <div style={{ color:'#f0e8c8', fontSize:12, fontWeight:700, letterSpacing:'0.04em' }}>Temple Admin</div>
            <div style={{ color:'#7a5a30', fontSize:9, letterSpacing:'0.06em', textTransform:'uppercase' }}>CalendarFly</div>
          </div>
        </div>
        <div style={{ width:1, height:28, background:'#e8d5a3', margin:'0 4px', flexShrink:0 }} />
        <span style={{ color:'#e8c878', fontSize:'0.88rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:260 }}>{templeConfig.temple_name}</span>
        <div style={{ flex: 1 }} />

        <div className="cf-desktop-nav" style={{ display:'flex', gap:5, alignItems:'center' }}>
          <button onClick={()=>setShowDashboard(v=>!v)} style={nb('#ea580c', showDashboard?'linear-gradient(135deg,#ea580c,#c2410c)':'linear-gradient(135deg,#7c2d1299,#92400e88)')}>📊 Dashboard</button>

          <button onClick={()=>openModal(setShowBroadcast,'broadcast')} style={nb('#6366f1','linear-gradient(135deg,#4338ca88,#3730a388)')}>📢 Broadcast</button>
          <button onClick={()=>openModal(setShowFlyerStudio,'flyer-studio')} style={nb('#a855f7','linear-gradient(135deg,#6d28d988,#5b21b688)')}>🪔 Flyer</button>
          <button onClick={()=>openModal(setShowRSVPAnalytics,'analytics')} style={nb('#14b8a6','linear-gradient(135deg,#0f766e88,#0d948888)')}>📈 Analytics</button>
          <button onClick={()=>handleAction('syncChatbot')} style={nb('#c9943a','linear-gradient(135deg,#78350f88,#92400e88)')} title="Sync events to WhatsApp chatbot">🤖 Sync Chatbot</button>
          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowMoreMenu(v=>!v)} style={nb('#7c3aed', showMoreMenu ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#4c1d9588,#5b21b688)')}>🚀 More</button>
            {showMoreMenu && (
              <>
                <div onClick={()=>setShowMoreMenu(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:151, width:260, background:'var(--cf-bg-surface)', border:'1px solid var(--cf-border)', borderRadius:10, boxShadow:'0 12px 32px rgba(0,0,0,0.35)', overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px', fontSize:10, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--cf-text-muted)', borderBottom:`1px solid var(--cf-border)` }}>Coming Soon</div>
                  {COMING_SOON_FEATURES.map(f => (
                    <button key={f.label} onClick={()=>{ setComingSoonFeature(f); setShowMoreMenu(false); }}
                      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', background:'none', border:'none', borderBottom:`1px solid var(--cf-border)`, cursor:'pointer', textAlign:'left', fontFamily:"'Playfair Display',Georgia,serif" }}>
                      <span style={{ fontSize:16 }}>{f.icon}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--cf-text-primary)' }}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={()=>navigate('/settings')} style={nb('#7a5a30','linear-gradient(135deg,#37415188,#c9943a44)')}>⚙️</button>
          <button onClick={()=>setShowHelp(true)} style={nb('#f59e0b','linear-gradient(135deg,#92400e88,#78350f88)')}>❓ Help</button>
          <button onClick={()=>window.open('/calendar','_blank','noopener')} style={nb('#06b6d4','linear-gradient(135deg,#0e749088,#0891b288)')}>🌐</button>
          <div style={{ width:1, height:30, background:'var(--cf-border)', margin:'0 2px' }} />
          <button onClick={()=>{ setAddEventDate(null); openModal(setShowAddEvent,'add-event'); }} style={{ ...nb('#22c55e','linear-gradient(135deg,#16a34a,#15803d)'), fontWeight:900 }}>+ Add Event</button>
          <button onClick={logout} style={nb('#ef4444','linear-gradient(135deg,#9f121288,#7f1d1d88)')}>⎋</button>
        </div>

        <button className="cf-hamburger" onClick={()=>setShowMobileMenu(v=>!v)}
          style={{ display:'none', background:'none', border:'1px solid var(--cf-border)', borderRadius:6, color:'var(--cf-accent)', cursor:'pointer', padding:'5px 7px', alignItems:'center', justifyContent:'center' }}>
          <HamburgerIcon open={showMobileMenu} />
        </button>
      </div>

      {/* MOBILE MENU */}
      {showMobileMenu && (
        <div style={{ position:'fixed', top:58, left:0, right:0, zIndex:99, background:'var(--cf-bg-surface)', borderBottom:'1px solid var(--cf-border)', boxShadow:'0 8px 32px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', padding:12, gap:6 }}>
          {mobileItems.map((item,i) => (
            <button key={i} onClick={item.fn} style={{ padding:'11px 16px', borderRadius:8, border:'none', cursor:'pointer', background:item.accent?'linear-gradient(135deg,#16a34a,#15803d)':item.danger?'rgba(239,68,68,0.12)':'var(--cf-bg-deep)', color:item.accent?'#fff':item.danger?'#fca5a5':'var(--cf-text-primary)', fontFamily:"'Playfair Display',Georgia,serif", fontWeight:700, fontSize:'0.9rem', textAlign:'left' }}>
              {item.label}
        </button>

          ))}
      </div>
      )}
      {/* SUB-HEADER */}
      <div className="cf-subheader" style={{ background:'var(--cf-subheader-bg)', borderBottom:'1px solid var(--cf-border)', padding:'6px 16px', display:'flex', alignItems:'center', gap:20, fontSize:'0.8rem', flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ color:'var(--cf-text-secondary)', fontWeight:600, whiteSpace:'nowrap' }}>📍 <span style={{ color:'var(--cf-accent)' }}>{templeConfig.address}</span></span>
        <span style={{ color:'var(--cf-text-secondary)', fontWeight:600, whiteSpace:'nowrap' }}>📞 <span style={{ color:'var(--cf-accent)' }}>{templeConfig.phone}</span></span>
        <span style={{ marginLeft:'auto', color:'var(--cf-text-muted)', fontSize:'0.7rem', whiteSpace:'nowrap' }}>
          🌐 <code style={{ background:'var(--cf-bg-deep)', padding:'1px 7px', borderRadius:4, color:'var(--cf-text-secondary)', userSelect:'all' }}>{window.location.origin}/calendar</code>
        </span>
      </div>
      {/* BODY */}
      <div className="cf-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="cf-sidebar" style={{ width:260, background:'var(--cf-sidebar-bg)', borderRight:'1px solid var(--cf-border)', overflowY:'auto', flexShrink:0, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--cf-border)', background:'var(--cf-bg-surface)' }}>
            <div style={{ fontSize:'0.65rem', color:'var(--cf-text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:2 }}>Temple Updates</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:'var(--cf-accent)' }}>{currentDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}><NewsFeed events={monthEvents} currentDate={currentDate} /></div>
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {showDashboard && (
            <div style={{ background:'var(--cf-bg-surface)', borderBottom:'1px solid var(--cf-border)', padding:'14px 16px', flexShrink:0 }}>
          <AdminDashboard events={events} onBulkImport={importEvents} onClearAll={clearAll} onShowAddEvent={() => openModal(setShowAddEvent, 'add-event')} />
            </div>
        )}
          <div className="cf-calendar-padding" style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
            <div style={{ background:'var(--cf-bg-surface)', borderRadius:12, border:'1px solid var(--cf-border)', overflow:'hidden' }}>
              <div style={{ background:'var(--cf-bg-surface)', borderBottom:'1px solid var(--cf-border)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:'0.65rem', color:'var(--cf-text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Monthly Calendar</div>
                <div style={{ fontSize:'0.72rem', color:'var(--cf-text-muted)' }}>{monthEvents.filter(e=>e.type!=='panchang').length} events this month</div>
              </div>
              <div style={{ padding:'14px 16px', background:'var(--cf-bg-base)', position:'relative' }}>
                <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'80%', height:'120px', background:'radial-gradient(ellipse at 50% 0%, var(--cf-accent-glow) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
                <div style={{ position:'relative', zIndex:1 }}>
            <CalendarNavigation currentDate={currentDate} onMonthChange={setCurrentDate} />
                <CalendarGrid currentDate={currentDate} events={monthEvents} onEditEvent={openEditEvent} onDeleteEvent={(id)=>deleteEvent(id)} onCreateFlyer={openFlyerForEvent} onAddEvent={openAddEventForDate} isAdmin={true} />
                </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      {flyerEvent && <FlyerEditor event={flyerEvent} onClose={() => { setFlyerEvent(null); if (window.location.hash) window.history.back(); }} />}
      {showAddEvent && <AddEventModal defaultDate={addEventDate} onSave={(data) => { addEvent(data); setShowAddEvent(false); setAddEventDate(null); if (window.location.hash) window.history.back(); }} onClose={() => { setAddEventDate(null); closeModal(setShowAddEvent); }} />}
      {editingEvent && <EditEventModal event={editingEvent} onSave={(id, data) => { updateEvent(id, data); setEditingEvent(null); if (window.location.hash) window.history.back(); }} onClose={() => { setEditingEvent(null); if (window.location.hash) window.history.back(); }} />}
      {showBroadcast && <BroadcastPage onClose={() => closeModal(setShowBroadcast)} />}
      {showFlyerStudio && <FlyerEditor event={null} onClose={() => closeModal(setShowFlyerStudio)} />}
      {showRSVPAnalytics && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'stretch' }} onClick={() => closeModal(setShowRSVPAnalytics)}>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
            <RSVPAnalyticsPage events={events} onClose={() => closeModal(setShowRSVPAnalytics)} />
          </div>
        </div>
      )}

      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      {comingSoonFeature && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(3px)' }}
          onClick={() => setComingSoonFeature(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width:380, maxWidth:'100%', background:'var(--cf-bg-surface)', border:'1px solid var(--cf-border)',
            borderRadius:16, padding:'28px 24px', textAlign:'center', boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
            fontFamily:"'Playfair Display',Georgia,serif",
          }}>
            <div style={{
              width:64, height:64, borderRadius:'50%', margin:'0 auto 16px',
              background:'linear-gradient(135deg,#7c3aed,#4c1d95)', display:'flex',
              alignItems:'center', justifyContent:'center', fontSize:30,
            }}>{comingSoonFeature.icon}</div>
            <div style={{
              display:'inline-block', fontSize:10, fontWeight:800, letterSpacing:'0.1em',
              textTransform:'uppercase', color:'#fff', background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
              padding:'3px 10px', borderRadius:20, marginBottom:10,
            }}>Coming Soon</div>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--cf-text-primary)', marginBottom:8 }}>{comingSoonFeature.label}</div>
            <div style={{ fontSize:13, color:'var(--cf-text-muted)', lineHeight:1.6, marginBottom:22, fontFamily:"'DM Sans',sans-serif" }}>{comingSoonFeature.desc}</div>
            <button onClick={() => setComingSoonFeature(null)} style={{
              padding:'10px 24px', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff',
              fontWeight:700, fontSize:13, fontFamily:"'Playfair Display',Georgia,serif",
            }}>Got it</button>
          </div>
        </div>
      )}
      {showWelcome && <WelcomeModal onClose={dismissWelcome} onAction={(action)=>{dismissWelcome();handleAction(action);}} upcomingEvents={events} />}

      {showSyncChatbot && <SyncChatbotModal
        events={events}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        setSyncStatus={setSyncStatus}
        setSyncMessage={setSyncMessage}
        onClose={() => closeModal(setShowSyncChatbot)}
      />}
      <AdminAssistant events={events} onAction={handleAction} />
      <style>{`
        @keyframes cfShimmer { 0%,100%{opacity:0.3;transform:translateX(-120%)} 50%{opacity:1;transform:translateX(120%)} }
        @keyframes cfPulse   { 0%,100%{opacity:0.3} 50%{opacity:0.9} }
        @keyframes cfGlow    { 0%,100%{box-shadow:0 0 8px #c9943a20} 50%{box-shadow:0 0 24px #c9943a50} }
        * { box-sizing: border-box; }
        /* ── Tablet (max 900px) ── */
        @media(max-width:900px){
          .cf-desktop-nav{display:none !important;}
          .cf-hamburger{display:flex !important;}
          .cf-sidebar{display:none !important;}
          .cf-subheader { flex-direction: column !important; gap: 4px !important; padding: 6px 12px !important; }
          .cf-subheader-url { display: none !important; }
          .cf-body { flex-direction: column !important; }
          .cf-calendar-area { min-width: 0 !important; }
        }
        /* ── Phone (max 600px) ── */
        @media(max-width:600px){
          .cf-toolbar { height: auto !important; min-height: 52px; padding: 8px 12px !important; flex-wrap: wrap; gap: 6px; }
          .cf-toolbar-logo { flex-shrink: 0; }
          .cf-toolbar-title { font-size: 0.78rem !important; max-width: 140px !important; }
          .cf-subheader { display: none !important; }
          .cf-mobile-menu-btn { padding: 4px 6px !important; }
          .cf-calendar-padding { padding: 8px !important; }
          .cf-month-header { font-size: 1.1rem !important; }
          .pub-grid{grid-template-columns:1fr !important;}
          .cf-modal-inner { margin: 8px !important; border-radius: 12px !important; }
          .cf-broadcast-grid { grid-template-columns: 1fr !important; }
          .cf-stat-grid { grid-template-columns: 1fr 1fr !important; }
          .cf-analytics-body { grid-template-columns: 1fr !important; }
          .cf-analytics-sidebar { border-right: none !important; border-bottom: 1px solid var(--cf-border) !important; max-height: 220px !important; }
        }
        /* ── Mobile menu items ── */
        .cf-mobile-menu-item {
          padding: 12px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 700;
          font-size: 0.92rem;
          text-align: left;
          width: 100%;
          transition: background 0.15s;
        }
        /* ── Touch targets ── */
        @media(max-width:600px){
          button { min-height: 36px; }
          input, select, textarea { font-size: 16px !important; } /* prevents iOS zoom */
        }
        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--cf-border); border-radius: 4px; }
      `}</style>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PremiumLanding />} />
          <Route path="/login" element={<PremiumLogin />} />
          <Route path="/signup" element={<PremiumSignup />} />
          
          <Route path="/calendar" element={<PublicCalendar />} />
          <Route path="/public" element={<PublicCalendar />} />
          
          <Route path="/admin" element={<AdminCalendar />} />
          <Route path="/select-mode" element={<Navigate to="/admin" replace />} />
          <Route path="/settings" element={<PremiumSettings />} />
          <Route path="/analytics" element={<RSVPAdmin />} />
          <Route path="/rsvp/:eventId" element={<RSVPPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
