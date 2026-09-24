/**
 * PhotoSharePage.jsx
 * Route: /photos/:eventId  (eventId is the same date-title slug RSVPPage
 * uses — see utils/rsvpUrl.js#getEventKey — resolved against useEvents()
 * the same way RSVPPage.jsx does, since that's the only place the real
 * DynamoDB event_id is available; the photo API needs that real id, not
 * the slug, to look the event up — see server/routes/photos.js).
 *
 * Public live photo album for a temple event. Two states:
 *  - Not verified yet: email address -> emailed code -> verified. Token is
 *    saved in localStorage (per-origin, so per-org — this app is
 *    subdomain-multi-tenant) and reused on repeat visits for ~90 days.
 *  - Verified: live grid of approved photos (polls every 12s while the
 *    tab is visible) plus an upload button. A devotee's own pending-review
 *    photos aren't shown here — Rekognition may still be checking them,
 *    or they're waiting on a quick admin look — so upload just confirms
 *    with a message instead of adding a card that would vanish on the
 *    next poll.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { getEventKey } from '../utils/rsvpUrl';

const TOKEN_KEY = 'cf_community_token';
const POLL_MS = 12000;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB — plenty for a phone photo, small enough to not sit forever on a slow upload
const ACCEPTED_TYPES = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };

function findEventByKey(events, key) {
  if (!key) return null;
  return events.find((e) => getEventKey(e) === key) || null;
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private browsing etc — session still works, just won't persist */ }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

