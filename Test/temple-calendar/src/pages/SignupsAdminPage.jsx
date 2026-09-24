/**
 * src/pages/SignupsAdminPage.jsx
 * Route: /signups-admin
 *
 * Admin home for the Sign-Up Sheets feature (server/routes/signups.js) --
 * create Volunteer-shift or Potluck-dish sheets against an event, watch
 * slots fill up (with waitlists once a slot's full), and pull the
 * volunteer-hours report. Same page shell/auth pattern as
 * PhotoModerationPage.jsx: AdminToolbar + useAuth's token for the
 * admin-only /api/signups/* routes.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { useAuth } from '../contexts/AuthContext';
import AdminToolbar from '../components/AdminToolbar';
import { getSignupUrl } from '../utils/rsvpUrl';
import { playSuccess } from '../utils/sound';
import { getDefaultSignupType, SHEET_TYPE_LABELS } from '../utils/signupTemplates';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function blankSlot(type) {
  return type === 'volunteer'
    ? { label: '', time_label: '', hours: '', capacity: 3 }
    : { label: '', capacity: 4 };
}

function fmtHours(h) {
  const n = Math.round(h * 10) / 10;
  return `${n} hr${n === 1 ? '' : 's'}`;
}

// "Connect" -> Documents: doc type -> icon/label (server/routes/documents.js).
const DOC_TYPE_META = {
  google_form: { icon: '📝', label: 'Google Form' },
  drive_file: { icon: '📁', label: 'Drive file' },
  upload_xlsx: { icon: '📈', label: 'Uploaded Excel' },
  upload_docx: { icon: '📝', label: 'Uploaded Word doc' },
};

export default function SignupsAdminPage() {
  const navigate = useNavigate();
  const { events } = useEvents();
  const { organization } = useAuth();
  // Sign-Up Sheets and Volunteer Hours are on the roadmap for a rework —
  // their tabs are hidden for now (code/routes/data untouched, easy to
  // bring back) so 'documents' is the only reachable tab.
  const [tab, setTab] = useState('documents'); // 'sheets' | 'hours' | 'documents'

  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [eventId, setEventId] = useState('');
  const [type, setType] = useState('volunteer');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [slots, setSlots] = useState([blankSlot('volunteer')]);
  const [earlyAccessHours, setEarlyAccessHours] = useState('0');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const [hours, setHours] = useState(null);
  const [hoursLoading, setHoursLoading] = useState(false);

  // ── "Connect" -> Documents state ──────────────────────────────────────
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [googleStatus, setGoogleStatus] = useState(null); // { googleConfigured, voyageConfigured, googleConnected }
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleBanner, setGoogleBanner] = useState(''); // 'connected' | 'error' | ''
  const [showDriveLink, setShowDriveLink] = useState(false);
  const [driveLinkUrl, setDriveLinkUrl] = useState('');
  const [driveLinkBusy, setDriveLinkBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [docActionError, setDocActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null); // { answer, sources }
  const [searchError, setSearchError] = useState('');

  const defaultType = useMemo(() => getDefaultSignupType(organization?.category), [organization]);

  const loadSheets = useCallback(async () => {
    try {
      const res = await fetch('/api/signups/sheets', { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sign-up sheets');
      setSheets(data.sheets || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetches while the (currently hidden) Sign-Up Sheets tab is
  // reachable — no point spending a request on every page load for a tab
  // nobody can get to right now.
  useEffect(() => { if (tab === 'sheets') loadSheets(); }, [tab, loadSheets]);

  // Full sheet detail (slots + roster) is only fetched for sheets actually
  // shown expanded -- the /sheets list above is metadata-only.
  const [detail, setDetail] = useState({}); // sheet_id -> full sheet view
  const [expanded, setExpanded] = useState({}); // sheet_id -> bool

  const loadDetail = async (sheet_id) => {
    try {
      const res = await fetch(`/api/signups/sheets/${sheet_id}`, { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load that sheet');
      setDetail((prev) => ({ ...prev, [sheet_id]: data.sheet }));
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleExpand = (sheet_id) => {
    setExpanded((prev) => ({ ...prev, [sheet_id]: !prev[sheet_id] }));
    if (!detail[sheet_id]) loadDetail(sheet_id);
  };

  const eventById = useMemo(() => {
    const m = new Map();
    events.forEach((e) => m.set(e.id, e));
    return m;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...events].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // ── Create form ──────────────────────────────────────────────────────

  const openCreate = () => {
    setType(defaultType);
    setSlots([blankSlot(defaultType)]);
    setEventId(upcomingEvents[0]?.id || '');
    setTitle('');
    setTitleTouched(false);
    setEarlyAccessHours('0');
    setCreateError('');
    setShowCreate(true);
  };

  useEffect(() => {
    if (!showCreate || titleTouched) return;
    const ev = eventById.get(eventId);
    if (!ev) return;
    setTitle(`${ev.title} — ${SHEET_TYPE_LABELS[type].label}`);
  }, [eventId, type, showCreate, titleTouched, eventById]);

  const setSlotField = (i, field, value) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };
  const addSlot = () => setSlots((prev) => [...prev, blankSlot(type)]);
  const removeSlot = (i) => setSlots((prev) => prev.filter((_, idx) => idx !== i));
  const switchType = (t) => { setType(t); setSlots([blankSlot(t)]); };

  const submitCreate = async () => {
    setCreateError('');
    if (!eventId) return setCreateError('Pick an event.');
    if (!title.trim()) return setCreateError('Give this sheet a title.');
    const cleanSlots = slots
      .map((s) => ({
        label: (s.label || '').trim(),
        capacity: Math.max(1, parseInt(s.capacity, 10) || 1),
        time_label: type === 'volunteer' ? (s.time_label || '').trim() : undefined,
        duration_minutes: type === 'volunteer' ? Math.round((parseFloat(s.hours) || 0) * 60) : undefined,
      }))
      .filter((s) => s.label);
    if (cleanSlots.length === 0) return setCreateError(`Add at least one ${SHEET_TYPE_LABELS[type].slotNoun}.`);

    setSaving(true);
    try {
      const ev = eventById.get(eventId);
      const res = await fetch('/api/signups/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ event_id: eventId, type, title: title.trim(), event_date: ev?.date, slots: cleanSlots, early_access_hours: parseInt(earlyAccessHours, 10) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create that sheet.');
      setShowCreate(false);
      await loadSheets();
      playSuccess();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeSheet = async (sheet_id) => {
    if (!window.confirm('Delete this sign-up sheet? Everyone already signed up will be removed too.')) return;
    setBusyId(sheet_id);
    try {
      const res = await fetch(`/api/signups/sheets/${sheet_id}`, { method: 'DELETE', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete that sheet.');
      setSheets((prev) => prev.filter((s) => s.sheet_id !== sheet_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (event) => {
    if (!event) return;
    try { await navigator.clipboard.writeText(getSignupUrl(event)); } catch { /* clipboard unavailable */ }
  };

  // "Announce this sheet" — hands a ready-made caption off to Broadcast
  // (the top-level nav page, not the per-flyer modal) instead of trying to
  // send anything itself. Broadcast only exists as an overlay on /admin, so
  // this reuses the same pendingAction handoff every other page already
  // uses to open it (see App.jsx's location.state.pendingAction effect) —
  // just with an extra broadcastCaption alongside it for Broadcast to
  // preload into its message box. Nothing is sent automatically; the admin
  // still picks channels and hits Send on the Broadcast page themselves.
  const announceSheet = (sheet, event) => {
    if (!event) return;
    const typeLabel = SHEET_TYPE_LABELS[sheet.type]?.label || 'Sign-Up Sheet';
    const caption = `🙋 ${typeLabel} — ${event.title}
📅 ${sheet.event_date}

Spots are open — sign up here: ${getSignupUrl(event)}`;
    navigate('/admin', { state: { pendingAction: 'broadcast', broadcastCaption: caption } });
  };

  // ── Volunteer hours ──────────────────────────────────────────────────

  const loadHours = useCallback(async () => {
    setHoursLoading(true);
    try {
      const res = await fetch('/api/signups/volunteer-hours', { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load the volunteer-hours report');
      setHours(data.members || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setHoursLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === 'hours' && hours === null) loadHours(); }, [tab, hours, loadHours]);


  const exportHoursCsv = () => {
    const rows = [['Name', 'Total Hours', 'Shifts'], ...(hours || []).map((m) => [m.member_name, m.total_hours, m.shifts_count])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'volunteer-hours.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── "Connect" -> Documents ───────────────────────────────────────────

  // A brand-new route can come back with an empty/non-JSON body (server not
  // restarted yet since it was added, a proxy error page, a request that
  // timed out mid-response) — res.json() throws a raw, confusing
  // "Unexpected end of JSON input" in that case. Every Documents call below
  // goes through this so a broken server-side setup shows a plain-English
  // message instead of that parser error.
  const parseJsonSafe = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };
  const SETUP_HINT = "Didn't get a valid response from the server — if this feature was just added, make sure the server was restarted (and npm install / the database setup step were run) after that.";

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch('/api/documents', { headers: { ...authHeaders() } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      setDocs(data.documents || []);
      setDocsError('');
    } catch (err) {
      setDocsError(err.message);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/google/status', { headers: { ...authHeaders() } });
      const data = await parseJsonSafe(res);
      if (res.ok && data) {
        setGoogleStatus(data);
      } else {
        // Distinct from "not configured" — this means the check itself
        // failed, so the UI shouldn't sit on "Checking…" forever nor claim
        // to know the real status.
        setGoogleStatus({ googleConfigured: false, voyageConfigured: false, googleConnected: false, checkFailed: true });
      }
    } catch {
      setGoogleStatus({ googleConfigured: false, voyageConfigured: false, googleConnected: false, checkFailed: true });
    }
  }, []);

  useEffect(() => {
    if (tab !== 'documents') return;
    loadDocs();
    loadGoogleStatus();
  }, [tab, loadDocs, loadGoogleStatus]);

  // Picks up ?tab=documents&google=connected|error, which is exactly the
  // query string routes/documents.js's OAuth callback redirects back to
  // after Google — see that route's file header.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'documents') {
      setTab('documents');
      const g = params.get('google');
      if (g) setGoogleBanner(g);
      window.history.replaceState({}, '', '/signups-admin');
    }
  }, []);

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    setDocActionError('');
    try {
      const res = await fetch('/api/documents/google/connect', { headers: { ...authHeaders() } });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      window.location.href = data.url; // hands off to Google's consent screen
    } catch (err) {
      setDocActionError(err.message);
      setConnectingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google? You can reconnect any time.')) return;
    try {
      const res = await fetch('/api/documents/google/disconnect', { method: 'POST', headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('Could not disconnect Google.');
      await loadGoogleStatus();
    } catch (err) {
      setDocActionError(err.message);
    }
  };

  const createGoogleFormDoc = async () => {
    const formTitle = window.prompt('Name for the new Google Form:');
    if (!formTitle || !formTitle.trim()) return;
    setDocActionError('');
    try {
      const res = await fetch('/api/documents/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: formTitle.trim() }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      await loadDocs();
      playSuccess();
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDocActionError(err.message);
    }
  };

  const submitDriveLink = async () => {
    if (!driveLinkUrl.trim()) return;
    setDriveLinkBusy(true);
    setDocActionError('');
    try {
      const res = await fetch('/api/documents/drive-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: driveLinkUrl.trim() }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      setDriveLinkUrl('');
      setShowDriveLink(false);
      await loadDocs();
      playSuccess();
    } catch (err) {
      setDocActionError(err.message);
    } finally {
      setDriveLinkBusy(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadBusy(true);
    setDocActionError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documents/upload', { method: 'POST', headers: { ...authHeaders() }, body: formData });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      await loadDocs();
      playSuccess();
    } catch (err) {
      setDocActionError(err.message);
    } finally {
      setUploadBusy(false);
      e.target.value = '';
    }
  };

  const deleteDoc = async (doc_id) => {
    if (!window.confirm('Remove this document from the library?')) return;
    try {
      const res = await fetch(`/api/documents/${doc_id}`, { method: 'DELETE', headers: { ...authHeaders() } });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete that document.');
      }
      setDocs((prev) => prev.filter((d) => d.doc_id !== doc_id));
    } catch (err) {
      setDocActionError(err.message);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok || !data) throw new Error((data && data.error) || SETUP_HINT);
      setSearchResult(data);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)} style={{
      padding: '9px 16px', borderRadius: 8, border: '1px solid var(--cf-border)',
      background: tab === key ? 'var(--cf-text-primary)' : 'var(--cf-bg-surface)',
      color: tab === key ? '#fff' : 'var(--cf-text-secondary)',
      fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <AdminToolbar activePage="signups" />
      <div style={{ padding: 20 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--cf-text-primary)', fontFamily: "'Playfair Display', Georgia, serif" }}>
                ✨ AI-Powered Search
              </div>
              <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                For your org's library — Google Forms, Drive files, and documents, all in one place.
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {tab === 'sheets' && (
            <>
              <div style={{ marginBottom: 18 }}>
                {!showCreate ? (
                  <button onClick={openCreate} style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--cf-btn-bg)',
                    color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  }}>+ New Sign-Up Sheet</button>
                ) : (
                  <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 18 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--cf-text-primary)', marginBottom: 14, fontFamily: "'Playfair Display', Georgia, serif" }}>New Sign-Up Sheet</div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      {['volunteer', 'potluck'].map((t) => (
                        <button key={t} onClick={() => switchType(t)} style={{
                          padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                          border: type === t ? '1.5px solid var(--cf-accent)' : '1px solid var(--cf-border)',
                          background: type === t ? 'rgba(146,64,14,0.08)' : 'var(--cf-bg-base)',
                          color: type === t ? 'var(--cf-accent)' : 'var(--cf-text-secondary)',
                        }}>{SHEET_TYPE_LABELS[t].icon} {SHEET_TYPE_LABELS[t].label}</button>
                      ))}
                      <span style={{ fontSize: '0.72rem', color: 'var(--cf-text-muted)', alignSelf: 'center' }}>
                        {defaultType === type ? '(default for your org type)' : ''}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cf-text-muted)', display: 'block', marginBottom: 4 }}>Event</label>
                        <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={inputStyle}>
                          <option value="">Select an event…</option>
                          {upcomingEvents.map((e) => <option key={e.id} value={e.id}>{e.title} — {e.date}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cf-text-muted)', display: 'block', marginBottom: 4 }}>Sheet title</label>
                        <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cf-text-muted)', marginBottom: 6 }}>
                      {type === 'volunteer' ? 'Shifts' : 'Dish categories'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {slots.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input placeholder={type === 'volunteer' ? 'e.g. Setup Crew' : 'e.g. Rice Items'} value={s.label} onChange={(e) => setSlotField(i, 'label', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
                          {type === 'volunteer' && (
                            <>
                              <input placeholder="e.g. 8:00 – 9:30 AM" value={s.time_label} onChange={(e) => setSlotField(i, 'time_label', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
                              <input type="number" min="0" step="0.5" placeholder="Hours" value={s.hours} onChange={(e) => setSlotField(i, 'hours', e.target.value)} style={{ ...inputStyle, width: 80 }} />
                            </>
                          )}
                          <input type="number" min="1" placeholder="Capacity" value={s.capacity} onChange={(e) => setSlotField(i, 'capacity', e.target.value)} style={{ ...inputStyle, width: 90 }} />
                          <button onClick={() => removeSlot(i)} disabled={slots.length === 1} style={{ background: 'none', border: 'none', color: slots.length === 1 ? 'var(--cf-text-muted)' : '#dc2626', cursor: slots.length === 1 ? 'default' : 'pointer', fontSize: '1rem', padding: 4 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addSlot} style={{ background: 'none', border: 'none', color: 'var(--cf-accent)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginBottom: 16 }}>+ Add {SHEET_TYPE_LABELS[type].slotNoun}</button>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cf-text-muted)', display: 'block', marginBottom: 4 }}>
                        👥 Early access for followers
                      </label>
                      <select value={earlyAccessHours} onChange={(e) => setEarlyAccessHours(e.target.value)} style={inputStyle}>
                        <option value="0">Off — open to everyone right away</option>
                        <option value="24">24 hours before opening to everyone</option>
                        <option value="48">48 hours before opening to everyone</option>
                        <option value="72">72 hours before opening to everyone</option>
                      </select>
                      <div style={{ fontSize: '0.7rem', color: 'var(--cf-text-muted)', marginTop: 4 }}>
                        People who follow your temple can join this sheet immediately; everyone else has to wait out this window.
                      </div>
                    </div>

                    {createError && <div style={{ marginBottom: 10, color: '#dc2626', fontSize: '0.8rem' }}>{createError}</div>}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={submitCreate} disabled={saving} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--cf-btn-bg)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? 'Creating…' : 'Create Sheet'}
                      </button>
                      <button onClick={() => setShowCreate(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--cf-border)', background: 'var(--cf-bg-base)', color: 'var(--cf-text-secondary)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--cf-text-muted)' }}>⏳ Loading…</div>
              ) : sheets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--cf-text-muted)' }}>No sign-up sheets yet — create one above.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sheets.map((s) => {
                    const ev = eventById.get(s.event_id);
                    const d = detail[s.sheet_id];
                    const isOpen = !!expanded[s.sheet_id];
                    return (
                      <div key={s.sheet_id} style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, overflow: 'hidden' }}>
                        <div onClick={() => toggleExpand(s.sheet_id)} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 10, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--cf-text-primary)' }}>
                              {SHEET_TYPE_LABELS[s.type]?.icon} {s.title}
                            </div>
                            <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.76rem', marginTop: 2 }}>
                              {ev ? ev.title : 'Unknown event'} · {s.event_date}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); copyLink(ev); }} disabled={!ev} style={smallBtnStyle}>🔗 Copy link</button>
                            <button onClick={(e) => { e.stopPropagation(); announceSheet(s, ev); }} disabled={!ev} style={smallBtnStyle}>📣 Announce</button>
                            <button onClick={(e) => { e.stopPropagation(); removeSheet(s.sheet_id); }} disabled={busyId === s.sheet_id} style={{ ...smallBtnStyle, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}>🗑</button>
                            <span style={{ color: 'var(--cf-text-muted)', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--cf-border)', padding: '12px 18px' }}>
                            {!d ? (
                              <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.82rem' }}>Loading…</div>
                            ) : (
                              d.slots.map((slot) => (
                                <div key={slot.slot_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--cf-bg-deep)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <div>
                                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--cf-text-primary)' }}>{slot.label}</span>
                                      {slot.time_label && <span style={{ color: 'var(--cf-text-muted)', fontSize: '0.76rem', marginLeft: 8 }}>🕐 {slot.time_label}</span>}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: slot.confirmed.length >= slot.capacity ? '#16a34a' : 'var(--cf-accent)' }}>
                                      {slot.confirmed.length} / {slot.capacity}
                                    </span>
                                  </div>
                                  {slot.confirmed.length > 0 && (
                                    <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--cf-text-secondary)' }}>
                                      {slot.confirmed.map((e) => e.name + (e.dish ? ` (${e.dish})` : '')).join(', ')}
                                    </div>
                                  )}
                                  {slot.waitlist.length > 0 && (
                                    <div style={{ marginTop: 4, fontSize: '0.76rem', color: '#b45309' }}>
                                      ⏳ Waitlist ({slot.waitlist.length}): {slot.waitlist.map((e) => e.name).join(', ')}
                                    </div>
                                  )}
                                  {slot.confirmed.length === 0 && slot.waitlist.length === 0 && (
                                    <div style={{ marginTop: 4, fontSize: '0.76rem', color: 'var(--cf-text-muted)', fontStyle: 'italic' }}>No one yet</div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'hours' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <button onClick={exportHoursCsv} disabled={!hours || hours.length === 0} style={smallBtnStyle}>⬇ Export CSV</button>
              </div>
              {hoursLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--cf-text-muted)' }}>⏳ Loading…</div>
              ) : !hours || hours.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--cf-text-muted)' }}>No confirmed volunteer shifts yet.</div>
              ) : (
                <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cf-text-muted)', borderBottom: '1px solid var(--cf-border)' }}>
                    <span>Name</span><span>Hours</span><span>Shifts</span>
                  </div>
                  {hours.map((m) => (
                    <div key={m.member_id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px', padding: '10px 16px', fontSize: '0.85rem', borderBottom: '1px solid var(--cf-bg-deep)' }}>
                      <span style={{ color: 'var(--cf-text-primary)', fontWeight: 600 }}>{m.member_name}</span>
                      <span style={{ color: 'var(--cf-accent)', fontWeight: 700 }}>{fmtHours(m.total_hours)}</span>
                      <span style={{ color: 'var(--cf-text-muted)' }}>{m.shifts_count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div>
              {googleBanner === 'connected' && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, color: '#16a34a', fontSize: '0.85rem' }}>
                  ✓ Google account connected.
                </div>
              )}
              {googleBanner === 'error' && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
                  Couldn't connect Google — please try again.
                </div>
              )}
              {docActionError && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
                  {docActionError}
                </div>
              )}

              {/* Google connection */}
              <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 16, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cf-text-primary)' }}>Google account</div>
                  <div style={{ color: googleStatus && googleStatus.checkFailed ? '#dc2626' : 'var(--cf-text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                    {!googleStatus ? 'Checking…' :
                      googleStatus.checkFailed ? "Couldn't reach the server to check this — make sure it was restarted after this feature was set up, then reload this page." :
                      !googleStatus.googleConfigured ? "Not set up yet — ask your developer to add Google credentials to the server." :
                      googleStatus.googleConnected ? 'Connected — you can create Forms and link Drive files.' :
                      'Connect a Google account to create Forms or link Drive files.'}
                  </div>
                </div>
                {googleStatus && googleStatus.googleConfigured && (
                  googleStatus.googleConnected ? (
                    <button onClick={disconnectGoogle} style={smallBtnStyle}>Disconnect</button>
                  ) : (
                    <button onClick={connectGoogle} disabled={connectingGoogle} style={{ ...smallBtnStyle, background: 'var(--cf-btn-bg)', color: '#fff', borderColor: 'transparent' }}>
                      {connectingGoogle ? 'Connecting…' : 'Connect Google'}
                    </button>
                  )
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                <button
                  onClick={createGoogleFormDoc}
                  disabled={!(googleStatus && googleStatus.googleConnected)}
                  style={{ ...smallBtnStyle, opacity: googleStatus && googleStatus.googleConnected ? 1 : 0.5 }}
                  title={googleStatus && googleStatus.googleConnected ? '' : 'Connect Google first'}
                >
                  + New Google Form
                </button>
                <button
                  onClick={() => setShowDriveLink((v) => !v)}
                  disabled={!(googleStatus && googleStatus.googleConnected)}
                  style={{ ...smallBtnStyle, opacity: googleStatus && googleStatus.googleConnected ? 1 : 0.5 }}
                  title={googleStatus && googleStatus.googleConnected ? '' : 'Connect Google first'}
                >
                  🔗 Link a Drive file
                </button>
                <label style={{ ...smallBtnStyle, display: 'inline-flex', alignItems: 'center', cursor: uploadBusy ? 'default' : 'pointer', opacity: uploadBusy ? 0.6 : 1 }}>
                  {uploadBusy ? 'Uploading…' : '⬆ Upload Excel / Word'}
                  <input type="file" accept=".xlsx,.xls,.docx" onChange={handleFileUpload} disabled={uploadBusy} style={{ display: 'none' }} />
                </label>
              </div>

              {showDriveLink && (
                <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 10, padding: 14, marginBottom: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    value={driveLinkUrl}
                    onChange={(e) => setDriveLinkUrl(e.target.value)}
                    placeholder="Paste a Google Drive/Docs/Sheets share link…"
                    style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                  />
                  <button onClick={submitDriveLink} disabled={driveLinkBusy || !driveLinkUrl.trim()} style={{ ...smallBtnStyle, background: 'var(--cf-btn-bg)', color: '#fff', borderColor: 'transparent' }}>
                    {driveLinkBusy ? 'Linking…' : 'Link it'}
                  </button>
                </div>
              )}

              {/* Document list */}
              {docsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--cf-text-muted)' }}>⏳ Loading…</div>
              ) : docsError ? (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 18 }}>{docsError}</div>
              ) : docs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--cf-text-muted)', fontSize: '0.85rem' }}>No documents linked yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {docs.map((d) => (
                    <div key={d.doc_id} style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cf-text-primary)' }}>
                          {(DOC_TYPE_META[d.type] || { icon: '📄' }).icon} {d.title}
                          {!d.searchable && (
                            <span style={{ marginLeft: 8, fontSize: '0.68rem', color: 'var(--cf-text-muted)', fontWeight: 400 }}>
                              (not searchable — semantic search isn't set up)
                            </span>
                          )}
                        </div>
                        {d.excerpt && (
                          <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.74rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                            {d.excerpt}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ ...smallBtnStyle, textDecoration: 'none' }}>Open</a>}
                        <button onClick={() => deleteDoc(d.doc_id)} style={{ ...smallBtnStyle, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI search */}
              <div style={{ background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--cf-text-primary)', marginBottom: 4, fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Ask about your events & documents
                </div>
                <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.78rem', marginBottom: 12 }}>
                  Searches your upcoming events, sign-up sheets, and linked documents — the answer is generated only from what's actually there.
                </div>
                {googleStatus && !googleStatus.voyageConfigured && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, color: '#b45309', fontSize: '0.78rem' }}>
                    Semantic search isn't set up yet — ask your developer to add a Voyage AI key to the server.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                    placeholder="e.g. What volunteer shifts still need people this month?"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={runSearch}
                    disabled={searching || !searchQuery.trim() || !(googleStatus && googleStatus.voyageConfigured)}
                    style={{ ...smallBtnStyle, background: 'var(--cf-btn-bg)', color: '#fff', borderColor: 'transparent', opacity: googleStatus && googleStatus.voyageConfigured ? 1 : 0.5 }}
                  >
                    {searching ? 'Thinking…' : 'Ask'}
                  </button>
                </div>
                {searchError && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: 10 }}>{searchError}</div>}
                {searchResult && (
                  <div style={{ background: 'var(--cf-bg-base)', border: '1px solid var(--cf-border)', borderRadius: 10, padding: 14 }}>
                    <div style={{
                      display: 'inline-block', marginBottom: 10, padding: '3px 9px', borderRadius: 20,
                      background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.35)',
                      color: '#b45309', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase',
                    }}>
                      ✨ AI-generated summary
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.86rem', color: 'var(--cf-text-primary)', lineHeight: 1.6 }}>{searchResult.answer}</div>
                    {searchResult.sources && searchResult.sources.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--cf-border)', fontSize: '0.74rem', color: 'var(--cf-text-muted)' }}>
                        Sources: {searchResult.sources.map((s) => s.title).join(', ')}
                      </div>
                    )}
                    {searchResult.disclaimer && (
                      <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--cf-text-muted)', fontStyle: 'italic' }}>
                        {searchResult.disclaimer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', boxSizing: 'border-box',
  background: 'var(--cf-bg-base)', border: '1px solid var(--cf-border)',
  borderRadius: 7, color: 'var(--cf-text-primary)', fontSize: '0.84rem',
};

const smallBtnStyle = {
  padding: '6px 10px', borderRadius: 7, border: '1px solid var(--cf-border)',
  background: 'var(--cf-bg-base)', color: 'var(--cf-text-secondary)',
  fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
};
