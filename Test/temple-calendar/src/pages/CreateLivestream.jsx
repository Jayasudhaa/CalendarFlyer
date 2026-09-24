/**
 * src/pages/CreateLivestream.jsx
 * Routes: /media/livestreams/new (upload) and /media/livestreams/:id (edit)
 *
 * "Livestream" here means a short (<=MAX_SECONDS), admin-uploaded video
 * clip that gives visitors a glimpse of the event -- not a real-time
 * broadcast. Picking an event is never required: this page auto-fills
 * today's event when there's exactly one, offers a quick pick when
 * there's more than one, and otherwise just tags the upload with today's
 * date -- there's no dropdown to fight with either way. New: pick a video
 * file, it's checked client-side against the length limit (a courtesy
 * check -- the server re-checks for real), uploaded straight to S3 via a
 * presigned URL, then registered. Edit: only title/visibility can
 * change -- to replace the clip itself, delete it and add a new one.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Film, UploadCloud, Check, ImagePlus, X } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';
import { useEvents } from '../hooks/useEvents';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };
const MAX_SECONDS = 15;
const MAX_PER_GROUP = 10;
const MAX_PHOTOS = 20;
const PHOTO_TYPE_RE = /^image\/(jpeg|png|webp)$/;

function authHeaders(json = true) {
  const token = localStorage.getItem('cf_token');
  const base = token ? { Authorization: `Bearer ${token}` } : {};
  return json ? { ...base, 'Content-Type': 'application/json' } : base;
}

function todayDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — anyone can watch' },
  { value: 'link_only', label: 'Link only — anyone with the link' },
  { value: 'verified_attendees', label: 'Verified attendees — RSVP or ticket required' },
  { value: 'members_only', label: 'Members only' },
  { value: 'private', label: 'Private' },
  { value: 'hidden', label: 'Hidden / Draft' },
];

/** PUTs a file to a presigned S3 URL via XHR (not fetch) so upload
 *  progress is observable -- onProgress(pct) fires as the browser reports
 *  bytes sent. Without this, a slow multi-MB video upload and a genuinely
 *  stuck one look identical: both just say "Uploading...". */
function putWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('The video upload failed — try again.'));
    };
    xhr.onerror = () => reject(new Error('The video upload failed — check your connection and try again.'));
    xhr.send(file);
  });
}

/** Reads a local video file's duration in seconds without uploading it. */
function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that video file.'));
    };
    video.src = url;
  });
}

