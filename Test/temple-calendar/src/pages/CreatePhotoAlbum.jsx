/**
 * src/pages/CreatePhotoAlbum.jsx
 * Routes: /media/albums/new (create) and /media/albums/:id (edit/manage)
 *
 * One form for both create and the "Manage" button on Media Overview's
 * Recent albums panel -- when :id is present it loads the existing album
 * (GET /api/photo-albums/:id) and PATCHes it instead of POSTing a new one.
 *
 * The child-safety defaults here (disable_facial_recognition on,
 * hide_contributor_names off by default, download_permission off by
 * default) match the Media spec's "Best access model" table -- an admin
 * has to actively turn recognition/attribution/downloads on for a given
 * album, never the other way around.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';
import { useEvents } from '../hooks/useEvents';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — anyone can watch' },
  { value: 'link_only', label: 'Link only — anyone with the link' },
  { value: 'verified_attendees', label: 'Verified attendees — RSVP or ticket required' },
  { value: 'members_only', label: 'Members only' },
  { value: 'private', label: 'Private' },
  { value: 'hidden', label: 'Hidden / Draft' },
];

export default function CreatePhotoAlbum() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { events } = useEvents();

  const [form, setForm] = useState({
    event_id: '', name: '', cover_photo_url: '', description: '', photographer: '',
    visibility: 'public', download_permission: false, attendee_uploads_enabled: true,
    approval_required: true, publishing_status: 'draft',
    disable_facial_recognition: true, hide_contributor_names: false,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoCount, setPhotoCount] = useState(0);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    [events]
  );

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    fetch(`/api/photo-albums/${id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.album) { setError('Album not found.'); return; }
        const a = data.album;
        setForm({
          event_id: a.event_id || '', name: a.name || '', cover_photo_url: a.cover_photo_url || '',
          description: a.description || '', photographer: a.photographer || '', visibility: a.visibility || 'public',
          download_permission: !!a.download_permission, attendee_uploads_enabled: a.attendee_uploads_enabled !== false,
          approval_required: a.approval_required !== false, publishing_status: a.publishing_status || 'draft',
          disable_facial_recognition: a.disable_facial_recognition !== false, hide_contributor_names: !!a.hide_contributor_names,
        });
        setPhotoCount(a.photo_count || 0);
      })
      .catch(() => setError('Could not load that album.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.event_id) return setError('Choose the event this album belongs to.');
    if (!form.name.trim()) return setError('Give the album a name.');

    setSaving(true);
    const payload = { ...form, name: form.name.trim(), description: form.description.trim(), photographer: form.photographer.trim(), cover_photo_url: form.cover_photo_url.trim() || null };

    try {
      const res = await fetch(isEdit ? `/api/photo-albums/${id}` : '/api/photo-albums', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save that album.');
      navigate('/media');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this album? Photos already uploaded stay in the event, just unlinked from this album.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/photo-albums/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete that album.');
      navigate('/media');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="media" />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        <button onClick={() => navigate('/media')} style={backLinkStyle}>
          <ArrowLeft size={15} /> Back to Media
        </button>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: '10px 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }}>
          {isEdit ? 'Manage photo album' : 'Create photo album'}
        </h1>

        {error && <div style={errorBoxStyle}>{error}</div>}

        {loading ? (
          <div style={{ color: 'var(--cf-text-muted)', padding: '40px 0', textAlign: 'center' }}>Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isEdit && (
              <div style={{ fontSize: '0.82rem', color: 'var(--cf-text-muted)' }}>{photoCount} photo{photoCount === 1 ? '' : 's'} in this album</div>
            )}

            <Field label="Event association">
              <select value={form.event_id} onChange={(e) => set('event_id', e.target.value)} style={inputStyle} required>
                <option value="">Select an event…</option>
                {sortedEvents.map((e) => (
                  <option key={e.id} value={e.id}>{e.title} — {e.date}</option>
                ))}
              </select>
            </Field>

            <Field label="Album name">
              <input value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="e.g. Navratri Begins — Photos" required />
            </Field>

            <Field label="Description">
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Cover photo URL">
                <input value={form.cover_photo_url} onChange={(e) => set('cover_photo_url', e.target.value)} style={inputStyle} placeholder="https://…" />
              </Field>
              <Field label="Photographer attribution">
                <input value={form.photographer} onChange={(e) => set('photographer', e.target.value)} style={inputStyle} placeholder="Optional" />
              </Field>
            </div>

            <Field label="Visibility">
              <select value={form.visibility} onChange={(e) => set('visibility', e.target.value)} style={inputStyle}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </Field>

            <Field label="Publishing status">
              <select value={form.publishing_status} onChange={(e) => set('publishing_status', e.target.value)} style={inputStyle}>
                <option value="draft">Draft — admins only</option>
                <option value="published">Published — live per its visibility</option>
              </select>
            </Field>

            <div style={{ borderTop: '1px solid var(--cf-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckboxField label="Allow downloads" checked={form.download_permission} onChange={(v) => set('download_permission', v)} />
              <CheckboxField label="Allow attendees to upload photos" checked={form.attendee_uploads_enabled} onChange={(v) => set('attendee_uploads_enabled', v)} />
              <div style={{ fontSize: '0.76rem', color: 'var(--cf-text-muted)', marginLeft: 24, marginTop: -6 }}>
                Attendee uploads always enter the moderation queue first — they never publish automatically.
              </div>
              <CheckboxField label="Require admin approval for photos an admin adds directly" checked={form.approval_required} onChange={(v) => set('approval_required', v)} />
              <CheckboxField label="Disable facial recognition for this album" checked={form.disable_facial_recognition} onChange={(v) => set('disable_facial_recognition', v)} />
              <CheckboxField label="Hide contributor names publicly" checked={form.hide_contributor_names} onChange={(v) => set('hide_contributor_names', v)} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving} style={primaryBtn}>
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create album'}
                </button>
                <button type="button" onClick={() => navigate('/media')} style={secondaryBtn}>Cancel</button>
              </div>
              {isEdit && (
                <button type="button" onClick={handleDelete} disabled={saving} style={dangerBtn}>Delete album</button>
              )}
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

function CheckboxField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      <span style={{ fontSize: '0.88rem', color: 'var(--cf-text-primary)' }}>{label}</span>
    </label>
  );
}

const labelStyle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--cf-text-primary)', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)',
  borderRadius: 8, color: 'var(--cf-text-primary)', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif",
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
const dangerBtn = {
  padding: '11px 20px', borderRadius: 9, border: '1px solid #f8717166', background: '#fff',
  color: '#dc2626', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
};
const errorBoxStyle = {
  marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem',
};
