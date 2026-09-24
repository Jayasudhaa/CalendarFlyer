/**
 * src/pages/PhotoModerationPage.jsx
 * Route: /photos-admin
 *
 * Review queue for photos Rekognition flagged during upload (see
 * server/routes/photos.js — anything moderation-uncertain lands here as
 * 'pending_review' instead of auto-publishing or auto-rejecting). Most
 * temples should see this page empty most of the time — auto-screen +
 * live-immediately is the default (see PhotoSharePage.jsx's upload flow),
 * so a photo only shows up here when something needed a human look.
 *
 * Same page shell/auth pattern as RSVPAdmin.jsx: AdminToolbar + useAuth's
 * token for the admin-only /api/photos/* routes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useEvents } from '../hooks/useEvents';
import AdminToolbar from '../components/AdminToolbar';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const FLAG_LABELS = { name: 'name', confidence: 'confidence' };

export default function PhotoModerationPage() {
  const { events } = useEvents();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/photos/moderation-queue', { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load the moderation queue');
      setPhotos(data.photos || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (photo_id, action) => {
    setBusyId(photo_id);
    try {
      const res = await fetch(`/api/photos/${photo_id}/${action}`, { method: 'POST', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That action failed — try again.');
      setPhotos((prev) => prev.filter((p) => p.photo_id !== photo_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const eventName = (event_id) => events.find((e) => e.id === event_id)?.title || 'Unknown event';

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="photos" />
      <div style={{ padding: 20 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--cf-text-primary)', fontFamily: "'Playfair Display', Georgia, serif" }}>
              Photo Moderation
            </div>
            <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              Photos our automatic screening flagged for a quick look before they go live in an event's album.
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--cf-text-muted)' }}>⏳ Loading…</div>
          ) : photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--cf-text-muted)' }}>
              ✅ Nothing waiting for review right now.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {photos.map((p) => (
                <div key={p.photo_id} style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, overflow: 'hidden' }}>
                  <img src={p.url} alt="Submitted for review" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cf-text-primary)', marginBottom: 4 }}>
                      {eventName(p.event_id)}
                    </div>
                    {p.caption && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--cf-text-secondary)', marginBottom: 8 }}>{p.caption}</div>
                    )}
                    {Array.isArray(p.moderation_labels) && p.moderation_labels.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {p.moderation_labels.slice(0, 4).map((l, i) => (
                          <span key={i} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
                            {l[FLAG_LABELS.name]} · {Math.round(l[FLAG_LABELS.confidence])}%
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => decide(p.photo_id, 'approve')}
                        disabled={busyId === p.photo_id}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: busyId === p.photo_id ? 'not-allowed' : 'pointer' }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => decide(p.photo_id, 'reject')}
                        disabled={busyId === p.photo_id}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontWeight: 700, fontSize: '0.85rem', cursor: busyId === p.photo_id ? 'not-allowed' : 'pointer' }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
