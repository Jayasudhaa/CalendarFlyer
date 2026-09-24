/**
 * src/pages/PublicAnnouncementsPage.jsx
 * Route: /announcements
 *
 * Standalone version of the Announcements feed PublicCalendar.jsx already
 * shows in its side panel (NewsFeedPanel) — same GET /api/announcements
 * call, just as its own page so the shared nav's "Announcements" tab has
 * somewhere of its own to go on mobile (where the calendar's side panel
 * isn't shown at all).
 */
import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useTempleConfig } from '../hooks/useTempleConfig';

function orgQueryParam() {
  const org = new URLSearchParams(window.location.search).get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

export default function PublicAnnouncementsPage() {
  const { config: templeConfig } = useTempleConfig();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/announcements${orgQueryParam()}`)
      .then((r) => r.json())
      .then((data) => setAnnouncements(Array.isArray(data) ? data : data.announcements || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#fffdf7' }}>
      {templeConfig.banner_url && (
        <img
          src={templeConfig.banner_url}
          alt="Banner"
          style={{ width:'100%', maxHeight:220, objectFit:'cover', display:'block' }}
        />
      )}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 60px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#3d2008', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 20px' }}>
          {templeConfig.temple_name ? `${templeConfig.temple_name} — Announcements` : 'Announcements'}
        </h1>

        {loading ? (
          <div style={emptyState}>Loading…</div>
        ) : announcements.length === 0 ? (
          <div style={emptyState}>No announcements right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {announcements.map((a, i) => (
              <div key={i} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Megaphone size={16} color="#c9943a" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    {a.date && (
                      <div style={{ color: '#b8966a', fontSize: '0.72rem', fontWeight: 700, marginBottom: 4 }}>
                        {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                    {(a.title || a.subject) && <div style={{ fontWeight: 800, color: '#3d2008', marginBottom: 4 }}>{a.title || a.subject}</div>}
                    {a.body && <div style={{ color: '#5a4530', fontSize: '0.88rem', lineHeight: 1.6 }}>{a.body}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyState = { textAlign: 'center', color: '#9a7a55', padding: '60px 0', fontFamily: "'DM Sans', sans-serif" };
const card = {
  background: '#fff', border: '1px solid #e8d5a3', borderRadius: 12, padding: '14px 16px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontFamily: "'DM Sans', sans-serif",
};
