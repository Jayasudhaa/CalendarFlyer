import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import Header from './components/Header';
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

// PUBLIC CALENDAR - Shareable URL, no auth, no admin data exposed
function PublicCalendar() {
  const { events, getEventsByMonth } = useEvents();
  const { config: templeConfig } = useTempleConfig();
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthEvents = getEventsByMonth(currentDate.getFullYear(), currentDate.getMonth());
  return (
    <div style={{ 
      minHeight:"100vh", 
      background: 'linear-gradient(to bottom, #f5f1e8, #faf8f3)',
      fontFamily: 'Georgia, serif'
    }}>
      {/* Premium Header - Cream/Gold Theme */}
      <div style={{
        background: 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)',
        padding: '2rem 3rem',
        borderBottom: '4px solid #CD853F',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '3px solid #fff'
      }}>
            <span style={{ fontSize: '2rem' }}>🕉️</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#fff', marginBottom: '0.5rem', letterSpacing: '1px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            {templeConfig.temple_name.toUpperCase()}
          </h1>
          <div style={{ fontSize: '0.95rem', color: '#f5deb3', fontWeight: '500', display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <span>📍 {templeConfig.address}</span>
            <span>📞 {templeConfig.phone}</span>
            <span>👤 Manager: {templeConfig.manager_phone}</span>
          </div>
        </div>
      </div>
      {/* Main Calendar Content */}
      <div style={{ padding: '2rem', maxWidth: '100%', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          {/* LEFT SIDEBAR */}
          <div style={{ background: '#8B4513', borderRadius: '12px', padding: '1.5rem', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', height: 'fit-content', position: 'sticky', top: '2rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #CD853F, #D2691E)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>TEMPLE UPDATES</h3>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '0.5rem', color: '#FFD700' }}>
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
            </div>
              <NewsFeed events={monthEvents} currentDate={currentDate} />
            </div>
          {/* RIGHT - Calendar Grid */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '3px solid #CD853F', minHeight: '800px' }}>
              <CalendarNavigation currentDate={currentDate} onMonthChange={setCurrentDate} />
              <CalendarGrid 
                currentDate={currentDate} 
                events={monthEvents} 
                onEditEvent={null}
                onDeleteEvent={null}
                onCreateFlyer={null}
                isAdmin={false}
              />
            </div>
          </div>
        </div>

      {/* Footer */}
      <div style={{ background: '#8B4513', padding: '1.5rem', textAlign: 'center', color: '#f5deb3', fontSize: '0.9rem', marginTop: '3rem', borderTop: '4px solid #CD853F' }}>
        <p style={{ margin: 0 }}>🕉️ Sri Venkateswara Swamy Temple of Colorado • www.svtempleco.org • manager@svtempleco.org</p>
      </div>
    </div>
  );
}
// ADMIN CALENDAR - Dark Studio UI matching FlyerEditor/BroadcastPage
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
  const [editingEvent, setEditingEvent] = useState(null);
  const [flyerEvent, setFlyerEvent] = useState(null);

  const monthEvents = getEventsByMonth(currentDate.getFullYear(), currentDate.getMonth());

  const [adminModeVerified, setAdminModeVerified] = useState(
    sessionStorage.getItem('admin_mode') === 'true'
  );
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  // ── Back-button support ───────────────────────────────────────────────────
  const openModal = (setter, hash) => { setter(true); window.history.pushState({ modal: hash }, '', `#${hash}`); };
  const closeModal = (setter) => { setter(false); if (window.location.hash) window.history.back(); };
  const openFlyerForEvent = (event) => { setFlyerEvent(event); window.history.pushState({ modal: 'flyer' }, '', '#flyer'); };
  const openEditEvent = (event) => { setEditingEvent(event); window.history.pushState({ modal: 'edit' }, '', '#edit-event'); };

  useEffect(() => {
    const onPop = () => {
      setShowBroadcast(false); setShowFlyerStudio(false); setShowRSVPAnalytics(false);
      setShowAddEvent(false); setEditingEvent(null); setFlyerEvent(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // ── Inline admin password gate (replaces ModeSelection) ──────────────────
  if (!adminModeVerified) {
    const handleAdminVerify = async (e) => {
      e.preventDefault();
      setAdminLoading(true); setAdminError('');
      try {
        const res = await fetch('/api/auth/verify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
          body: JSON.stringify({ password: adminPassword }),
        });
        const data = await res.json();
        if (res.ok && data.verified) {
          sessionStorage.setItem('admin_mode', 'true');
          setAdminModeVerified(true);
        } else {
          setAdminError('Incorrect password. Please try again.');
        }
      } catch { setAdminError('Verification failed. Please try again.'); }
      finally { setAdminLoading(false); }
    };
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ background: '#1e293b', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden', border: '1px solid #334155' }}>
          <div style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)', padding: '28px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🕉️</div>
            <h2 style={{ color: 'white', fontWeight: '900', fontSize: '1.3rem', margin: 0 }}>Admin Verification</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', margin: '6px 0 0' }}>Enter your admin password to continue</p>
          </div>
          <form onSubmit={handleAdminVerify} style={{ padding: '28px 32px' }}>
            {adminError && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem' }}>
                {adminError}
              </div>
            )}
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
              placeholder="Enter admin password" autoFocus required
              style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1.5px solid #334155', borderRadius: 10, color: '#e2e8f0', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: 20, fontFamily: 'Georgia, serif' }}
              onFocus={e => e.target.style.borderColor = '#c2410c'}
              onBlur={e => e.target.style.borderColor = '#334155'}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => navigate('/')}
                style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 10, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', fontFamily: 'Georgia, serif' }}>
                Cancel
              </button>
              <button type="submit" disabled={adminLoading}
                style={{ flex: 2, padding: '11px', background: adminLoading ? '#334155' : 'linear-gradient(135deg,#c2410c,#7c2d12)', border: 'none', color: 'white', borderRadius: 10, cursor: adminLoading ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '0.95rem', fontFamily: 'Georgia, serif' }}>
                {adminLoading ? 'Verifying…' : '🔐 Enter Admin'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  const navBtnBase = {
    padding: '7px 14px', border: '1px solid #334155', borderRadius: 8,
    cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
    background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
    fontFamily: 'Georgia, serif',
  };
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif' }}>

      {/* ═══ TOP TOOLBAR ═══ */}
      <div style={{ height: 72, background: '#1e293b', borderBottom: '2px solid #334155', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 8, flexShrink: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
        {/* Brand */}
        <div style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)', borderRadius: 10, padding: '10px 18px', color: 'white', fontWeight: '900', fontSize: '1rem', letterSpacing: '0.04em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 12px rgba(194,65,12,0.6)' }}>
          🕉️ Temple Admin
        </div>
        {/* Temple Name — big & bright */}
        <span style={{ color: '#ffffff', fontSize: '1rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340, textShadow: '0 1px 4px rgba(0,0,0,0.4)', letterSpacing: '0.01em' }}>
          {templeConfig.temple_name}
        </span>
        <div style={{ flex: 1 }} />

        {/* Dashboard */}
        <button onClick={() => setShowDashboard(v => !v)} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: showDashboard ? 'linear-gradient(135deg,#ea580c,#c2410c)' : 'linear-gradient(135deg,#7c2d1299,#92400e88)',
          border: `2px solid ${showDashboard ? '#ea580c' : '#ea580c'}`,
          color: '#fff', boxShadow: showDashboard ? '0 4px 14px rgba(234,88,12,0.6)' : '0 2px 8px rgba(234,88,12,0.3)',
        }}>
          📊 Dashboard
        </button>
        {/* Broadcast */}
        <button onClick={() => openModal(setShowBroadcast, 'broadcast')} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#4338ca88,#3730a388)', border: '2px solid #6366f1', color: '#fff',
          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#4f46e5,#3730a3)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(79,70,229,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#4338ca88,#3730a388)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(99,102,241,0.4)'; }}>
          📢 Broadcast
        </button>
        {/* Flyer Studio */}
        <button onClick={() => openModal(setShowFlyerStudio, 'flyer-studio')} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#6d28d988,#5b21b688)', border: '2px solid #a855f7', color: '#fff',
          boxShadow: '0 2px 8px rgba(168,85,247,0.4)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#7c3aed,#6d28d9)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(124,58,237,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#6d28d988,#5b21b688)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(168,85,247,0.4)'; }}>
          🪔 Flyer Studio
        </button>
        {/* Analytics */}
        <button onClick={() => openModal(setShowRSVPAnalytics, 'analytics')} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#0f766e88,#0d948888)', border: '2px solid #14b8a6', color: '#fff',
          boxShadow: '0 2px 8px rgba(20,184,166,0.4)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#0d9488,#0f766e)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(13,148,136,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#0f766e88,#0d948888)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(20,184,166,0.4)'; }}>
          📈 Analytics
        </button>
        {/* Settings */}
        <button onClick={() => navigate('/settings')} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#37415188,#1e293b88)', border: '2px solid #64748b', color: '#fff',
          boxShadow: '0 2px 8px rgba(100,116,139,0.3)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#475569,#334155)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(71,85,105,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#37415188,#1e293b88)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(100,116,139,0.3)'; }}>
          ⚙️ Settings
        </button>

        {/* Public View */}
        <button onClick={() => window.open('/calendar', '_blank', 'noopener')} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#0e749088,#0891b288)', border: '2px solid #06b6d4', color: '#fff',
          boxShadow: '0 2px 8px rgba(6,182,212,0.4)',
        }}
        title={`Shareable public URL: ${window.location.origin}/calendar`}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#0891b2,#0e7490)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(8,145,178,0.6)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#0e749088,#0891b288)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(6,182,212,0.4)'; }}>
          🌐 Public View
        </button>
        <div style={{ width: 1, height: 38, background: '#475569', margin: '0 4px' }} />

        {/* Add Event */}
        <button onClick={() => openModal(setShowAddEvent, 'add-event')} style={{
          padding: '10px 20px', background: 'linear-gradient(135deg,#16a34a,#15803d)', border: '2px solid #22c55e',
          color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: '900', fontSize: '0.95rem',
          display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Georgia, serif',
          boxShadow: '0 4px 16px rgba(22,163,74,0.55)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#15803d,#166534)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(22,163,74,0.7)'; e.currentTarget.style.transform='translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#16a34a,#15803d)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(22,163,74,0.55)'; e.currentTarget.style.transform='translateY(0)'; }}>
          + Add Event
        </button>

        {/* Logout */}
        <button onClick={logout} style={{
          padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: '800',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', fontFamily: 'Georgia, serif',
          background: 'linear-gradient(135deg,#9f121288,#7f1d1d88)', border: '2px solid #ef4444', color: '#fff',
          boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg,#dc2626,#b91c1c)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(239,68,68,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#9f121288,#7f1d1d88)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(239,68,68,0.3)'; }}>
          ⎋ Logout
        </button>
      </div>
      {/* ═══ SUB-HEADER ═══ */}
      <div style={{ background: '#162032', borderBottom: '1px solid #1e293b', padding: '9px 24px', display: 'flex', alignItems: 'center', gap: 28, fontSize: '0.88rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#fb923c', fontWeight: '700', display: 'flex', alignItems: 'center', gap: 5 }}>
          📍 {templeConfig.address}
        </span>
        <span style={{ color: '#4ade80', fontWeight: '700', display: 'flex', alignItems: 'center', gap: 5 }}>
          📞 {templeConfig.phone}
        </span>
        <span style={{ color: '#60a5fa', fontWeight: '700', display: 'flex', alignItems: 'center', gap: 5 }}>
          👤 Manager: {templeConfig.manager_phone}
        </span>
        {/* Shareable URL hint */}
        <span style={{ marginLeft: 'auto', color: '#0e7490', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          🌐 Public URL: <code style={{ background: '#0f172a', padding: '2px 8px', borderRadius: 4, color: '#22d3ee', userSelect: 'all' }}>{window.location.origin}/calendar</code>
        </span>
      </div>
      {/* ═══ BODY ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT SIDEBAR */}
        <div style={{ width: 280, background: '#1e293b', borderRight: '1px solid #334155', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155', background: 'linear-gradient(135deg,#c2410c22,#7c2d1222)' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Temple Updates</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f97316' }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
              {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <NewsFeed events={monthEvents} currentDate={currentDate} />
          </div>
        </div>
        {/* MAIN CALENDAR AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {showDashboard && (
            <div style={{ background: '#162032', borderBottom: '1px solid #334155', padding: '16px 20px', flexShrink: 0 }}>
          <AdminDashboard events={events} onBulkImport={importEvents} onClearAll={clearAll} onShowAddEvent={() => openModal(setShowAddEvent, 'add-event')} />
            </div>
        )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
              <div style={{ background: '#162032', borderBottom: '1px solid #334155', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Monthly Calendar</div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''} this month</div>
              </div>
              <div style={{ padding: '16px 18px', background: '#ffffff' }}>
            <CalendarNavigation currentDate={currentDate} onMonthChange={setCurrentDate} />
            <CalendarGrid 
              currentDate={currentDate} 
              events={monthEvents} 
              onEditEvent={openEditEvent} 
              onDeleteEvent={(id) => deleteEvent(id)} 
              onCreateFlyer={openFlyerForEvent} 
              isAdmin={true} 
            />
          </div>
        </div>
      </div>
        </div>
      </div>
      {/* ═══ MODALS ═══ */}
      {flyerEvent && <FlyerEditor event={flyerEvent} onClose={() => { setFlyerEvent(null); if (window.location.hash) window.history.back(); }} />}
      {showAddEvent && <AddEventModal onSave={(data) => { addEvent(data); setShowAddEvent(false); if (window.location.hash) window.history.back(); }} onClose={() => closeModal(setShowAddEvent)} />}
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
          
          {/* PUBLIC CALENDAR — no auth required, shareable URL */}
          <Route path="/calendar" element={<PublicCalendar />} />
          <Route path="/public" element={<PublicCalendar />} />
          
          {/* ADMIN — requires auth + admin_mode session */}
          <Route path="/admin" element={<AdminCalendar />} />
          {/* Keep select-mode route so old bookmarks don't 404, redirect to admin */}
          <Route path="/select-mode" element={<Navigate to="/admin" replace />} />
          {/* Other routes */}
          <Route path="/settings" element={<PremiumSettings />} />
          <Route path="/analytics" element={<RSVPAdmin />} />
          <Route path="/rsvp/:eventId" element={<RSVPPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
