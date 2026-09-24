import React, { useState, useEffect } from 'react';
import { playSuccess } from './utils/sound';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useEvents } from './hooks/useEvents';
import CalendarNavigation from './components/CalendarNavigation';
import CalendarGrid, { EVENT_TYPE_LEGEND } from './components/CalendarGrid';
import CalendarDashboardHeader from './components/CalendarDashboardHeader';
import AdminDashboard from './AdminDashboard';
import EditEventModal from './components/EditEventModal';
import AddEventModal from './components/AddEventModal';
import FlyerEditor from './components/FlyerEditor';
import AdminToolbar from './components/AdminToolbar';
import RSVPPage from './pages/RSVPPage';
import RSVPAdmin from './pages/RSVPAdmin';
import PhotoSharePage from './pages/PhotoSharePage';
import PublicNav from './components/PublicNav';
import PublicAlbumPage from './pages/PublicAlbumPage';
import PublicRadarPage from './pages/PublicRadarPage';
import PhotoModerationPage from './pages/PhotoModerationPage';
import SignupPage from './pages/SignupPage';
import SignupsAdminPage from './pages/SignupsAdminPage';
import BroadcastPage from './pages/BroadcastPage';
import PremiumLanding from './PremiumLanding';
import PremiumLogin from './PremiumLogin';
import PremiumSignup from './PremiumSignup';
import VerifyEmailPage from './VerifyEmailPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import ResetPasswordPage from './ResetPasswordPage';
import PremiumSettings from './PremiumSettings';
import MyProfile from './MyProfile';
import OnboardingWizard from './OnboardingWizard';
import FeaturesPage from './FeaturesPage';
import PricingMarketingPage from './PricingMarketingPage';
import AboutPage from './AboutPage';
import ContactPage from './ContactPage';
import CareersPage from './CareersPage';
import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';
import SecurityPage from './SecurityPage';
import BlogPage from './BlogPage';
import BlogPostPage from './BlogPostPage';
import { useTempleConfig } from './hooks/useTempleConfig';

import WelcomeModal from './components/WelcomeModal';
import AdminAssistant from './components/AdminAssistant';
import HelpPage from './components/HelpPage';
import PublicCalendar from './PublicCalendar';
import WebChatWidget from './components/WebChatWidget';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import SyncChatbotModal from './SyncChatbotModal';
import AdminHome from './pages/AdminHome';
import MediaOverview from './pages/MediaOverview';
import CreateLivestream from './pages/CreateLivestream';
import CreatePhotoAlbum from './pages/CreatePhotoAlbum';
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
// Calendar, Announcements, Glimpses and Photos are now one merged page
// (PublicCalendar.jsx, sections #events/#announcements/#glimpses/#photos)
// instead of four separate routes. These three old routes stay alive as
// redirects rather than disappearing outright -- orgs may already have
// flyers, QR codes or WhatsApp messages pointing at /announcements, /live
// or /photos, and breaking those silently would be a much worse surprise
// than a redirect. /calendar and /public keep working exactly as before,
// no redirect needed, since that's the merged page's own address.
function RedirectToSection({ hash }) {
  const location = useLocation();
  return <Navigate to={{ pathname: '/calendar', search: location.search, hash }} replace />;
}

