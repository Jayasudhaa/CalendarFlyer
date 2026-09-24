/**
 * src/components/PublicNav.jsx
 * Shared top navigation + "new glimpse" banner for every visitor-facing
 * org page, rendered once from PublicOrgLayout (App.jsx) above the routed
 * page, the same way that layout already mounts WebChatWidget once for
 * every visitor page.
 *
 * The nav itself is just the Explore link now -- the org's own Events tab
 * (previously labeled with the org's name) was removed by request. The
 * events/announcements/glimpses/photos sections still all live on one
 * merged page (PublicCalendar.jsx) and are still reachable via old-route
 * redirects (/announcements, /live, /photos) and direct links (RSVP/photo-
 * share/sign-up confirmations, broadcasts) -- there's just no header tab
 * back to it from here. Explore stays a normal route link to the one
 * cross-org page (PublicRadarPage.jsx) and deliberately drops ?org=...
 * (nothing there is scoped to this org).
 *
 * The banner polls GET /api/public-media/glimpses-recent every 30s and,
 * when the newest glimpse video was posted within the last 48h, shows a
 * "New event glimpse" banner linking to the Glimpses section. Older than
 * that, or nothing posted yet, the banner just doesn't show -- there's no
 * "live" state anymore since a glimpse is a short uploaded clip, not a
 * real-time broadcast.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Radar } from 'lucide-react';

const BANNER_WINDOW_MS = 48 * 60 * 60 * 1000;

function authHeaders() {
  // Public pages are usually anonymous, but a phone-verified community
  // member (Follow, RSVP, photo upload) may have a token in localStorage —
  // forwarding it here is what lets glimpses-recent/albums include
  // verified_attendees/members_only content for them (see
  // routes/publicMedia.js's optionalCommunityAuth).
  const token = (() => { try { return localStorage.getItem('cf_community_token'); } catch { return null; } })();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function orgQueryParam() {
  const org = new URLSearchParams(window.location.search).get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

export default function PublicNav() {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      fetch(`/api/public-media/glimpses-recent${orgQueryParam()}`, { headers: { ...authHeaders() } })
        .then((r) => (r.ok ? r.json() : { recent: [] }))
        .then((data) => { if (!cancelled) setRecent(data.recent || []); })
        .catch(() => { if (!cancelled) setRecent([]); });
    }
    poll();
    const interval = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const newest = recent[0] || null;
  const showBanner = newest && (Date.now() - (newest.created_at || 0)) < BANNER_WINDOW_MS;

  return (
    <>
      <nav style={navStyle}>
        <NavLink
          to={{ pathname: '/explore', search: '' }}
          style={({ isActive }) => ({ ...tabStyle, ...(isActive ? tabActiveStyle : {}) })}
        >
          <Radar size={17} />
          <span className="cf-public-nav-label">Explore</span>
        </NavLink>
      </nav>

      {showBanner && (
        <Link to={{ pathname: '/calendar', search: window.location.search, hash: 'glimpses' }} style={bannerStyle('#1e3a8a', '#1d4ed8')}>
          <span>🎬 New glimpse — {newest.event_title || newest.title || 'an event'}</span>
          <span style={watchBtnStyle}>Watch</span>
        </Link>
      )}

      <style>{`
        @media (max-width: 640px) {
          .cf-public-nav-label { display: none; }
        }
      `}</style>
    </>
  );
}

const navStyle = {
  display: 'flex', gap: 4, padding: '10px 16px', background: '#1a0e04', borderBottom: '1px solid #3a2008',
  position: 'sticky', top: 0, zIndex: 500, overflowX: 'auto',
};
const tabStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
  color: 'rgba(255,255,255,0.72)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem',
  fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0,
};
const tabActiveStyle = { background: 'rgba(255,255,255,0.12)', color: '#fff' };
const bannerStyle = (from, to) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '10px 18px', background: `linear-gradient(90deg,${from},${to})`, color: '#fff',
  textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif",
  flexWrap: 'wrap',
});
const watchBtnStyle = {
  padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', fontSize: '0.8rem', fontWeight: 800,
};