// Forwards ?org=<subdomain> from this page's own URL to every API call, the
// same convention useEvents.js already uses (see orgQueryParam() there).
// tenantMiddleware resolves the organization from the request's subdomain,
// which doesn't exist on localhost — this is what lets local dev resolve
// the right org anyway, by visiting e.g. /photos/some-event?org=xyz. In
// production the real subdomain resolves first and this param is unused.
function withOrgParam(path) {
  const org = new URLSearchParams(window.location.search).get('org');
  if (!org) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org=${encodeURIComponent(org)}`;
}

async function apiFetch(path, { token, ...opts } = {}) {
  const res = await fetch(withOrgParam(path), {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
  return data;
}

export default function PhotoSharePage() {
  const { eventId: eventSlug } = useParams();
  const { events, loading: eventsLoading } = useEvents();
  const event = findEventByKey(events, eventSlug);
  const eventName = event?.title || 'Temple Event';
  const eventDate = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const [token, setTok] = useState(getToken());
  // 'checking' | 'open' | 'gated' -- whether THIS event's album can be
  // viewed without phone verification. Only checked when there's no
  // token yet; once verified for any reason the full Album component
  // handles everything (including a verified_attendees/members_only
  // album this same visitor is now allowed into).
  const [publicAccess, setPublicAccess] = useState('checking');
  const [downloadPermission, setDownloadPermission] = useState(false);

  useEffect(() => {
    if (!event || token) return undefined;
    let cancelled = false;
    setPublicAccess('checking');
    apiFetch(`/api/public-media/events/${event.id}/photos`)
      .then((data) => {
        if (cancelled) return;
        setDownloadPermission(!!data.download_permission);
        setPublicAccess('open');
      })
      .catch(() => { if (!cancelled) setPublicAccess('gated'); });
    return () => { cancelled = true; };
  }, [event?.id, token]);

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '32px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📸</div>
          <div style={{ color: '#c9943a', fontSize: '1.3rem', fontWeight: 800, marginBottom: 4, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {eventName} — Photo Album
          </div>
          {eventDate && <div style={{ color: '#92400e', fontSize: '0.85rem' }}>📅 {eventDate}</div>}
        </div>

        {eventsLoading ? (
          <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading event…</div>
        ) : !event ? (
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: '0.9rem' }}>Event not found.</div>
        ) : token ? (
          <Album eventDbId={event.id} token={token} onTokenInvalid={() => { clearToken(); setTok(null); }} />
        ) : publicAccess === 'open' ? (
          <PublicAlbumPreview eventDbId={event.id} downloadPermission={downloadPermission} onVerified={(t) => setTok(t)} />
        ) : publicAccess === 'gated' ? (
          <PhoneVerify onVerified={(t) => setTok(t)} />
        ) : (
          <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading album…</div>
        )}
      </div>
    </div>
  );
}

// ── Public (no phone verification) album preview ────────────────────────
// Shown when the event's album is 'public' or 'link_only' (or has no
// album row configured at all -- see publicMedia.js's buildEventMediaSummary
// for that default-open behavior). Viewing needs no verification;
// uploading still does, so "Add your photos" reveals PhoneVerify inline
// instead of gating the whole page like a verified_attendees/members_only
// album does above.

function PublicAlbumPreview({ eventDbId, downloadPermission, onVerified }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVerify, setShowVerify] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/public-media/events/${eventDbId}/photos`);
      setPhotos(data.photos || []);
    } catch {
      // A transient failure here just leaves the last-known grid up rather
      // than bouncing the visitor into the verification flow.
    } finally {
      setLoading(false);
    }
  }, [eventDbId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <button
          onClick={() => setShowVerify(true)}
          style={{ padding: '14px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#b45309,#78350f)', color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
        >
          📷 Share a photo
        </button>
      </div>

      {showVerify && (
        <div style={{ maxWidth: 420, margin: '0 auto 20px' }}>
          <PhoneVerify onVerified={onVerified} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading photos…</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem', padding: '40px 0' }}>
          No photos yet — be the first to share one!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {photos.map((p) => (
            <div key={p.photo_id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8d5b7', aspectRatio: '1 / 1' }}>
              <img src={p.url} alt={p.caption || 'Event photo'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {downloadPermission && (
                <a href={p.url} download target="_blank" rel="noopener noreferrer"
                  style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '3px 7px', borderRadius: 6, textDecoration: 'none' }}
                >
                  ⬇
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 24, color: '#e8d5b7', fontSize: '0.75rem' }}>
        🌸 Om Namo Venkatesaya 🌸
      </div>
    </div>
  );
}

// ── Email verification ──────────────────────────────────────────────────

function PhoneVerify({ onVerified }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#fffdf7', border: '1px solid #e8d5b7',
    borderRadius: 10, color: '#3d2008', fontSize: '0.95rem',
    outline: 'none', fontFamily: "'DM Sans', sans-serif",
  };
  const button = (disabled) => ({
    width: '100%', padding: '14px',
    background: disabled ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
    border: 'none', color: 'white', borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 800, fontSize: '1rem', fontFamily: "'DM Sans', sans-serif",
  });

  const requestCode = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError(''); setBusy(true);
    try {
      await apiFetch('/api/community/request-code', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return setError('Enter the code we emailed you.');
    setError(''); setBusy(true);
    try {
      const data = await apiFetch('/api/community/verify-code', { method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }) });
      onVerified(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#fffdf7', borderRadius: 16, border: '1px solid #e8d5b7', padding: 28 }}>
      <div style={{ color: '#92400e', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20 }}>
        To view and share photos from this event, verify your email address — this keeps the album for people who were actually there.
      </div>

      {step === 'email' ? (
        <>
          <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Email address
          </label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginBottom: 16 }} />
          {error && <ErrorBanner text={error} />}
          <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? '⏳ Sending…' : 'Email me a code'}</button>
        </>
      ) : (
        <>
          <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            6-digit code sent to {email}
          </label>
          <input type="text" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, marginBottom: 12, letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.2rem' }} />
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
              ← Use a different email
            </button>
          </div>
          {error && <ErrorBanner text={error} />}
          <button onClick={verifyCode} disabled={busy} style={button(busy)}>{busy ? '⏳ Verifying…' : 'Verify & continue'}</button>
        </>
      )}
    </div>
  );
}

function ErrorBanner({ text }) {
  return (
    <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
      {text}
    </div>
  );
}

// ── Live album ───────────────────────────────────────────────────────────

function Album({ eventDbId, token, onTokenInvalid }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/photos/event/${eventDbId}`, { token });
      setPhotos(data.photos || []);
    } catch (err) {
      if (/expired|verify/i.test(err.message)) onTokenInvalid();
    } finally {
      setLoading(false);
    }
  }, [eventDbId, token, onTokenInvalid]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    setUploadError(''); setNotice('');

    if (!ACCEPTED_TYPES[file.type]) return setUploadError('Please choose a JPEG, PNG, or WebP photo.');
    if (file.size > MAX_FILE_BYTES) return setUploadError('That photo is too large — please choose one under 12MB.');

    setUploading(true);
    try {
      const { upload_url, key } = await apiFetch('/api/photos/upload-url', {
        token, method: 'POST',
        body: JSON.stringify({ event_id: eventDbId, content_type: file.type }),
      });

      const putRes = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) throw new Error('Upload failed — please try again.');

      const result = await apiFetch('/api/photos/register', {
        token, method: 'POST',
        body: JSON.stringify({ event_id: eventDbId, key }),
      });

      if (result.status === 'live') {
        setNotice('Your photo is live in the album! 🎉');
        load();
      } else {
        setNotice(result.message || 'Your photo was submitted and is awaiting a quick review before it appears.');
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: 'none' }} />
        <button
          onClick={handlePick}
          disabled={uploading}
          style={{
            padding: '14px 28px', borderRadius: 12, border: 'none',
            background: uploading ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
            color: 'white', fontWeight: 800, fontSize: '0.95rem',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {uploading ? '⏳ Uploading…' : '📷 Share a photo'}
        </button>
      </div>

      {uploadError && (
        <div style={{ maxWidth: 420, margin: '0 auto 16px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', textAlign: 'center' }}>
          {uploadError}
        </div>
      )}
      {notice && (
        <div style={{ maxWidth: 420, margin: '0 auto 16px', padding: '10px 14px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, color: '#15803d', fontSize: '0.85rem', textAlign: 'center' }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading photos…</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem', padding: '40px 0' }}>
          No photos yet — be the first to share one!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {photos.map((p) => (
            <div key={p.photo_id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: p.mine ? '2px solid #c9943a' : '1px solid #e8d5b7', aspectRatio: '1 / 1' }}>
              <img src={p.url} alt={p.caption || 'Event photo'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {p.mine && (
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(120,53,15,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 20 }}>
                  Yours
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 24, color: '#e8d5b7', fontSize: '0.75rem' }}>
        🌸 Om Namo Venkatesaya 🌸
      </div>
    </div>
  );
}