function AdminCalendar() {
  const { isAuthenticated, logout, user, organization, canManage } = useAuth();
  const { events, getEventsByMonth, addEvent, updateEvent, deleteEvent, importEvents, clearAll } = useEvents();
  const { config: templeConfig } = useTempleConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDashboard, setShowDashboard] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastPrefill, setBroadcastPrefill] = useState('');
  const [showFlyerStudio, setShowFlyerStudio] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSyncChatbot, setShowSyncChatbot] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'success' | 'error'
  const [syncMessage, setSyncMessage] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [flyerEvent, setFlyerEvent] = useState(null);
  const [addEventDate, setAddEventDate] = useState(null);

  // ── Calendar dashboard header: search / Month-List toggle / type filter ────
  const [calSearch, setCalSearch] = useState('');
  const [calView, setCalView] = useState('month'); // 'month' | 'list'
  const [calFilterTypes, setCalFilterTypes] = useState(() => new Set());
  const toggleFilterType = (key) => setCalFilterTypes(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const clearFilterTypes = () => setCalFilterTypes(new Set());

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [showWelcome, setShowWelcome] = useState(!sessionStorage.getItem('welcome_dismissed'));
  const monthEvents = getEventsByMonth(currentDate.getFullYear(), currentDate.getMonth());

  // Search + type-filter applied to the month's non-panchang events. Panchang
  // entries are always kept in the array passed to CalendarGrid, since its
  // Panchang tab reads from the same events list independently of search/filter.
  const calSearchLower = calSearch.trim().toLowerCase();
  const filteredMonthEvents = monthEvents.filter(e => {
    if (e.type === 'panchang') return true;
    if (calFilterTypes.size > 0 && !calFilterTypes.has(e.type)) return false;
    if (calSearchLower && !(e.title || '').toLowerCase().includes(calSearchLower)) return false;
    return true;
  });

  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
  const startOfWeek = new Date(todayMidnight); startOfWeek.setDate(todayMidnight.getDate() - todayMidnight.getDay());
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
  const startOfWeekStr = toDateStr(startOfWeek);
  const endOfWeekStr = toDateStr(endOfWeek);
  const eventsCount = monthEvents.filter(e => e.type !== 'panchang').length;
  const thisWeekCount = events.filter(e => e.type !== 'panchang' && e.date >= startOfWeekStr && e.date <= endOfWeekStr).length;
  // "RSVPs Open" is an approximation — count of upcoming events this month
  // (excl. panchang), not a live count of actual RSVP submissions, which
  // would need a per-event API call and is out of scope for this layout pass.
  const rsvpOpenCount = monthEvents.filter(e => e.type !== 'panchang' && e.date >= toDateStr(todayMidnight)).length;

  function openModal(setter, hash) { setter(true); window.history.pushState({ modal: hash }, '', `#${hash}`); };
  // Strips any modal hash from the URL directly instead of relying on
  // window.history.back() — back() only works if there's actually an
  // earlier "clean" /admin entry to pop to in THIS tab's session history.
  // When /admin#broadcast (etc.) is the first entry in the session (e.g.
  // straight after login, or a hard refresh while a hash was open),
  // back() has nowhere to go and is a silent no-op: the overlay closes
  // (state updates) but the address bar stays stuck on the old hash.
  // replaceState always works regardless of history depth.
  function clearModalHash() {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };
  function closeModal(setter) { setter(false); clearModalHash(); };
  const openFlyerForEvent = (ev)    => { setFlyerEvent(ev); window.history.pushState({modal:'flyer'},'','#flyer'); };
  const openEditEvent     = (ev)    => { setEditingEvent(ev); window.history.pushState({modal:'edit'},'','#edit-event'); };
  const openAddEventForDate = (dateStr) => { setAddEventDate(dateStr); openModal(setShowAddEvent, 'add-event'); };

  function handleAction(action) {
    switch (action) {
      case 'addEvent':   setAddEventDate(null); openModal(setShowAddEvent, 'add-event'); break;
      case 'broadcast':  openModal(setShowBroadcast, 'broadcast'); break;
      case 'flyer':      openModal(setShowFlyerStudio, 'flyer-studio'); break;
      case 'analytics':  navigate('/analytics'); break;
      case 'import':     setShowDashboard(true); break;
      case 'settings':   navigate('/settings'); break;
      case 'connectSocial': navigate('/settings?tab=social'); break;
      case 'help':       setShowHelp(true); break;
      case 'syncChatbot': openModal(setShowSyncChatbot, 'sync-chatbot'); break;
      default: break;
    }
  };

  function dismissWelcome() { sessionStorage.setItem('welcome_dismissed','true'); setShowWelcome(false); };

  // The Dashboard nav button used to just toggle showDashboard, which lives
  // "underneath" full-screen overlays like Broadcast/Flyer Studio/Analytics
  // (those render on top with their own z-index). If one of those was open,
  // clicking Dashboard silently changed state you couldn't see — the overlay
  // was still covering the screen. Now it also closes whichever overlay is
  // open first, so Dashboard always actually becomes visible.
  function goToDashboard() {
    setShowBroadcast(false);
    setShowFlyerStudio(false);
    setShowDashboard(v => !v);
    clearModalHash();
  }

  useEffect(() => {
    function onPop() { setShowBroadcast(false); setShowFlyerStudio(false); setShowAddEvent(false); setEditingEvent(null); setFlyerEvent(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // AdminToolbar on other pages (Profile/Settings/Subscription/Analytics/
  // Flyer Studio) can't open Broadcast/Flyer/Sync Chatbot/Add Event/Help
  // directly — those only exist as overlays here. It instead navigates to
  // /admin with a pendingAction, which we pick up and open once mounted.
  useEffect(() => {
    const pendingAction = location.state?.pendingAction;
    if (pendingAction) {
      if (pendingAction === 'broadcast' && location.state?.broadcastCaption) {
        setBroadcastPrefill(location.state.broadcastCaption);
      }
      handleAction(pendingAction);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
  // Admin verification gate removed — logging in is sufficient on its own.
  // (It used to ask for the same password a second time here, which was
  // redundant since it checked against the exact same account password.)
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div style={{ minHeight:'100vh', background:'var(--cf-bg-base)' }}>

      <AdminToolbar
        activePage={showDashboard ? 'dashboard' : undefined}
        onDashboard={goToDashboard}
        onBroadcast={()=>openModal(setShowBroadcast,'broadcast')}
        onFlyer={()=>openModal(setShowFlyerStudio,'flyer-studio')}
        onSyncChatbot={()=>handleAction('syncChatbot')}
        onHelp={()=>setShowHelp(true)}
      />
      {/* BODY */}
      {/* "Temple Updates" sidebar (NewsFeed) intentionally removed from the
          admin dashboard — it only ever showed hardcoded sample festival
          content, not this org's real events. The org-specific, dynamic
          version of this panel lives on the public calendar page instead
          (PublicCalendar.jsx's NewsFeedPanel, fed by /api/announcements). */}
      <div className="cf-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {showDashboard && (
            <div style={{ background:'var(--cf-bg-surface)', borderBottom:'1px solid var(--cf-border)', padding:'14px 16px', flexShrink:0 }}>
          <AdminDashboard events={events} onBulkImport={importEvents} onClearAll={clearAll} onShowAddEvent={() => openModal(setShowAddEvent, 'add-event')} />
            </div>
        )}
          <div className="cf-calendar-padding" style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
            <div style={{ background:'var(--cf-bg-surface)', borderRadius:12, border:'1px solid var(--cf-border)', overflow:'hidden', boxShadow:'0 8px 30px rgba(0,0,0,0.08)' }}>
              <CalendarDashboardHeader
                eventsCount={eventsCount}
                thisWeekCount={thisWeekCount}
                rsvpOpenCount={rsvpOpenCount}
                search={calSearch}
                onSearchChange={setCalSearch}
                calView={calView}
                onCalViewChange={setCalView}
                allTypes={EVENT_TYPE_LEGEND}
                filterTypes={calFilterTypes}
                onToggleFilterType={toggleFilterType}
                onClearFilterTypes={clearFilterTypes}
              />
              <div style={{ padding:'0 16px 14px', background:'var(--cf-bg-base)', position:'relative' }}>
                {/* Was a warm gold radial "halo glow" wash behind the whole
                    calendar (var(--cf-accent-glow) x3) — removed now that
                    the site moved to pure-white pages; it read as leftover
                    cream tint against the new jet-black header/white theme.
                    See CalendarGrid.jsx's CalendarCell for the matching
                    per-cell tint that was also removed. */}
                <div style={{ position:'relative', zIndex:1 }}>
            <CalendarNavigation currentDate={currentDate} onMonthChange={setCurrentDate} legend={templeConfig.category === 'temple' ? EVENT_TYPE_LEGEND : []} onAddEvent={()=>{ setAddEventDate(null); openModal(setShowAddEvent,'add-event'); }} />
                <CalendarGrid currentDate={currentDate} events={filteredMonthEvents} onEditEvent={openEditEvent} onDeleteEvent={async (id)=>{ const r = await deleteEvent(id); if (!r.success) alert(r.error || 'Failed to delete event. Please try again.'); }} onCreateFlyer={openFlyerForEvent} onAddEvent={openAddEventForDate} isAdmin={canManage} orgCategory={templeConfig.category} listView={calView === 'list'} />
                </div>
          </div>
        </div>
      </div>
        </div>
      </div>

      {flyerEvent && <FlyerEditor event={flyerEvent} onClose={() => { setFlyerEvent(null); clearModalHash(); }} />}
      {showAddEvent && <AddEventModal defaultDate={addEventDate} onSave={async (data) => {
        const result = await addEvent(data);
        if (result.success) {
          setShowAddEvent(false); setAddEventDate(null);
          clearModalHash();
          if (result.duplicate) {
            alert(`"${data.title}" is already on the calendar for ${data.date} — it was not added again.`);
          } else {
            playSuccess();
          }
        } else {
          alert(result.error || 'Failed to save event. Please try again.');
        }
      }} onClose={() => { setAddEventDate(null); closeModal(setShowAddEvent); }} />}
      {editingEvent && <EditEventModal event={editingEvent} onSave={async (id, data) => {
        const result = await updateEvent(id, data);
        if (result.success) {
          setEditingEvent(null);
          clearModalHash();
        } else {
          alert(result.error || 'Failed to save changes. Please try again.');
        }
      }} onClose={() => { setEditingEvent(null); clearModalHash(); }} />}
      {showBroadcast && <BroadcastPage initialCaption={broadcastPrefill} onClose={() => { closeModal(setShowBroadcast); setBroadcastPrefill(''); }} />}
      {showFlyerStudio && <FlyerEditor event={null} onClose={() => closeModal(setShowFlyerStudio)} />}
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
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
    </div>
  );
}


// The Temple Assistant (WebChatWidget) used to be wired directly into
// PublicCalendar.jsx alone, so a visitor only ever saw it on /calendar or
// /public — landing straight on a shared RSVP/photo-album/sign-up link
// (the far more common path for a real visitor, since those get shared
// directly via broadcasts/flyers) never showed it at all. Mounting it once
// here, above a shared <Outlet/>, puts it on every visitor-facing page for
// a given org and — since this layout itself doesn't unmount between those
// routes — keeps one running conversation as they navigate between them.
// Deliberately NOT wrapped around the CalendarFly marketing site (/, /features,
// /pricing, etc.) or the admin dashboard: this bot is themed and scoped to
// one organization's own visitors, not prospective SaaS customers or the
// org's own staff (who already have AdminAssistant in the dashboard).
function PublicOrgLayout() {
  const { config: templeConfig } = useTempleConfig();
  const { events } = useEvents();
  return (
    <>
      <PublicNav />
      <Outlet />
      <WebChatWidget events={events} organization={templeConfig} />
    </>
  );
}

// AdminAssistant used to render only inside AdminCalendar (the /admin route),
// despite its own file header claiming it's already on "all admin pages" —
// every other admin-side route (Profile/Settings/Analytics/Photo Moderation/
// Sign-Ups Admin) showed no assistant bubble at all. Those pages already
// solve this exact problem for AdminToolbar's Broadcast/Flyer/Sync Chatbot/
// Help buttons (see AdminToolbar.jsx and the pendingAction comment above):
// they can't open those overlays directly since the overlays only exist
// inside AdminCalendar, so they hand off by navigating to /admin with
// `location.state.pendingAction`, which AdminCalendar picks up once mounted.
// This layout wires AdminAssistant's onAction into that same handoff for
// those pages — 'analytics'/'settings' are real routes so it navigates there
// directly, and everything else (addEvent/broadcast/flyer/syncChatbot/help)
// goes through pendingAction exactly like AdminToolbar already does from
// these pages. Deliberately NOT wrapped around /admin itself (AdminCalendar
// already mounts its own AdminAssistant there, wired directly to its local
// handleAction — adding this layout too would show two bubbles) or
// /onboarding (a first-run flow that doesn't carry AdminToolbar either, so
// it's not part of the established "admin pages" set).
function AdminLayout() {
  const { events } = useEvents();
  const navigate = useNavigate();
  function handleAction(action) {
    switch (action) {
      case 'analytics':     navigate('/analytics'); break;
      case 'settings':      navigate('/settings'); break;
      case 'connectSocial': navigate('/settings?tab=social'); break;
      default:              navigate('/admin', { state: { pendingAction: action } }); break;
    }
  }
  return (
    <>
      <Outlet />
      <AdminAssistant events={events} onAction={handleAction} />
    </>
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Visitor-facing org pages — share the Temple Assistant widget
              via PublicOrgLayout, see comment above. */}
          <Route element={<PublicOrgLayout />}>
            <Route path="/calendar" element={<PublicCalendar />} />
            <Route path="/public" element={<PublicCalendar />} />
            <Route path="/live" element={<RedirectToSection hash="glimpses" />} />
            <Route path="/photos" element={<RedirectToSection hash="photos" />} />
            <Route path="/photos/album/:albumId" element={<PublicAlbumPage />} />
            <Route path="/explore" element={<PublicRadarPage />} />
            <Route path="/announcements" element={<RedirectToSection hash="announcements" />} />
            <Route path="/rsvp/:eventId" element={<RSVPPage />} />
            <Route path="/photos/:eventId" element={<PhotoSharePage />} />
            <Route path="/signups/:eventId" element={<SignupPage />} />
          </Route>

          <Route path="/admin" element={<AdminCalendar />} />
          <Route path="/onboarding" element={<OnboardingWizard />} />

          {/* Other admin-dashboard pages — share the AdminAssistant widget
              via AdminLayout, see comment above. */}
          <Route element={<AdminLayout />}>
            <Route path="/settings" element={<PremiumSettings />} />
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/analytics" element={<RSVPAdmin />} />
            <Route path="/dashboard" element={<AdminHome />} />
            <Route path="/photos-admin" element={<PhotoModerationPage />} />
            <Route path="/media" element={<MediaOverview />} />
            <Route path="/media/livestreams/new" element={<CreateLivestream />} />
            <Route path="/media/livestreams/:id" element={<CreateLivestream />} />
            <Route path="/media/albums/new" element={<CreatePhotoAlbum />} />
            <Route path="/media/albums/:id" element={<CreatePhotoAlbum />} />
            <Route path="/signups-admin" element={<SignupsAdminPage />} />
          </Route>

          {/* Subscription moved into My Profile as a tab (see MyProfile.jsx) —
              this keeps old /subscription links/bookmarks working. */}
          <Route path="/subscription" element={<Navigate to="/profile?tab=subscription" replace />} />
          {/* Platform overview moved into My Profile as a tab (see MyProfile.jsx) —
              this keeps old /platform links/bookmarks working. */}
          <Route path="/platform" element={<Navigate to="/profile?tab=platform" replace />} />
          {/* Team management moved into My Profile as a tab (see MyProfile.jsx) —
              this keeps old /team links/bookmarks working. */}
          <Route path="/team" element={<Navigate to="/profile?tab=team" replace />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/pricing" element={<PricingMarketingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/security" element={<SecurityPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
