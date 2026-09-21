/**
 * src/pages/MediaOverview.jsx
 * Route: /media
 *
 * Admin landing page for the Media feature (event glimpse videos + photo
 * albums): summary cards, a Glimpse videos panel, a Recent albums panel,
 * and a Pending approval panel with its own bulk approve/reject/flag
 * controls.
 *
 * A glimpse video is a short (<=15s), admin-uploaded clip -- not a
 * real-time broadcast, so there's no live/scheduled state, just a list of
 * recently uploaded clips.
 *
 * Data comes from two overview endpoints, one call each:
 *   GET /api/livestreams/overview   -> { recent, total, max_per_event, max_seconds }
 *   GET /api/photo-albums/overview  -> { recent_albums, published_album_count,
 *                                        pending_approval, pending_approval_count }
 * Individual photo actions (approve/reject/flag/bulk) hit routes/photos.js,
 * same as the dedicated /photos-admin page (PhotoModerationPage.jsx) --
 * this panel is a compact, action-capable preview of that same queue, not
 * a separate source of truth. Anything past the first 12 pending photos
 * links out to /photos-admin instead of being duplicated here.
 *
 * Same page shell as AdminHome.jsx/RSVPAdmin.jsx: AdminToolbar + useAuth's
 * token, no manual auth guard (the backend enforces owner/admin on every
 * mutating route -- see routes/livestreams.js and routes/photoAlbums.js).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Film, Image, Plus, Link2, Check, Square, CheckSquare, Flag, X, Trash2 } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { getPublicCalendarUrl } from '../utils/rsvpUrl';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const VISIBILITY_LABELS = {
  public: 'Public', link_only: 'Link only', verified_attendees: 'Verified attendees',
  members_only: 'Members only', private: 'Private', hidden: 'Hidden / Draft',
};

function formatWhen(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MediaOverview() {
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const { events } = useEvents();

  const [glimpses, setGlimpses] = useState([]);
  const [glimpseTotal, setGlimpseTotal] = useState(0);
  const [albums, setAlbums] = useState([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [pending, setPending] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const eventTitle = useCallback(
    (event_id) => events.find((e) => e.id === event_id)?.title || 'Unknown event',
    [events]
  );

  // A glimpse with no event attached is just tagged with a date --
  // format that for display instead of falling through to "Unknown event".
  const glimpseLabel = useCallback((s) => {
    if (s.title) return s.title;
    if (s.event_id) return eventTitle(s.event_id);
    if (s.date) return new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return 'Untitled';
  }, [eventTitle]);

  // A quick-uploaded album (no event picked, see routes/photos.js's
  // admin/* routes) carries a synthetic "noevent-..." event_id -- fall
  // back to its date instead of looking that up as a real event.
  const albumLabel = useCallback((a) => {
    if (a.name) return a.name;
    if (a.event_id && !a.event_id.startsWith('noevent-')) return eventTitle(a.event_id);
    if (a.date) return new Date(`${a.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return 'Untitled album';
  }, [eventTitle]);

  const load = useCallback(async () => {
    try {
      const [streamRes, albumRes] = await Promise.all([
        fetch('/api/livestreams/overview', { headers: { ...authHeaders() } }),
        fetch('/api/photo-albums/overview', { headers: { ...authHeaders() } }),
      ]);
      const streamData = await streamRes.json().catch(() => ({}));
      const albumData = await albumRes.json().catch(() => ({}));
      if (!streamRes.ok) throw new Error(streamData.error || 'Failed to load glimpse videos.');
      if (!albumRes.ok) throw new Error(albumData.error || 'Failed to load photo albums.');

      setGlimpses(streamData.recent || []);
      setGlimpseTotal(streamData.total || 0);
      setAlbums(albumData.recent_albums || []);
      setPublishedCount(albumData.published_album_count || 0);
      setPending((albumData.pending_approval || []).slice(0, 12));
      setPendingCount(albumData.pending_approval_count || 0);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteGlimpse(stream_id) {
    setBusyId(stream_id);
    try {
      const res = await fetch(`/api/livestreams/${stream_id}`, { method: 'DELETE', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove that glimpse video.');
      setGlimpses((prev) => prev.filter((s) => s.stream_id !== stream_id));
      setGlimpseTotal((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function copyGlimpseLink(s) {
    // getPublicCalendarUrl() already carries the org's own ?org= query
    // param when this app runs on the bare domain rather than a
    // subdomain (see utils/rsvpUrl.js) -- URL/searchParams handles adding
    // event on top of that correctly either way, rather than
    // string-concatenating a second "?" or "&" by hand.
    const url = new URL(getPublicCalendarUrl());
    url.searchParams.set('event', s.event_id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setBusyId(`copy-${s.stream_id}`);
      setTimeout(() => setBusyId(null), 1500);
    });
  }

  async function decidePhoto(photo_id, action) {
    setBusyId(photo_id);
    try {
      const res = await fetch(`/api/photos/${photo_id}/${action}`, { method: 'POST', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That action failed — try again.');
      setPending((prev) => prev.filter((p) => p.photo_id !== photo_id));
      setPendingCount((c) => Math.max(0, c - 1));
      setSelected((prev) => { const next = new Set(prev); next.delete(photo_id); return next; });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(photo_id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(photo_id)) next.delete(photo_id); else next.add(photo_id);
      return next;
    });
  }

  async function bulkApprove() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusyId('bulk');
    try {
      const res = await fetch('/api/photos/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk approval failed.');
      const okIds = new Set((data.results || []).filter((r) => r.success).map((r) => r.photo_id));
      setPending((prev) => prev.filter((p) => !okIds.has(p.photo_id)));
      setPendingCount((c) => Math.max(0, c - okIds.size));
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const summaryCards = [
    { icon: Film, label: 'Glimpse videos', value: glimpseTotal, color: '#dc2626' },
    { icon: Image, label: 'Published albums', value: publishedCount, color: '#16a34a' },
    { icon: Video, label: 'Photos awaiting approval', value: pendingCount, color: '#d97706' },
  ];

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="media" />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              Media
            </h1>
            <p style={{ color: 'var(--cf-text-muted)', margin: '6px 0 0', fontSize: '0.92rem' }}>
              Event glimpse videos and photo albums for your events.
            </p>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/media/livestreams/new')} style={primaryBtn}>
                <Plus size={15} /> Add media
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          {summaryCards.map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={color} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--cf-text-primary)', lineHeight: 1 }}>
                  {loading ? '–' : value}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--cf-text-muted)', marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="cf-media-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          <style>{`@media (max-width: 900px) { .cf-media-grid { grid-template-columns: 1fr !important; } }`}</style>

          {/* Glimpse videos */}
          <div style={cardStyle}>
            <div style={panelHeader}>🎬 Event glimpse videos</div>
            {loading ? (
              <div style={emptyStateStyle}>Loading…</div>
            ) : glimpses.length === 0 ? (
              <div style={emptyStateStyle}>
                No glimpse videos yet.
                {canManage && <> <button onClick={() => navigate('/media/livestreams/new')} style={linkBtn}>Add one</button>.</>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {glimpses.map((s) => (
                  <div key={s.stream_id} style={rowCardStyle}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={videoPreviewStyle}>
                        <video src={s.video_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {glimpseLabel(s)}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>
                          {s.duration_seconds ? `${Math.round(s.duration_seconds)}s` : ''} · {VISIBILITY_LABELS[s.visibility] || s.visibility} · {formatWhen(s.created_at)}
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => copyGlimpseLink(s)} style={smallSecondaryBtn}>
                          {busyId === `copy-${s.stream_id}` ? <><Check size={13} /> Copied!</> : <><Link2 size={13} /> Copy link</>}
                        </button>
                        <button onClick={() => navigate(`/media/livestreams/${s.stream_id}`)} style={smallSecondaryBtn}>Edit</button>
                        <button onClick={() => deleteGlimpse(s.stream_id)} disabled={busyId === s.stream_id} style={smallDangerBtn}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent albums */}
          <div style={cardStyle}>
            <div style={panelHeader}>📷 Recent albums</div>
            {loading ? (
              <div style={emptyStateStyle}>Loading…</div>
            ) : albums.length === 0 ? (
              <div style={emptyStateStyle}>
                No albums yet.
                {canManage && <> <button onClick={() => navigate('/media/livestreams/new')} style={linkBtn}>Add photos</button>.</>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {albums.map((a) => (
                  <div key={a.album_id} style={{ ...rowCardStyle, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={videoPreviewStyle}>
                      {a.cover_photo_url ? (
                        <img src={a.cover_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        <Image size={20} color="var(--cf-text-muted)" />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--cf-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {albumLabel(a)}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>
                        {a.photo_count || 0} photos · {VISIBILITY_LABELS[a.visibility] || a.visibility} · {a.publishing_status === 'published' ? formatWhen(a.updated_at) : 'Draft'}
                      </div>
                    </div>
                    {canManage && (
                      <button onClick={() => navigate(`/media/albums/${a.album_id}`)} style={smallSecondaryBtn}>Manage</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending approval */}
          <div style={cardStyle}>
            <div style={{ ...panelHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🕓 Pending approval {pendingCount > 0 && `(${pendingCount})`}</span>
              {selected.size > 0 && (
                <button onClick={bulkApprove} disabled={busyId === 'bulk'} style={smallPrimaryBtn}>
                  <Check size={13} /> Approve {selected.size} selected
                </button>
              )}
            </div>
            {loading ? (
              <div style={emptyStateStyle}>Loading…</div>
            ) : pending.length === 0 ? (
              <div style={emptyStateStyle}>Nothing waiting for review.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8 }}>
                  {pending.map((p) => {
                    const isSelected = selected.has(p.photo_id);
                    return (
                      <div key={p.photo_id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `2px solid ${isSelected ? 'var(--cf-accent)' : 'transparent'}` }}>
                        <img src={p.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={() => toggleSelected(p.photo_id)}
                          style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 5, padding: 2, cursor: 'pointer', display: 'flex' }}
                          title="Select"
                        >
                          {isSelected ? <CheckSquare size={15} color="#fff" /> : <Square size={15} color="#fff" />}
                        </button>
                        {p.auto_flagged && (
                          <span style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4 }}>
                            FLAGGED
                          </span>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: 'rgba(0,0,0,0.55)' }}>
                          <button onClick={() => decidePhoto(p.photo_id, 'approve')} disabled={busyId === p.photo_id} title="Approve" style={photoActionBtn}>
                            <Check size={13} color="#4ade80" />
                          </button>
                          <button onClick={() => decidePhoto(p.photo_id, 'flag')} disabled={busyId === p.photo_id} title="Flag" style={photoActionBtn}>
                            <Flag size={13} color="#facc15" />
                          </button>
                          <button onClick={() => decidePhoto(p.photo_id, 'reject')} disabled={busyId === p.photo_id} title="Reject" style={photoActionBtn}>
                            <X size={13} color="#f87171" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {pendingCount > pending.length && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
                    <button onClick={() => navigate('/photos-admin')} style={linkBtn}>See all {pendingCount} pending photos</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 14,
  padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};
const panelHeader = {
  fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--cf-text-muted)', marginBottom: 12,
};
const emptyStateStyle = { color: 'var(--cf-text-muted)', fontSize: '0.85rem', padding: '10px 0' };
const rowCardStyle = {
  border: '1px solid var(--cf-border)', borderRadius: 10, padding: '10px 12px', background: 'var(--cf-bg-base)',
};
const videoPreviewStyle = {
  width: 56, height: 56, borderRadius: 8, background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
};
const primaryBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none',
  background: 'var(--cf-accent)', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
const secondaryBtn = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', color: 'var(--cf-text-primary)',
  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const smallPrimaryBtn = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: 'none',
  background: 'var(--cf-accent)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
};
const smallSecondaryBtn = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7,
  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', color: 'var(--cf-text-primary)',
  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
};
const smallDangerBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 11px', borderRadius: 7,
  border: '1px solid #f8717166', background: '#fff', color: '#dc2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
};
const linkBtn = {
  border: 'none', background: 'transparent', color: 'var(--cf-accent)', fontWeight: 700, cursor: 'pointer',
  fontSize: 'inherit', padding: 0, textDecoration: 'underline',
};
const photoActionBtn = {
  flex: 1, border: 'none', background: 'transparent', padding: '6px 0', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};
