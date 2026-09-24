/**
 * src/pages/PublicAlbumPage.jsx
 * Route: /photos/album/:albumId
 *
 * Plain read-only viewer for one published album, addressed by its own
 * album_id rather than an event-title/date slug. PublicPhotosPage.jsx
 * links here for a "quick add photos" album (no event picked -- see
 * photoAlbums.js's synthetic event_id) instead of PhotoSharePage.jsx,
 * since that page resolves its :eventId param against a real event and
 * a quick album has none to resolve against. No OTP/attendee-upload flow
 * here -- that's specific to PhotoSharePage's event-tied albums; this is
 * just discovery-and-view for an admin's own uploads.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';

function orgQueryParam() {
  const org = new URLSearchParams(window.location.search).get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}

export default function PublicAlbumPage() {
  const { albumId } = useParams();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public-media/albums/${albumId}${orgQueryParam()}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Could not load that album.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setAlbum(data.album);
        setPhotos(data.photos || []);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [albumId]);

  return (
    <div style={{ minHeight: '100vh', background: '#fffdf7' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px 60px' }}>
        {loading ? (
          <div style={emptyState}>Loading photos…</div>
        ) : error ? (
          <div style={emptyState}>{error}</div>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#3d2008', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>
              {album?.name || album?.event_title || 'Photos'}
            </h1>
            <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0 0 20px' }}>
              {photos.length} photo{photos.length === 1 ? '' : 's'}
            </p>
            {photos.length === 0 ? (
              <div style={emptyState}>No photos here yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {photos.map((p) => (
                  <div key={p.photo_id} style={photoCard}>
                    <img src={p.url} alt={p.caption || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    {album?.download_permission && (
                      <a href={p.url} download style={downloadBtn} title="Download">
                        <Download size={14} color="#fff" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const emptyState = {
  textAlign: 'center', color: '#9a7a55', padding: '60px 0', fontFamily: "'DM Sans', sans-serif",
};
const photoCard = {
  position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8d5a3', background: '#fff',
};
const downloadBtn = {
  position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 6,
  padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
