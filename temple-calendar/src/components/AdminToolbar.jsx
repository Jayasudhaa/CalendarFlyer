/**
 * src/components/AdminToolbar.jsx
 * The persistent dark app toolbar (logo, org name, nav buttons, account
 * menu) — extracted from App.jsx's AdminCalendar so it can be rendered on
 * every admin-area page, not just /admin itself.
 *
 * Self-contained: pulls user/org/temple info from useAuth()/useTempleConfig()
 * itself, so pages only need to render <AdminToolbar activePage="..." /> with
 * no prop drilling required.
 *
 * Nav buttons that open something that only exists inside AdminCalendar's
 * own overlay system (Broadcast, Flyer Studio, Sync Chatbot, Add Event,
 * Help) default to navigating to /admin with `location.state.pendingAction`
 * set; AdminCalendar picks that up on mount and opens the right overlay.
 * AdminCalendar itself passes explicit on* props instead, so clicking those
 * buttons there opens the overlay directly without a route change.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTempleConfig } from '../hooks/useTempleConfig';
import { playClick } from '../utils/sound';
import { Calendar, Megaphone, Image, TrendingUp, Bot, Users, Settings, HelpCircle, Globe, LogOut, User, CreditCard, ChevronDown, Timer, Video } from 'lucide-react';

// "Xh Ym left" / "Xm left" for the sandbox banner below — recomputed every
// 30s from organization.sandbox_expires_at (a plain timestamp, see
// organizations.js's createOrganization) so the banner counts down live
// instead of showing a stale value from when the page loaded. Once it
// reaches zero the org's JWT has already expired server-side (same 48h
// window — see routes/auth.js's POST /guest-sandbox), so this is display
// only, never what actually cuts off access.
function useCountdown(expiresAt) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) { setLabel(''); return; }
    const tick = () => {
      const msLeft = expiresAt - Date.now();
      if (msLeft <= 0) { setLabel('expired'); return; }
      const h = Math.floor(msLeft / 3600000);
      const m = Math.floor((msLeft % 3600000) / 60000);
      setLabel(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

// Page-specific "what to try here" guidance for the sandbox banner below —
// keyed by the same `activePage` string every page already passes to this
// component (see the usage table: 'dashboard' (App.jsx), 'flyer'/'broadcast'
// (BroadcastPage.jsx / Flyer Studio overlay), 'signups' (SignupsAdminPage),
// 'analytics' (RSVPAdmin), 'photos' (PhotoModerationPage), 'settings'
// (PremiumSettings), 'profile' (MyProfile), 'subscription' (SubscriptionPage)
// ). A guest can jump around in any order, so these are framed as
// independent numbered steps of one suggested tour rather than tracked
// progress — nothing here checks whether an earlier step actually happened.
const SANDBOX_STEP_TIPS = {
  dashboard: 'Step 1 — add your own event, or open a sample one to edit it.',
  flyer: 'Step 2 — pick an event and generate a flyer with the Flyer Studio.',
  broadcast: "Step 3 — draft an announcement. Sending is disabled here since no real social account is connected.",
  signups: 'Step 4 — connect a Google Form or upload a document to your library.',
  analytics: 'Step 5 — RSVP and attendance stats will show up here as people respond.',
  settings: "Step 6 — customize your org's name, colors, and logo.",
  profile: 'Bonus — invite a teammate, or check the Platform tab (both live here now).',
  photos: 'Photos flagged for review during upload would land here.',
  subscription: 'This shows your sandbox plan — no real billing happens here.',
};
const SANDBOX_DEFAULT_TIP = 'Look around — everything here is sample data, free to break.';

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

export default function AdminToolbar({
  activePage,          // 'dashboard' | 'analytics' | undefined — highlights the matching nav button
  showSubheader = true,
  onDashboard,
  onBroadcast,
  onFlyer,
  onSyncChatbot,
  onHelp,
}) {
  // canManage is false for a Viewer — Owner/Admin/Viewer roles (see
  // AuthContext.jsx). Broadcast/Flyer/Settings are write-only areas, so
  // Viewers don't see nav entries for them (the underlying API routes also
  // enforce this server-side, independent of what the UI shows). Team
  // management moved into My Profile as a tab (see MyProfile.jsx) instead
  // of being its own nav destination — /team now just redirects to
  // /profile?tab=team (see App.jsx) for old links/bookmarks.
  const { logout, user, organization, canManage, isOwner } = useAuth();
  const { config: templeConfig } = useTempleConfig();
  const navigate = useNavigate();

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const sandboxCountdown = useCountdown(organization?.is_sandbox ? organization.sandbox_expires_at : null);

  // Defaults for pages that aren't AdminCalendar: hop to /admin and let it
  // open the right overlay once it's mounted (see App.jsx's pendingAction
  // effect). AdminCalendar overrides these with direct local handlers.
  const goDashboard   = onDashboard   || (() => navigate('/admin'));
  const goBroadcast   = onBroadcast   || (() => navigate('/admin', { state: { pendingAction: 'broadcast' } }));
  const goFlyer       = onFlyer       || (() => navigate('/admin', { state: { pendingAction: 'flyer' } }));
  const goSyncChatbot = onSyncChatbot || (() => navigate('/admin', { state: { pendingAction: 'syncChatbot' } }));
  const goHelp        = onHelp        || (() => navigate('/admin', { state: { pendingAction: 'help' } }));

  // "Public Calendar" (renamed from "View Site") used to open bare
  // '/calendar' -- the admin dashboard is always on the bare domain (staff
  // log in with email/password, not via a per-org subdomain), so that
  // resolved NO organization at all and 404'd (same bug just fixed in
  // utils/rsvpUrl.js's share links; see "[TENANT] No organization found
  // for this domain" in production logs). ?org= is the same override every
  // public page already reads.
  const viewSiteUrl = organization?.subdomain
    ? `/calendar?org=${encodeURIComponent(organization.subdomain)}`
    : '/calendar';

  // Small uppercase group headers inside the account menu (Account / Tools)
  // — lets the same six items scan as two groups instead of one flat list.
  const sectionLabelStyle = {
    padding: '6px 14px 2px', fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  };

  const mobileItems = [
    { label:'📅 Calendar',     fn:() => { goDashboard(); setShowMobileMenu(false); } },
    ...(canManage ? [{ label:'🪔 Flyer Studio', fn:() => { goFlyer(); setShowMobileMenu(false); } }] : []),
    ...(canManage ? [{ label:'📢 Announce',    fn:() => { goBroadcast(); setShowMobileMenu(false); } }] : []),
    ...(canManage ? [{ label:'🎥 Media',       fn:() => { navigate('/media'); setShowMobileMenu(false); } }] : []),
    { label:'📈 Analytics',    fn:() => { navigate('/analytics'); setShowMobileMenu(false); } },
    { label:'👥 Connect',      fn:() => { navigate('/signups-admin'); setShowMobileMenu(false); } },
    ...(canManage ? [{ label:'⚙️ Settings',     fn:() => { navigate('/settings'); setShowMobileMenu(false); } }] : []),
    { label:'🌐 Public Calendar', fn:() => { window.open(viewSiteUrl,'_blank','noopener'); setShowMobileMenu(false); } },
    { label:'⎋ Logout',       fn:() => { logout(); setShowMobileMenu(false); }, danger:true },
  ];

  return (
    <>
      {/* TOOLBAR — jet black + glossy highlight (was a dark-brown/gold
          temple gradient; site moved to a jet-black header over white pages
          — see the --cf-* vars in index.css for the page-background half of
          that change). The org/temple name below keeps its gold accent
          on purpose — everything else here is monochrome white/gray. */}
      <div className="cf-toolbar" style={{
        height:58,
        background:'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 45%), linear-gradient(180deg, #0a0a0a 0%, #000000 100%)',
        borderBottom:'1px solid rgba(255,255,255,0.10)',
        boxShadow:'inset 0 -12px 18px -14px rgba(0,0,0,0.6), 0 4px 16px -6px rgba(0,0,0,0.5)',
        display:'flex', alignItems:'center', padding:'0 18px', gap:8, flexShrink:0, position:'relative', zIndex:100,
      }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 55% 160% at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 65%), radial-gradient(ellipse 45% 160% at 82% 50%, rgba(255,255,255,0.04) 0%, transparent 65%), linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 16%, transparent 84%, rgba(0,0,0,0.5) 100%)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, position:'relative', zIndex:1 }}>
          <img src="/calendarfly-icon.png" alt="CalendarFly" style={{ width:34, height:34, borderRadius:9, boxShadow:'0 0 0 3px rgba(255,255,255,0.08), 0 2px 10px rgba(0,0,0,0.5)', objectFit:'cover' }} />
          <div>
            <div style={{ color:'#ffffff', fontSize:17, fontWeight:800, letterSpacing:'0.03em', textShadow:'0 1px 0 rgba(255,255,255,0.14), 0 1px 3px rgba(0,0,0,0.5)' }}>Admin Dashboard</div>
            <div style={{ color:'#b0aeab', fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', fontFamily:"'Playfair Display', Georgia, serif", fontWeight:700 }}>CalendarFly</div>
          </div>
        </div>
        <div style={{ width:1, height:28, background:'rgba(255,255,255,0.16)', margin:'0 4px', flexShrink:0 }} />
        <span className="cf-org-name" style={{ color:'#e8c878', fontSize:'1.2rem', fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0, minWidth:60, maxWidth:260, textShadow:'0 1px 3px rgba(0,0,0,0.4)' }}>{templeConfig.temple_name}</span>
        <div style={{ flex: 1 }} />

        <div className="cf-desktop-nav" style={{ display:'flex', gap:3, alignItems:'center' }}>
          <button onClick={()=>{ playClick(); goDashboard(); }} className={`cf-nav-btn${activePage === 'dashboard' ? ' cf-nav-active' : ''}`}><Calendar size={16} /><span className="cf-nav-btn-text">Calendar</span></button>

          {canManage && (
            <button onClick={()=>{ playClick(); goFlyer(); }} className={`cf-nav-btn${activePage === 'flyer' ? ' cf-nav-active' : ''}`} title="Flyer"><Image size={16} /><span className="cf-nav-btn-text">Flyer</span></button>
          )}
          {canManage && (
            <button onClick={()=>{ playClick(); goBroadcast(); }} className="cf-nav-btn" title="Announce"><Megaphone size={16} /><span className="cf-nav-btn-text">Announce</span></button>
          )}
          {canManage && (
            <button onClick={()=>{ playClick(); navigate('/media'); }} className={`cf-nav-btn${activePage === 'media' ? ' cf-nav-active' : ''}`} title="Media — livestreams and photo albums"><Video size={16} /><span className="cf-nav-btn-text">Media</span></button>
          )}
          <button onClick={()=>{ playClick(); navigate('/analytics'); }} className={`cf-nav-btn${activePage === 'analytics' ? ' cf-nav-active' : ''}`} title="Analytics"><TrendingUp size={16} /><span className="cf-nav-btn-text">Analytics</span></button>
          <button onClick={()=>{ playClick(); navigate('/signups-admin'); }} className={`cf-nav-btn${activePage === 'signups' ? ' cf-nav-active' : ''}`} title="Connect — Google Forms, Drive files, and documents" style={{ color: '#ffffff' }}><Users size={16} color="#ffffff" /><span className="cf-nav-btn-text" style={{ color: '#ffffff' }}>Connect</span></button>

          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowAccountMenu(v=>!v)} className={`cf-acct-btn${showAccountMenu ? ' cf-nav-active' : ''}`}>
              <span className="cf-acct-avatar">{(organization?.name || templeConfig.temple_name || 'A').trim().charAt(0).toUpperCase()}</span>
              <span className="cf-acct-btn-label">
                <span className="cf-acct-btn-name">{organization?.name || templeConfig.temple_name || 'Account'}</span>
              </span>
              <ChevronDown size={13} className="cf-acct-chevron" style={{ transform: showAccountMenu ? 'rotate(180deg)' : 'none', transition:'transform 0.15s ease' }} />
            </button>
            {showAccountMenu && (
              <>
                <div onClick={()=>setShowAccountMenu(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                <div className="cf-acct-menu">
                  <div className="cf-acct-menu-header">
                    <div className="org">{organization?.name || templeConfig.temple_name || 'Account'}</div>
                    <div className="email">{user?.email || ''}{user?.email ? ' · ' : ''}{organization?.plan ? organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1) : 'Free'} plan</div>
                  </div>
                  <div className="cf-acct-menu-group">
                    <button className="cf-acct-menu-item" onClick={()=>{ setShowAccountMenu(false); window.open(viewSiteUrl,'_blank','noopener'); }}>
                      <Globe size={16} className="ic" /> Public Calendar
                    </button>
                  </div>

                  <div className="cf-acct-menu-divider" />

                  {/* Grouped under small section labels so the menu scans
                      faster without dropping any item — same six actions as
                      before, just organized instead of one flat list. */}
                  <div className="cf-acct-menu-group">
                    <div style={sectionLabelStyle}>Account</div>
                    {/* Platform (org/user stats, gated server-side by
                        superAdminGuard — see App.jsx's /platform redirect)
                        and Subscription (billing/plan management, see
                        App.jsx's /subscription redirect) moved into My
                        Profile as tabs, same as Team — so "My Profile"
                        below is the one entry point for all of it. */}
                    <button className="cf-acct-menu-item" onClick={()=>{ setShowAccountMenu(false); navigate('/profile'); }}>
                      <User size={16} className="ic" /> My Profile
                    </button>
                  </div>

                  {canManage && (
                    <>
                      <div className="cf-acct-menu-divider" />
                      <div className="cf-acct-menu-group">
                        <div style={sectionLabelStyle}>Tools</div>
                        <button className="cf-acct-menu-item" onClick={()=>{ setShowAccountMenu(false); navigate('/settings'); }}>
                          <Settings size={16} className="ic" /> Settings
                        </button>
                      </div>
                    </>
                  )}

                  <div className="cf-acct-menu-divider" />
                  <div className="cf-acct-menu-group">
                    <button className="cf-acct-menu-item cf-acct-danger" onClick={()=>{ setShowAccountMenu(false); logout(); }}>
                      <LogOut size={16} className="ic" /> Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <button className="cf-hamburger" onClick={()=>setShowMobileMenu(v=>!v)}
          style={{ display:'none', background:'none', border:'1px solid var(--cf-border)', borderRadius:6, color:'var(--cf-accent)', cursor:'pointer', padding:'5px 7px', alignItems:'center', justifyContent:'center' }}>
          <HamburgerIcon open={showMobileMenu} />
        </button>
      </div>

      {/* SANDBOX BANNER — only for the self-serve "Try it free" guest
          sandbox (POST /api/auth/guest-sandbox), never a real org. Reminds
          a guest their work here isn't permanent before they invest time in
          it, and that the org (and this countdown) is what expires — not
          any password or shared login. */}
      {organization?.is_sandbox && (
        <div style={{
          background:'#1a1500', borderBottom:'1px solid rgba(232,200,120,0.35)',
          padding:'7px 18px', display:'flex', alignItems:'center', justifyContent:'center',
          gap:8, flexShrink:0, flexWrap:'wrap', fontSize:'0.8rem', fontWeight:600, color:'#e8c878', textAlign:'center',
        }}>
          <Timer size={14} style={{ flexShrink:0 }} />
          <span>Free sandbox — {sandboxCountdown || 'calculating…'} left.</span>
          <span style={{ color:'rgba(232,200,120,0.65)', fontWeight:500 }}>
            {SANDBOX_STEP_TIPS[activePage] || SANDBOX_DEFAULT_TIP}
          </span>
        </div>
      )}

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
      {showSubheader && (
        <div className="cf-subheader" style={{ background:'var(--cf-subheader-bg)', borderBottom:'1px solid var(--cf-border)', padding:'6px 16px', display:'flex', alignItems:'center', gap:20, fontSize:'0.8rem', flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ color:'var(--cf-text-secondary)', fontWeight:600, whiteSpace:'nowrap' }}>📍 <span style={{ color:'var(--cf-accent)' }}>{templeConfig.address}</span></span>
          <span style={{ color:'var(--cf-text-secondary)', fontWeight:600, whiteSpace:'nowrap' }}>📞 <span style={{ color:'var(--cf-accent)' }}>{templeConfig.phone}</span></span>
          <span style={{ marginLeft:'auto', color:'var(--cf-text-muted)', fontSize:'0.7rem', whiteSpace:'nowrap' }}>
            🌐 <code style={{ background:'var(--cf-bg-deep)', padding:'1px 7px', borderRadius:4, color:'var(--cf-text-secondary)', userSelect:'all' }}>{window.location.origin}/calendar</code>
          </span>
        </div>
      )}

    </>
  );
}