export default function CreateLivestream() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { events } = useEvents();
  const fileInputRef = useRef(null);

  const today = useMemo(() => todayDate(), []);
  const todaysEvents = useMemo(
    () => events.filter((e) => e.date === today && e.type !== 'panchang'),
    [events, today]
  );

  const [eventId, setEventId] = useState(null);
  const [pickedToday, setPickedToday] = useState(false); // has the admin made an explicit choice among today's events?
  const [form, setForm] = useState({ title: '', visibility: 'public' });
  const [existingInfo, setExistingInfo] = useState(null); // { event_id, date } for edit mode, display only
  const [file, setFile] = useState(null);
  const [fileDuration, setFileDuration] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [groupCount, setGroupCount] = useState(null);
  const [photoCount, setPhotoCount] = useState(null);
  const [photoQueue, setPhotoQueue] = useState([]); // [{ key, name, status: 'uploading'|'done'|'error' }]
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [error, setError] = useState('');

  // Auto-fill today's event the moment it's knowable, unless there's more
  // than one and the admin hasn't picked yet.
  useEffect(() => {
    if (isEdit || pickedToday) return;
    if (todaysEvents.length === 1) setEventId(todaysEvents[0].id);
  }, [isEdit, pickedToday, todaysEvents]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    fetch(`/api/livestreams/${id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.stream) { setError('Glimpse video not found.'); return; }
        const s = data.stream;
        setForm({ title: s.title || '', visibility: s.visibility || 'public' });
        setExistingInfo({ event_id: s.event_id || null, date: s.date || null });
      })
      .catch(() => setError('Could not load that glimpse video.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // "N/10 used" for whichever group this upload belongs to.
  useEffect(() => {
    if (isEdit) { setGroupCount(null); return; }
    let cancelled = false;
    const qs = eventId ? `event_id=${encodeURIComponent(eventId)}` : `date=${today}`;
    fetch(`/api/livestreams/count?${qs}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setGroupCount(typeof data.count === 'number' ? data.count : null); })
      .catch(() => { if (!cancelled) setGroupCount(null); });
    return () => { cancelled = true; };
  }, [eventId, today, isEdit]);

  // "N/20 used" for photos in whichever group this page is adding to.
  const refreshPhotoCount = React.useCallback(() => {
    if (isEdit) return;
    const qs = eventId ? `event_id=${encodeURIComponent(eventId)}` : `date=${today}`;
    fetch(`/api/photos/admin/count?${qs}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => setPhotoCount(typeof data.count === 'number' ? data.count : null))
      .catch(() => setPhotoCount(null));
  }, [eventId, today, isEdit]);
  useEffect(() => { refreshPhotoCount(); }, [refreshPhotoCount]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function acceptFile(f) {
    setFile(null);
    setFileDuration(null);
    setError('');
    if (!f) return;
    if (!/^video\/(mp4|webm|quicktime)$/.test(f.type)) {
      return setError('Choose an MP4, WebM, or MOV video file.');
    }
    try {
      const duration = await readVideoDuration(f);
      if (duration > MAX_SECONDS + 0.5) {
        setError(`That video is ${duration.toFixed(1)}s — glimpse videos must be ${MAX_SECONDS} seconds or less. Trim it and try again.`);
        return;
      }
      setFile(f);
      setFileDuration(duration);
    } catch {
      setError('Could not read that video file — try a different one.');
    }
  }

  function handleFileChange(e) {
    acceptFile(e.target.files && e.target.files[0]);
  }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  }

  /** Uploads one photo end to end: presigned URL, PUT to S3, then register
   *  it as 'live' straight away -- no moderation queue for an admin's own
   *  upload (see routes/photos.js's admin/* routes). */
  async function uploadOnePhoto(file) {
    const mark = (status) => setPhotoQueue((q) => q.map((p) => (p.name === file.name && p.status !== 'done' ? { ...p, status } : p)));
    try {
      const body = { content_type: file.type, date: today };
      if (eventId) body.event_id = eventId;
      const urlRes = await fetch('/api/photos/admin/upload-url', {
        method: 'POST', headers: { ...authHeaders() }, body: JSON.stringify(body),
      });
      const urlData = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) throw new Error(urlData.error || 'Could not start the photo upload.');

      const putRes = await fetch(urlData.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!putRes.ok) throw new Error('The photo upload failed — try again.');

      const regBody = { key: urlData.key, date: today };
      if (eventId) regBody.event_id = eventId;
      const res = await fetch('/api/photos/admin/register', {
        method: 'POST', headers: { ...authHeaders() }, body: JSON.stringify(regBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save that photo.');

      mark('done');
      refreshPhotoCount();
    } catch (err) {
      mark('error');
      setPhotoError(err.message);
    }
  }

  function handlePhotoFiles(fileList) {
    setPhotoError('');
    const picked = Array.from(fileList || []).filter((f) => PHOTO_TYPE_RE.test(f.type));
    if (!picked.length) return;
    const alreadyUsed = (photoCount || 0) + photoQueue.filter((p) => p.status !== 'error').length;
    const room = Math.max(0, MAX_PHOTOS - alreadyUsed);
    const toUpload = picked.slice(0, room);
    if (picked.length > toUpload.length) {
      setPhotoError(`Only ${MAX_PHOTOS} photos allowed here — added ${toUpload.length} of ${picked.length}.`);
    }
    if (!toUpload.length) return;
    setPhotoQueue((q) => [...q, ...toUpload.map((f) => ({ name: f.name, status: 'uploading' }))]);
    toUpload.forEach((file) => uploadOnePhoto(file));
  }
  function handlePhotoInputChange(e) {
    handlePhotoFiles(e.target.files);
    e.target.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (isEdit) {
      setSaving(true);
      setSavingStep('Saving…');
      try {
        const res = await fetch(`/api/livestreams/${id}`, {
          method: 'PATCH',
          headers: { ...authHeaders() },
          body: JSON.stringify({ title: form.title.trim(), visibility: form.visibility }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that glimpse video.');
        navigate('/media');
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
        setSavingStep('');
      }
      return;
    }

    // The video is optional now that photos upload on their own as soon as
    // they're picked (see handlePhotoFiles) -- the submit button below only
    // renders once a file is actually selected, so reaching here with no
    // file means nothing to do (rather than silently discarding a video
    // that's still mid-selection).
    if (!file) return;
    if (atCap) return setError(`Already at ${MAX_PER_GROUP} glimpse videos, the most allowed here.`);

    setSaving(true);
    try {
      setSavingStep('Preparing upload…');
      const body = { content_type: file.type, date: today };
      if (eventId) body.event_id = eventId;
      const urlRes = await fetch('/api/livestreams/upload-url', {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(body),
      });
      const urlData = await urlRes.json().catch(() => ({}));
      if (!urlRes.ok) throw new Error(urlData.error || 'Could not start the upload.');

      setSavingStep('Uploading video… 0%');
      await putWithProgress(urlData.upload_url, file, (pct) => setSavingStep(`Uploading video… ${pct}%`));

      setSavingStep('Saving…');
      const createBody = { key: urlData.key, duration_seconds: fileDuration, title: form.title.trim(), visibility: form.visibility, date: today };
      if (eventId) createBody.event_id = eventId;
      const res = await fetch('/api/livestreams', {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(createBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save that glimpse video.');
      navigate('/media');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setSavingStep('');
    }
  }

  const atCap = !isEdit && groupCount !== null && groupCount >= MAX_PER_GROUP;
  const selectedEvent = todaysEvents.find((e) => e.id === eventId) || null;

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="media" />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 60px' }}>
        <button onClick={() => navigate('/media')} style={backLinkStyle}>
          <ArrowLeft size={15} /> Back to Media
        </button>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: '10px 0 6px', fontFamily: "'Playfair Display', Georgia, serif" }}>
          {isEdit ? 'Edit glimpse video' : 'Add event media'}
        </h1>
        <p style={{ color: 'var(--cf-text-muted)', fontSize: '0.85rem', margin: '0 0 20px' }}>
          {isEdit
            ? 'Update the title or who can watch.'
            : `A short glimpse video (${MAX_SECONDS} seconds or less) and/or photos for visitors to see.`}
        </p>

        {error && <div style={errorBoxStyle}>{error}</div>}

        {loading ? (
          <div style={{ color: 'var(--cf-text-muted)', padding: '40px 0', textAlign: 'center' }}>Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {isEdit ? (
              <div style={dateInfoStyle}>
                {existingInfo?.event_id
                  ? `Attached to: an event`
                  : existingInfo?.date
                    ? `Dated ${formatDate(existingInfo.date)}`
                    : ''}
              </div>
            ) : (
              <div>
                {todaysEvents.length === 0 && (
                  <div style={dateInfoStyle}>📅 {formatDate(today)} — no event scheduled today, this will just be dated today.</div>
                )}
                {todaysEvents.length === 1 && selectedEvent && (
                  <div style={dateInfoStyle}>📅 Today's event — <strong>{selectedEvent.title}</strong></div>
                )}
                {todaysEvents.length > 1 && (
                  <div>
                    <div style={{ ...dateInfoStyle, marginBottom: 8 }}>📅 {formatDate(today)} — more than one event today, pick one (optional):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {todaysEvents.map((e) => (
                        <button
                          type="button"
                          key={e.id}
                          onClick={() => { setPickedToday(true); setEventId(eventId === e.id ? null : e.id); }}
                          style={eventId === e.id ? chipSelectedStyle : chipStyle}
                        >
                          {eventId === e.id && <Check size={13} />} {e.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!isEdit && groupCount !== null && (
                  <div style={{ fontSize: '0.78rem', color: atCap ? '#dc2626' : 'var(--cf-text-muted)', marginTop: 8 }}>
                    {groupCount}/{MAX_PER_GROUP} glimpse videos used {atCap ? '— remove one before adding another.' : ''}
                  </div>
                )}
              </div>
            )}

            {!isEdit && (
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{ ...fileDropStyle, ...(dragOver ? fileDropActiveStyle : {}) }}
              >
                <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleFileChange} style={{ display: 'none' }} />
                {file ? (
                  <>
                    <Film size={28} color="var(--cf-accent)" />
                    <div style={{ fontWeight: 700, color: 'var(--cf-text-primary)', marginTop: 8 }}>{file.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>{fileDuration ? `${fileDuration.toFixed(1)}s` : ''} · tap to choose a different video</div>
                  </>
                ) : (
                  <>
                    <UploadCloud size={28} color="var(--cf-text-muted)" />
                    <div style={{ fontWeight: 700, color: 'var(--cf-text-primary)', marginTop: 8 }}>Tap to choose a video, or drag one here</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>MP4, WebM, or MOV · {MAX_SECONDS} seconds or less</div>
                  </>
                )}
              </label>
            )}

            {!isEdit && (
              <div>
                <div style={labelStyle}>Photos (optional)</div>
                <label style={photoDropStyle}>
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoInputChange} style={{ display: 'none' }} />
                  <ImagePlus size={22} color="var(--cf-text-muted)" />
                  <div style={{ fontWeight: 700, color: 'var(--cf-text-primary)', marginTop: 6, fontSize: '0.85rem' }}>Tap to add photos</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>
                    JPEG, PNG, or WebP · up to {MAX_PHOTOS} total{photoCount !== null ? ` · ${photoCount}/${MAX_PHOTOS} used` : ''}
                  </div>
                </label>
                {photoError && <div style={{ ...errorBoxStyle, marginTop: 10, marginBottom: 0 }}>{photoError}</div>}
                {photoQueue.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {photoQueue.map((p, i) => (
                      <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--cf-text-muted)' }}>
                        {p.status === 'done' ? <Check size={13} color="#16a34a" /> : p.status === 'error' ? <X size={13} color="#dc2626" /> : <span style={{ width: 13 }}>…</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ marginLeft: 'auto' }}>{p.status === 'uploading' ? 'Uploading…' : p.status === 'done' ? 'Added' : 'Failed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Field label={isEdit ? 'Title (optional)' : 'Video title (optional)'}>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} style={inputStyle} placeholder="e.g. A quick look at today's celebration" />
            </Field>

            <Field label={isEdit ? 'Viewer access' : 'Video viewer access'}>
              <select value={form.visibility} onChange={(e) => set('visibility', e.target.value)} style={inputStyle}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {(isEdit || file) && (
                <button type="submit" disabled={saving || atCap} style={primaryBtn}>
                  {saving ? (savingStep || 'Saving…') : isEdit ? 'Save changes' : 'Upload glimpse'}
                </button>
              )}
              <button type="button" onClick={() => navigate('/media')} style={secondaryBtn}>{isEdit || file ? 'Cancel' : 'Back to Media'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </label>
  );
}

const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--cf-text-primary)', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)',
  borderRadius: 8, color: 'var(--cf-text-primary)', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif",
};
const dateInfoStyle = {
  fontSize: '0.88rem', color: 'var(--cf-text-primary)', fontFamily: "'DM Sans', sans-serif",
};
const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 20,
  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', color: 'var(--cf-text-primary)',
  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const chipSelectedStyle = {
  ...chipStyle, background: 'var(--cf-accent)', borderColor: 'var(--cf-accent)', color: '#fff', fontWeight: 700,
};
const fileDropStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  width: '100%', padding: '36px 16px', boxSizing: 'border-box',
  background: 'var(--cf-bg-surface)', border: '2px dashed var(--cf-border)', borderRadius: 14,
  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
};
const fileDropActiveStyle = {
  borderColor: 'var(--cf-accent)', background: 'var(--cf-bg-base)',
};
const photoDropStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  width: '100%', padding: '20px 16px', boxSizing: 'border-box',
  background: 'var(--cf-bg-surface)', border: '2px dashed var(--cf-border)', borderRadius: 12,
  cursor: 'pointer',
};
const backLinkStyle = {
  display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
  color: 'var(--cf-text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: 0,
};
const primaryBtn = {
  padding: '11px 20px', borderRadius: 9, border: 'none', background: 'var(--cf-accent)', color: '#fff',
  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const secondaryBtn = {
  padding: '11px 20px', borderRadius: 9, border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)',
  color: 'var(--cf-text-primary)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const errorBoxStyle = {
  marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem',
};
