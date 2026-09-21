/**
 * src/pages/PublicLive.jsx
 * Route: /live
 *
 * Org-wide "Glimpses" tab: a reel of the short (<=15s), admin-uploaded
 * video clips posted across this org's events -- not a real-time
 * broadcast, so there's no live/upcoming state here, just a grid of
 * recently published glimpses, newest first. Reads
 * GET /api/public-media/glimpses-recent, the same endpoint PublicNav.jsx's
 * "new glimpse" banner polls.
 *
 * Since these are our own uploaded files (not a third-party YouTube/Zoom
 * link), each card plays with a plain native <video> element -- no
 * external embed needed.
 */
import React, { useEffect, useState } from 'react';
import { useTempleConfig } from '../hooks/useTempleConfig';

function authHeaders() {
  const token = (() => { try { return localStorage.getItem('cf_community_token'); } catch { return null; } })();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function orgQueryParam() {
  const org = new URLSearchParams(window.location.search).get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

function formatWhen(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PublicLive() {
  const { config: templeConfig } = useTempleConfig();
  const [glimpses, setGlimpses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public-media/glimpses-recent${orgQueryParam()}`, { headers: { ...authHeaders() } })
      .then((r) => (r.ok ? r.json() : { recent: [] }))
      .then((d) => { if (!cancelled) setGlimpses(d.recent || []); })
      .catch(() => { if (!cancelled) setGlimpses([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px 60px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#3d2008', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 20px' }}>
          {templeConfig.temple_name ? `${templeConfig.temple_name} — Glimpses` : 'Glimpses'}
        </h1>

        {loading ? (
          <div style={emptyCard}>Loading…</div>
        ) : glimpses.length === 0 ? (
          <div style={emptyCard}>No glimpse videos yet — check back after the next event!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {glimpses.map((s) => (
              <div key={s.stream_id} style={card}>
                <video
                  src={s.video_url}
                  controls
                  playsInline
                  style={{ width: '100%', aspectRatio: '9/16', maxHeight: 360, objectFit: 'cover', background: '#000', borderRadius: 10, display: 'block' }}
                />
                <div style={{ padding: '10px 2px 0' }}>
                  <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '0.92rem' }}>
                    {s.event_title || s.title || 'Event glimpse'}
                  </div>
                  <div style={{ color: '#92400e', fontSize: '0.78rem', marginTop: 3 }}>
                    {s.duration_seconds ? `${Math.round(s.duration_seconds)}s` : ''} · {formatWhen(s.created_at)}
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

const card = {
  background: '#fff', border: '1px solid #e8d5a3', borderRadius: 14, padding: 10,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontFamily: "'DM Sans', sans-serif",
};
const emptyCard = {
  background: '#fff', border: '1px solid #e8d5a3', borderRadius: 14, padding: '18px 20px', textAlign: 'center',
  color: '#9a7a55', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontFamily: "'DM Sans', sans-serif",
};
