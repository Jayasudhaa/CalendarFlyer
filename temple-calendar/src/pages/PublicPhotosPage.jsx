/**
 * src/pages/PublicPhotosPage.jsx
 * Route: /photos
 *
 * Org-wide public Photos tab (Media spec section 4): "albums, not one
 * large collection of individual images." Reads GET /api/public-media/
 * albums (already filtered to published + visible-to-this-visitor) and
 * links each card to that event's existing photo page (/photos/:eventKey,
 * PhotoSharePage.jsx) rather than a separate album-viewer -- that page
 * already does everything an album view needs (grid, upload, the new
 * public/gated access split from this same pass), so this page's job is
 * just discovery, not a second photo-viewing implementation.
 *
 * NOTE: this route is intentionally distinct from /photos/:eventId (one
 * event's own photos, unchanged) — React Router matches the exact "/photos"
 * path here without colliding with that param route.
 */
import React, { useEffect, useState } from 'react';
import { Image } from 'lucide-react';
import { useTempleConfig } from '../hooks/useTempleConfig';
import { getPhotoAlbumUrl } from '../utils/rsvpUrl';

function authHeaders() {
  const token = (() => { try { return localStorage.getItem('cf_community_token'); } catch { return null; } })();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function orgQueryParam() {
  const org = new URLSearchParams(window.location.search).get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

const VISIBILITY_LABELS = {
  public: 'Public', link_only: 'Link only', verified_attendees: 'Verified attendees', members_only: 'Members only',
};

export default function PublicPhotosPage() {
  const { config: templeConfig } = useTempleConfig();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public-media/albums${orgQueryParam()}`, { headers: { ...authHeaders() } })
      .then((r) => (r.ok ? r.json() : { albums: [] }))
      .then((d) => { if (!cancelled) setAlbums(d.albums || []); })
      .catch(() => { if (!cancelled) setAlbums([]); })
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
          {templeConfig.temple_name ? `${templeConfig.temple_name} — Photos` : 'Photos'}
        </h1>

        {loading ? (
          <div style={emptyState}>Loading albums…</div>
        ) : albums.length === 0 ? (
          <div style={emptyState}>No photo albums published yet — check back after the next event!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {albums.map((a) => (
              <a
                key={a.album_id}
                href={a.has_event ? getPhotoAlbumUrl({ title: a.event_title, date: a.event_date }) : `/photos/album/${a.album_id}${orgQueryParam()}`}
                style={albumCard}
              >
                <div style={coverStyle}>
                  {a.cover_photo_url ? (
                    <img src={a.cover_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Image size={28} color="#c9943a" />
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 800, color: '#3d2008', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name || a.event_title}
                  </div>
                  <div style={{ color: '#92400e', fontSize: '0.78rem', marginTop: 4 }}>
                    {a.photo_count || 0} photos · {VISIBILITY_LABELS[a.visibility] || a.visibility}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyState = {
  textAlign: 'center', color: '#9a7a55', padding: '60px 0', fontFamily: "'DM Sans', sans-serif",
};
const albumCard = {
  display: 'block', textDecoration: 'none', background: '#fff', border: '1px solid #e8d5a3', borderRadius: 14,
  overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontFamily: "'DM Sans', sans-serif",
};
const coverStyle = {
  aspectRatio: '4/3', background: '#fff8ee', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
