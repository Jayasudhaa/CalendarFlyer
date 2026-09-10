import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, ArrowLeft, Save, Facebook, Instagram, Mail, Megaphone, Trash2 } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';
import { useAuth } from '../contexts/AuthContext';
import { playSend } from '../utils/sound';

const P = {
  get bg()     { return 'var(--cf-bg-base)' },
  get bg2()    { return 'var(--cf-bg-deep)' },
  get card()   { return 'var(--cf-bg-card)' },
  get border() { return 'var(--cf-border)' },
  // Darkened from the theme's default brown text vars — this page's body
  // copy was reading too light/thin against the pastel cards.
  get text()   { return '#000000' },
  // Was var(--cf-accent) (gold-brown) — this page's own accent, so it's
  // scoped to just this getter rather than touching the shared token used
  // elsewhere (TODAY badge, headings). Black & white redesign.
  get gold()   { return '#000000' },
  // Darkened further (was #3f3f46 / #71717a) — labels and secondary/hint
  // text were reading too thin and light-gray against the white cards.
  get muted()  { return '#18181b' },
  get faint()  { return '#3f3f46' },
  get deep()   { return 'var(--cf-bg-deep)' },
};
// Facebook/Instagram use their real lucide-react brand-mark icons (colored
// via `color` below) instead of the 📘/📸 emoji placeholders, which read as
// generic clip-art rather than the actual platform. WhatsApp keeps its chat-
// bubble emoji — lucide has no WhatsApp glyph to swap in.
const PLATFORMS = [
  { id:'whatsapp', label:'WhatsApp',      icon:'💬', color:'#25d366', description:'Temple community group',  setup:true  },
  { id:'facebook', label:'Facebook Page', Icon:Facebook, color:'#1877f2', description:'Needs FB_PAGE_TOKEN',      setup:false },
  { id:'instagram',label:'Instagram',     Icon:Instagram, color:'#e1306c', description:'Needs IG_ACCOUNT_ID',      setup:false },
  { id:'email',    label:'Email List',    Icon:Mail, color:'#6366f1', description:'Set under Settings → Broadcast', setup:false },
];
const TEMPLATES = [
  { label:'🙏 Pooja Invite', text:`🪔 *Temple Pooja Ceremony*\n\nYou are warmly invited to join us for a sacred pooja ceremony.\n\n🌸 Sample Temple Name\n\n📋 RSVP & details: https://calendarflyapp.com/calendar` },
  { label:'🎉 Festival',     text:`🎊 *Festival Celebrations!*\n\nJoin our temple family for this auspicious occasion filled with devotion, culture, and community.\n\nAll are welcome! 🙏\n\n🌸 Sample Temple Name\n📋 RSVP: https://calendarflyapp.com/calendar` },
  { label:'📢 Announcement', text:`📢 *Important Announcement*\n\nPlease mark your calendars and share with your family and friends.\n\n🌸 Sample Temple Name\n📋 Details: https://calendarflyapp.com/calendar` },
];
// Premium-pass icon badges — same glossy-black badge recipe used in the
// Flyer Studio's Event & Text panel, reused here for every card header on
// this page so sections read as distinct, considered groups.
const GLOSS_BLACK = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)';
const GLOSS_SHADOW = '0 2px 6px -2px rgba(0,0,0,0.5)';
function IconBadge({ icon, size = 24 }) {
  return (
    <span style={{ width:size, height:size, borderRadius:7, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.55, background:GLOSS_BLACK, color:'#fff', boxShadow:GLOSS_SHADOW }}>{icon}</span>
  );
}
const WA_TEMPLATES = [
  {
    id: 'temple_event_announcement',
    label: '🙏 Temple Event Announcement',
    description: 'Approved Meta template with event details + RSVP',
    vars: [
      { key: '{{1}}', label: 'Event Name',  placeholder: 'e.g. Hanuman Jayanti Celebration' },
      { key: '{{2}}', label: 'Date',         placeholder: 'e.g. May 12, 2026' },
      { key: '{{3}}', label: 'Time',         placeholder: 'e.g. 10:00 AM' },
      { key: '{{4}}', label: 'RSVP Link',    placeholder: 'https://calendarflyapp.com/rsvp/...' },
    ],
    preview: (v) => `Hello,\n🙏 *${v[0]||'{{1}}'}*\n📅 ${v[1]||'{{2}}'} at ${v[2]||'{{3}}'}\n📍 Sample Temple Name, Your City\n\nJoin us and receive blessings. RSVP here: ${v[3]||'{{4}}'}\n\nThank you`,
  },
];
// Decorative progress tracker shown in the page header — every section is
// always visible on one scrollable page (nothing is actually gated behind a
// step), so this just reflects how far along the current draft is.
const STEPS = [
  { key:'channels', label:'Channels' },
  { key:'creative',  label:'Creative' },
  { key:'message',   label:'Message' },
  { key:'review',    label:'Review' },
];
const DRAFT_KEY = 'cf_broadcast_draft';

// Same soft warm-gold halo background used on the admin calendar page —
// applied consistently across every admin page (Broadcast, Flyer, Analytics,
// My Profile, Subscription, Settings) instead of each having its own look.
// Was a warm-gold radial halo (var(--cf-accent-glow) x3) — dropped for a
// flat pure-white page background as part of the black & white redesign
// (same fix as App.jsx/CalendarGrid.jsx/MyProfile.jsx).
// Hardcoded pure white rather than the --cf-bg-base token — the token
// resolves to white too, but the page was still reading slightly gray/tinted
// against the elevated cards' shadows, so this pins it down explicitly.
const HALO_BG = { backgroundColor: '#ffffff' };

export default function BroadcastPage({ onClose, initialCaption }) {
  const navigate = useNavigate();
  const { organization } = useAuth();
  // The public calendar link auto-included in broadcasts -- used to be a
  // single hardcoded link shared by every organization on the platform,
  // which pointed at calendarflyapp.com's bare domain with no org context
  // at all, so it 404'd for everyone (confirmed in production logs:
  // "No organization found for this domain"). The ?org= query param
  // resolves this org without needing subdomain DNS -- see tenantMiddleware
  // in server/middleware/tenant.js -- and works today regardless of the
  // *.calendarflyapp.com wildcard domain's cert-validation status.
  const rsvpUrl = organization?.subdomain
    ? `https://calendarflyapp.com/calendar?org=${encodeURIComponent(organization.subdomain)}`
    : 'https://calendarflyapp.com/calendar';
  const [selected, setSelected]         = useState({ whatsapp: true, facebook: false, instagram: false });
  const [caption,  setCaption]          = useState('');
  const [autoRSVP, setAutoRSVP]         = useState(true);
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [mediaSizeMB, setMediaSizeMB] = useState(null);
  const [copied, setCopied] = useState(false);
  const [status,   setStatus]           = useState({});
  const [errors,   setErrors]           = useState({});
  const [allDone,  setAllDone]          = useState(false);
  // True if ANY platform in the last send actually went out in test mode
  // (dev credentials / *_TEST_MODE=true — see GET /api/broadcast/mode and
  // routes/broadcast.js's testMode flag on the send response). The success
  // banner below reads this so a test send never looks identical to a real
  // one to the admin.
  const [anyTestMode, setAnyTestMode] = useState(false);
  // setStatus(ns) at the top of handleBroadcast doesn't take effect until
  // the next render, so `isSending` (derived from `status`) still reads
  // false to a second click that lands before that render commits — a
  // double-click or a slow first click could fire two overlapping sends.
  // This ref is set synchronously and is the real re-entry guard.
  const sendingRef = useRef(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  // WhatsApp API Template state
  const [showWATemplate, setShowWATemplate]   = useState(false);
  const [selectedWATemplate, setSelectedWATemplate] = useState(WA_TEMPLATES[0]);
  const [waVars, setWaVars]                   = useState(['', '', '', rsvpUrl]);
  const [waSending, setWaSending]             = useState(false);
  const [waResult,  setWaResult]              = useState(null);

  // Compose vs. History — see the History panel further down. A simple
  // page-level toggle rather than a route change, matching how this page
  // is already presented as one modal/overlay (onClose) rather than
  // several routed pages.
  const [view, setView] = useState('compose');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [cancellingId, setCancellingId] = useState('');

  // "Schedule for later" (server/scheduler.js fires these — see that file
  // and routes/broadcast.js's POST /schedule for the backend half).
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduledOk, setScheduledOk] = useState(false);

  // ── Announcements (routes/announcements.js) — shown on the public
  // calendar's "Announcements" panel (PublicCalendar.jsx NewsFeedPanel).
  // Moved here from Settings so posting one lives alongside the rest of
  // "reach your community" rather than buried in org preferences. Uses the
  // same public GET /api/announcements route real visitors hit —
  // resolveOrgId() there prefers req.user.org_id when an admin's bearer
  // token is sent, so this admin fetch doesn't need a separate route.
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState('');
  const [announcementsError, setAnnouncementsError] = useState('');

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/broadcast/history?limit=50', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not load broadcast history');
      setHistoryItems(data.items || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistory() {
    setView('history');
    loadHistory();
  }

  async function handleCancelScheduled(broadcast_id) {
    setCancellingId(broadcast_id);
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch(`/api/broadcast/schedule/${broadcast_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not cancel this scheduled broadcast');
      setHistoryItems(items => items.map(it => it.broadcast_id === broadcast_id ? { ...it, status: 'cancelled' } : it));
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setCancellingId('');
    }
  }

  // Minimum lead time mirrors MIN_SCHEDULE_LEAD_MS in routes/broadcast.js —
  // kept as a plain literal here rather than fetched from the server, since
  // it only needs to roughly match for the datetime picker's min attribute
  // to feel right; the server is what actually enforces it.
  const MIN_SCHEDULE_LEAD_MINUTES = 2;
  function minScheduleLocal() {
    const d = new Date(Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000);
    d.setSeconds(0, 0);
    // datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local time —
    // toISOString() would convert to UTC first, off by the visitor's
    // timezone offset, so build it from the local getters instead.
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const handleSchedule = async () => {
    setScheduleError('');
    setScheduledOk(false);
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) { setScheduleError('Select at least one channel first.'); return; }
    if (!caption.trim()) { setScheduleError('Write a message first.'); return; }
    if (!scheduleAt) { setScheduleError('Pick a date and time.'); return; }
    const when = new Date(scheduleAt).getTime();
    if (!when || when < Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000) {
      setScheduleError(`Pick a time at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.`);
      return;
    }
    if (platforms.includes('instagram') && !uploadedMedia) {
      setScheduleError('Instagram requires an image — add one under "Add Creative" first.');
      return;
    }

    setScheduling(true);
    try {
      const token = localStorage.getItem('cf_token');
      const body = {
        platforms, caption, auto_rsvp: autoRSVP, rsvp_url: rsvpUrl,
        scheduled_for: when,
      };
      if (uploadedMedia) body.imageBase64 = uploadedMedia;
      if (platforms.includes('whatsapp') && showWATemplate) {
        body.wa_template = { template_name: selectedWATemplate.id, variables: waVars };
      }
      const res = await fetch('/api/broadcast/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not schedule this broadcast');
      setScheduledOk(true);
      setScheduleMode(false);
      setScheduleAt('');
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  // Toolbar nav buttons that open an AdminCalendar overlay (Flyer, Sync
  // Chatbot, Add Event, Help) need to close this page first, then hand off
  // to AdminCalendar via the same pendingAction pattern other pages use.
  const closeThenGo = (pendingAction) => {
    onClose();
    navigate('/admin', { state: { pendingAction } });
  };

  // Load this org's announcements once on mount.
  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    setAnnouncementsLoading(true);
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setAnnouncementsLoading(false));
  }, []);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    const message = newAnnouncement.trim();
    if (!message) return;
    setPostingAnnouncement(true);
    setAnnouncementsError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not post that announcement');
      setAnnouncements(data.announcements || []);
      setNewAnnouncement('');
      playSend(); // audible confirmation the announcement actually posted
    } catch (err) {
      setAnnouncementsError(err.message);
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    setDeletingAnnouncementId(id);
    setAnnouncementsError('');
    try {
      const token = localStorage.getItem('cf_token');
      const res = await fetch(`/api/announcements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not delete that announcement');
      setAnnouncements(data.announcements || []);
    } catch (err) {
      setAnnouncementsError(err.message);
    } finally {
      setDeletingAnnouncementId('');
    }
  };

    // "Announce this sheet" (SignupsAdminPage) hands off a ready-made caption
  // via App.jsx's pendingAction/broadcastCaption navigation state — when
  // present it wins over a leftover saved draft, since arriving here from
  // that button is a fresh, deliberate action, not a resumed draft.
  useEffect(() => {
    if (initialCaption) {
      setCaption(initialCaption);
      setActiveTemplate(null);
      return;
    }
    // Load any previously saved draft once on mount.
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.caption === 'string') setCaption(d.caption);
        if (d.selected) setSelected(prev => ({ ...prev, ...d.selected }));
        if (typeof d.autoRSVP === 'boolean') setAutoRSVP(d.autoRSVP);
        setDraftSaved(true);
      }
    } catch { /* ignore malformed/blocked storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ caption, selected, autoRSVP }));
      setDraftSaved(true);
    } catch { /* storage may be unavailable — draft just won't persist */ }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => { setUploadedMedia(ev.target.result); setMediaType(file.type.startsWith('image/') ? 'image' : 'video'); setMediaSizeMB(file.size / (1024 * 1024)); };
    reader.readAsDataURL(file);
  };

  function removeMedia() { setUploadedMedia(null); setMediaType(null); setMediaSizeMB(null); };
  // WhatsApp's Cloud API rejects any image over 5MB (returns a bare "(#100)
  // Invalid parameter" on the upload step) — flagged here so it's visible
  // before you hit Send, not after a failed API round trip.
  const overWhatsAppLimit = mediaType === 'image' && mediaSizeMB != null && mediaSizeMB > 5;
  function copyLink() { navigator.clipboard.writeText(rsvpUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  function applyTemplate(tpl, idx) { setCaption(tpl.text); setActiveTemplate(idx); setShowTemplates(false); setDraftSaved(false); };

  const handleBroadcast = async () => {
    // Synchronous re-entry guard — `isSending` (derived from `status` state)
    // doesn't update until the next render, so a double-click or a second
    // click landing before that render commits could otherwise both pass
    // the button's disabled check and fire two overlapping sends (the
    // community gets the same message twice, and two history rows are
    // created for one intended broadcast).
    if (sendingRef.current) return;
    sendingRef.current = true;

    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) { sendingRef.current = false; return; }
    const finalCaption = autoRSVP && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption;
    const token = localStorage.getItem('cf_token');

    const ns = {}; platforms.forEach(p => { ns[p] = 'sending'; });
    setStatus(ns); setErrors({}); setAllDone(false); setAnyTestMode(false);

    // Opens one history row this whole batch logs into (see broadcasts.js
    // and routes/broadcast.js's POST /start) — best-effort: if this fails
    // (network hiccup, history table briefly unavailable), the actual send
    // below still goes ahead exactly as before, it just won't show up in
    // History afterward.
    let broadcast_id = null;
    try {
      const startRes = await fetch('/api/broadcast/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ platforms, caption: finalCaption }),
      });
      const startData = await startRes.json();
      if (startRes.ok && startData.broadcast_id) broadcast_id = startData.broadcast_id;
    } catch { /* history logging is best-effort — see comment above */ }

    const results = await Promise.all(platforms.map(async (platform) => {
      try {
        const body = { platform, caption: finalCaption };
        if (uploadedMedia) body.imageBase64 = uploadedMedia;
        if (broadcast_id) body.broadcast_id = broadcast_id;
        const res = await fetch('/api/broadcast', { method:'POST', headers:{'Content-Type':'application/json', 'Authorization': `Bearer ${token}`}, body:JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed');
        setStatus(prev => ({ ...prev, [platform]: 'done' }));
        // Dev/test credentials (SOCIAL_MODE=dev, or a *_TEST_MODE override —
        // see GET /api/broadcast/mode) route the message to a test
        // recipient or an unpublished draft instead of the real audience.
        // The API call still succeeds, so without this the success banner
        // below would tell the admin "your community will receive this
        // shortly" when nobody actually will.
        if (data.testMode) setAnyTestMode(true);
        return true;
      } catch (err) {
        setStatus(prev => ({ ...prev, [platform]: 'error' }));
        setErrors(prev => ({ ...prev, [platform]: err.message }));
        return false;
    }
    }));

    setAllDone(true);
    if (results.some(Boolean)) playSend();
    sendingRef.current = false;
  };
  // Reset the form in place after a successful broadcast so the user can send
  // another message without leaving the page and navigating back from the
  // admin dashboard. Keeps platform selection as-is (usually unchanged
  // between sends) but clears content/status so nothing stale gets resent.
  const resetForAnother = () => {
    setCaption('');
    setUploadedMedia(null);
    setMediaType(null);
    setStatus({});
    setErrors({});
    setAllDone(false);
    setAnyTestMode(false);
    setActiveTemplate(null);
    setShowTemplates(false);
    setWaResult(null);
    setDraftSaved(false);
  };
  // Send approved WhatsApp template via API
  const handleWATemplateBroadcast = async () => {
    // Meta rejects the send outright (#132000 "Number of parameters does not
    // match") if any placeholder is left blank — the server drops empty
    // values before counting them, so a half-filled form silently becomes
    // the wrong parameter count. Catch it here with a clear message instead
    // of a cryptic Graph API error after the round trip.
    const missing = selectedWATemplate.vars.filter((v, i) => !waVars[i]?.trim());
    if (missing.length) {
      setWaResult({ ok: false, message: `❌ Fill in all fields first — missing: ${missing.map(v => v.label).join(', ')}` });
      return;
    }
    setWaSending(true); setWaResult(null);
    try {
      const res = await fetch('/api/broadcast/whatsapp-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
        body: JSON.stringify({
          template_name: selectedWATemplate.id,
          variables: waVars,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send template');
      setWaResult({ ok: true, message: `✅ Template sent to ${data.sent || 'recipients'} successfully!` });
    } catch (err) {
      setWaResult({ ok: false, message: `❌ ${err.message}` });
    } finally {
      setWaSending(false);
    }
  };

  // Web Share only makes sense on a phone — that's the only place Facebook
  // and Instagram actually register themselves as OS share targets. On
  // desktop (Windows/macOS), navigator.share often still exists (Edge,
  // Chrome) but the share sheet it opens only lists whatever the OS itself
  // registered (Mail, "My Phone", etc.) — Facebook/Instagram are never in
  // it, so trying Web Share there just shows an empty-looking sheet instead
  // of ever reaching the real fallback below. Skip it entirely off mobile.
  function isMobileDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  // ── "Open Facebook" / "Open Instagram" — no API needed ───────────────────
  // Ported from FlyerEditor/modals/BroadcastModal.jsx, adapted to this page's
  // caption/uploadedMedia state instead of a fabric canvas ref. Same idea as
  // the WhatsApp wa.me button below, extended to Facebook and Instagram:
  //   • Facebook's share dialog (sharer.php) only ever takes a URL — Meta
  //     killed prefilled caption text years ago to stop spam, so the best a
  //     link can do is open the dialog pointed at the RSVP page.
  //   • Instagram has NO web share URL at all, prefilled or otherwise.
  // The one thing that DOES work for both, on a phone: the native Web Share
  // API (navigator.share) with the flyer image attached as a file — that's
  // the OS-level share sheet, and Instagram/Facebook show up in it exactly
  // like they do from the Photos app. Tried first on mobile; desktop (or a
  // cancelled/unsupported share) falls back to the best next thing.
  async function shareViaWebShareOrFallback(fallbackFn) {
    try {
      if (isMobileDevice() && navigator.share) {
        const shareData = { text: caption, title: 'Temple Event' };
        if (uploadedMedia && mediaType === 'image') {
          const blob = await (await fetch(uploadedMedia)).blob();
          const file = new File([blob], 'flyer.png', { type: blob.type || 'image/png' });
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // user closed the share sheet — not a failure
      console.warn('[BroadcastPage] Web Share failed, falling back:', err);
    }
    fallbackFn();
  }

  function shareFacebook() {
    shareViaWebShareOrFallback(() => {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(rsvpUrl)}`, '_blank');
    });
  }

  function shareInstagram() {
    shareViaWebShareOrFallback(async () => {
      try {
        if (uploadedMedia) {
          const a = document.createElement('a');
          a.href = uploadedMedia;
          a.download = 'temple-event-flyer.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        const msg = autoRSVP && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption;
        if (navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(msg || `📋 RSVP: ${rsvpUrl}`); } catch (e) { /* clipboard permission denied — download still happened */ }
        }
        alert("📸 Flyer downloaded and caption copied to your clipboard.\n\nInstagram doesn't let any app pre-fill a post directly — open Instagram, start a new post with the downloaded image, and paste the caption.");
      } catch (err) {
        alert('Could not prepare the flyer — try again.');
      }
    });
  }

  const anySelected = Object.values(selected).some(Boolean);
  const isSending   = Object.values(status).some(s => s === 'sending');
  const allSuccess  = allDone && Object.keys(status).length > 0 && Object.values(status).every(s => s === 'done');
  const charCount   = caption.length;
  const charColor   = charCount > 950 ? '#ef4444' : charCount > 800 ? '#f59e0b' : P.faint;
  // What actually gets sent — same rule handleBroadcast uses to append the
  // RSVP link when "Auto-include RSVP link" is on. The Facebook/Instagram
  // previews below render this instead of the raw caption, so what you see
  // is what actually posts, not just what you've typed.
  const previewCaption = autoRSVP && caption && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption;
  // Instagram captions are hard-truncated at 2200 chars server-side (see
  // broadcastInstagram in broadcast.js) — reflect that in the preview
  // instead of silently showing text that won't actually be posted.
  const IG_CAPTION_LIMIT = 2200;
  const igCaption   = previewCaption.slice(0, IG_CAPTION_LIMIT);
  const igTruncated = previewCaption.length > IG_CAPTION_LIMIT;
  const selectedLabels = Object.keys(selected).filter(k => selected[k]).map(k => PLATFORMS.find(p => p.id === k)?.label).filter(Boolean);

  // Premium pass: soft drop shadow instead of a flat border for elevation,
  // plus a hairline border kept faint since the page itself is now pure
  // white and cards need some separation from the ground.
  const card  = { background:P.card, border:'1px solid rgba(0,0,0,0.05)', borderRadius:12, padding:'14px 16px', marginBottom:12, boxShadow:'0 6px 18px rgba(0,0,0,0.06)' };
  const lbl   = { fontSize:'0.88rem', color:P.muted, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:"'DM Sans', sans-serif" };
  const headRow = { display:'flex', alignItems:'center', gap:8, marginBottom:10 };

  function spill(type) {
    const m = { sending:{color:'#f59e0b',bg:'rgba(245,158,11,0.1)',label:'⏳ Sending'}, done:{color:'#4ade80',bg:'rgba(74,222,128,0.1)',label:'✓ Sent'}, error:{color:'#f87171',bg:'rgba(248,113,113,0.1)',label:'✗ Failed'} };
    const t = m[type]; if (!t) return null;
    return { color:t.color, background:t.bg, padding:'3px 10px', borderRadius:20, fontSize:'0.913rem', fontWeight:700, label:t.label };
  };

  // Status badge for one History row — mirrors broadcasts.js's computeStatus
  // outcomes ('sent' | 'partial' | 'failed') plus the two states that live
  // outside a send attempt entirely ('scheduled' | 'cancelled').
  function historyStatusPill(status) {
    const m = {
      sent:      { color:'#16a34a', bg:'rgba(22,163,74,0.1)',  label:'✓ Sent' },
      partial:   { color:'#d97706', bg:'rgba(217,119,6,0.1)',  label:'◐ Partial' },
      failed:    { color:'#dc2626', bg:'rgba(220,38,38,0.1)',  label:'✗ Failed' },
      scheduled: { color:'#2563eb', bg:'rgba(37,99,235,0.1)',  label:'📅 Scheduled' },
      cancelled: { color:'#71717a', bg:'rgba(113,113,122,0.1)', label:'Cancelled' },
      sending:   { color:'#d97706', bg:'rgba(217,119,6,0.1)',  label:'⏳ Sending' },
    };
    return m[status] || { color:'#71717a', bg:'rgba(113,113,122,0.1)', label:status };
  }

  // ── Quick Send column styles — WhatsApp/Facebook/Instagram render as three
  // matching columns (colStyle/colHeadStyle/colBodyStyle), each built from
  // the same small set of pieces (template mini-card, solid/outline button,
  // result banner, mini live-preview frame) so the three stay visually
  // interchangeable apart from their brand color and content.
  function colStyle(borderColor) { return { background:P.card, border:`1.5px solid ${borderColor}`, borderRadius:13, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 6px 18px rgba(0,0,0,0.05)' }; }
  function colHeadStyle(gradient) { return { padding:'11px 13px', background:gradient, color:'#fff', fontWeight:800, fontSize:'1.034rem', display:'flex', alignItems:'center', gap:8 }; }
  const colBodyStyle = { padding:'12px 13px', display:'flex', flexDirection:'column', gap:10, flex:1 };
  const colSubRow = { fontSize:'0.748rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:P.muted, display:'flex', alignItems:'center', justifyContent:'space-between' };
  function miniLinkStyle(color) { return { background:'none', border:'none', cursor:'pointer', color, fontSize:'0.858rem', fontWeight:700, fontFamily:"'DM Sans', sans-serif" }; }
  function solidBtnStyle(grad, disabled) { return { width:'100%', padding:'9px', background: disabled ? P.border : grad, border:'none', borderRadius:8, color:'#fff', fontWeight:800, fontSize:'0.946rem', cursor:disabled?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }; }
  function outlineBtnStyle(color) { return { width:'100%', padding:'8px', background:'#fff', border:`1.5px solid ${color}`, borderRadius:8, color, fontWeight:800, fontSize:'0.946rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }; }
  function resultBoxStyle(ok) { return { padding:'7px 9px', borderRadius:7, background: ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${ok ? '#4ade8040' : '#f8717140'}`, color: ok ? '#4ade80' : '#fca5a5', fontSize:'0.858rem', fontWeight:600 }; }

  // ── Step tracker + status pill (header) ──────────────────────────────────
  function stepState(key) {
    if (key === 'channels') return anySelected ? 'done' : 'current';
    if (key === 'creative') {
      // Media is optional everywhere it's sent (WhatsApp/Facebook both allow
      // caption-only posts — see broadcast.js) — this step was previously
      // stuck on 'pending' forever if you skipped the image, even after
      // moving on to write the message. Treat it as satisfied (done) once
      // you've reached the message step, same as any other optional step
      // you've chosen to skip; 'current' only while it's genuinely the next
      // thing to consider.
      if (uploadedMedia) return 'done';
      if (!anySelected) return 'pending';
      return caption.trim() ? 'done' : 'current';
    }
    if (key === 'message') {
      if (!anySelected) return 'pending';
      return caption.trim() ? 'done' : 'current';
    }
    if (key === 'review') {
      if (!anySelected || !caption.trim()) return 'pending';
      return allSuccess ? 'done' : 'current';
    }
    return 'pending';
  }
  let statusPill;
  if (isSending)      statusPill = { label:'Sending…',    bg:'rgba(245,158,11,0.16)', color:'#f59e0b' };
  else if (allSuccess) statusPill = { label:'Sent ✓',      bg:'rgba(74,222,128,0.16)', color:'#4ade80' };
  else if (draftSaved) statusPill = { label:'Draft saved', bg:'rgba(74,222,128,0.14)', color:'#4ade80' };
  else                  statusPill = { label:'Unsaved changes', bg:'rgba(255,255,255,0.1)', color:'#d4d4d8' };

  // ── "Ready to send" checklist (right column) ─────────────────────────────
  const checklist = [
    { key:'channels', label:'Channels', ok: anySelected, value: anySelected ? `${selectedLabels.length} selected` : 'None selected' },
    { key:'media',    label:'Media',    ok: true,          value: uploadedMedia ? (mediaType === 'image' ? 'Image added' : 'Video added') : 'None (optional)' },
    { key:'message',  label:'Message',  ok: caption.trim().length > 0, value: caption.trim() ? `${charCount} characters` : 'Required' },
    { key:'rsvp',     label:'RSVP link', ok: autoRSVP,     value: autoRSVP ? 'Included' : 'Not included' },
  ];
  const readyToSend = anySelected && caption.trim().length > 0;

  return (

    <div style={{ position:'fixed', inset:0, zIndex:9999, ...HALO_BG, overflowY:'auto', fontFamily:"'DM Sans', sans-serif" }}>

      {/* Persistent dark app toolbar — unchanged, identical to every other
          admin page. Its own nav buttons hand off via the pendingAction
          pattern so they open correctly once we're back on /admin. */}
      <AdminToolbar
        activePage="broadcast"
        showSubheader={false}
        onDashboard={onClose}
        onBroadcast={() => {}}
        onFlyer={() => closeThenGo('flyer')}
        onSyncChatbot={() => closeThenGo('syncChatbot')}
        onAddEvent={() => closeThenGo('addEvent')}
        onHelp={() => closeThenGo('help')}
      />

      {/* Broadcast Studio's own page header — title, step tracker, status.
          Premium pass: glossy black instead of the old brown/gold gradient,
          matching the black & white redesign used everywhere else on this
          page (cards, buttons, checklist). */}
      <div style={{ position:'sticky', top:0, zIndex:10, background:'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg,#1a1a1a,#000000)', borderBottom:'1px solid rgba(255,255,255,0.12)', padding:'14px 20px', overflow:'hidden' }}>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), rgba(255,255,255,0.15), rgba(255,255,255,0.4), transparent)' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={onClose} title="Back to Dashboard" style={{ width:34, height:34, borderRadius:9, border:'1px solid rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.06)', color:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <div style={{ color:'#ffffff', fontWeight:700, fontSize:'1.496rem', fontFamily:"'Playfair Display', Georgia, serif" }}>Broadcast Studio</div>
              <div style={{ color:'#a1a1aa', fontSize:'0.957rem', marginTop:2 }}>Reach your community everywhere</div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {STEPS.map((s, i) => {
              const st = stepState(s.key);
              return (
                <React.Fragment key={s.key}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800,
                      background: st === 'done' ? '#4ade80' : st === 'current' ? '#ffffff' : 'rgba(255,255,255,0.08)',
                      color: st === 'pending' ? '#71717a' : '#0a0a0a',
                    }}>{st === 'done' ? '✓' : i + 1}</span>
                    <span style={{ fontSize:'1.012rem', fontWeight:700, color: st === 'pending' ? '#71717a' : '#ffffff' }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span style={{ width:20, height:1, background:'rgba(255,255,255,0.18)' }} />}
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {view === 'compose' ? (
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:'0.957rem', fontWeight:700, background:statusPill.bg, color:statusPill.color }}>{statusPill.label}</div>
            ) : (
              <div style={{ padding:'5px 12px', borderRadius:20, fontSize:'0.957rem', fontWeight:700, background:'rgba(255,255,255,0.1)', color:'#fff' }}>History</div>
            )}
            <button
              onClick={() => view === 'compose' ? openHistory() : setView('compose')}
              title={view === 'compose' ? 'View send history' : 'Back to compose'}
              style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.16)', background: view === 'history' ? '#fff' : 'rgba(255,255,255,0.06)', color: view === 'history' ? '#0a0a0a' : '#ffffff', display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontWeight:700, fontSize:'0.9rem', fontFamily:"'DM Sans', sans-serif" }}
            >
              {view === 'compose' ? '🕓 History' : '✏️ Compose'}
            </button>
            <button onClick={onClose} title="Close" style={{ width:30, height:30, borderRadius:8, border:'1px solid rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.06)', color:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .cf-broadcast-grid { grid-template-columns: 1fr !important; }
          .cf-broadcast-preview { display: none !important; }
          .cf-broadcast-sticky { position: static !important; }
        }
        @media (max-width: 860px) {
          .cf-broadcast-channels { grid-template-columns: 1fr !important; }
          .cf-broadcast-3col { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {view === 'history' ? (
        <div style={{ width:'100%', boxSizing:'border-box', maxWidth:900, margin:'0 auto', padding:'22px 28px' }}>
          <div style={card}>
            <div style={headRow}><IconBadge icon="🕓" /><span style={lbl}>Send History</span></div>

            {historyError && (
              <div style={{ padding:'9px 12px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid #f8717140', color:'#dc2626', fontSize:'0.913rem', marginBottom:10 }}>{historyError}</div>
            )}
            {historyLoading && (
              <div style={{ padding:'20px 0', textAlign:'center', color:P.faint, fontSize:'0.99rem' }}>Loading…</div>
            )}
            {!historyLoading && !historyItems.length && !historyError && (
              <div style={{ padding:'28px 0', textAlign:'center', color:P.faint, fontSize:'0.99rem' }}>Nothing sent or scheduled yet — broadcasts you send or schedule will show up here.</div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {historyItems.map(item => {
                const st = historyStatusPill(item.status);
                const when = item.status === 'scheduled' ? item.scheduled_for : (item.sent_at || item.created_at);
                const whenLabel = when ? new Date(when).toLocaleString([], { dateStyle:'medium', timeStyle:'short' }) : '';
                return (
                  <div key={item.broadcast_id} style={{ border:`1px solid ${P.border}`, borderRadius:10, padding:'11px 13px', background:P.bg }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ padding:'2px 9px', borderRadius:20, fontSize:'0.792rem', fontWeight:800, background:st.bg, color:st.color }}>{st.label}</span>
                          <span style={{ fontSize:'0.858rem', color:P.faint, fontWeight:600 }}>{(item.platforms || []).map(p => PLATFORMS.find(pl => pl.id === p)?.label || p).join(' · ')}</span>
                        </div>
                        <div style={{ color:P.text, fontSize:'0.99rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.caption || '(no message)'}</div>
                        <div style={{ color:P.faint, fontSize:'0.836rem', marginTop:3 }}>{item.status === 'scheduled' ? 'Scheduled for ' : item.status === 'cancelled' ? 'Was scheduled for ' : 'Sent '}{whenLabel}</div>
                        {item.results && Object.keys(item.results).length > 0 && (
                          <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
                            {Object.entries(item.results).map(([platform, r]) => (
                              <span key={platform} style={{ fontSize:'0.792rem', fontWeight:700, color: r.success ? '#16a34a' : '#dc2626' }} title={r.error || ''}>
                                {r.success ? '✓' : '✗'} {PLATFORMS.find(pl => pl.id === platform)?.label || platform}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {item.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelScheduled(item.broadcast_id)}
                          disabled={cancellingId === item.broadcast_id}
                          style={{ padding:'6px 11px', borderRadius:7, border:'1px solid #f8717166', background:'#fff', color:'#dc2626', fontSize:'0.858rem', fontWeight:700, cursor:'pointer', flexShrink:0 }}
                        >
                          {cancellingId === item.broadcast_id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
      <div className="cf-broadcast-grid" style={{ width:'100%', boxSizing:'border-box', margin:'0 auto', padding:'22px 28px', display:'grid', gridTemplateColumns:'1fr 380px', gap:22 }}>
        <div>
          {/* Announcements — moved from Settings so posting an instant
              update to the public calendar lives next to the rest of
              "reach your community", not buried in org preferences.
              Deliberately breaks this page's black & white palette with a
              red/amber "live" accent -- this is the one action here that
              publishes to the public site with no review step and no Save
              button, so it should read as different from the rest, not
              just another card in the stack. */}
          <div style={{ ...card, border:'1.5px solid #dc2626', boxShadow:'0 8px 22px rgba(220,38,38,0.14), 0 6px 18px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#dc2626,#f59e0b)' }} />
            <div style={{ ...headRow, justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <IconBadge icon="📣" />
                <span style={lbl}>Announcements</span>
              </div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, background:'rgba(220,38,38,0.1)', color:'#dc2626', fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.04em' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#dc2626', flexShrink:0 }} />
                LIVE
              </span>
            </div>
            <p style={{ fontSize:'0.87rem', color:P.text, fontWeight:600, margin:'-4px 0 12px' }}>⚡ Posts immediately to your public site — visitors see it right away, nothing else to save</p>

            {announcementsError && (
              <div style={{ marginBottom:12, padding:'9px 12px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid #f8717140', color:'#dc2626', fontSize:'0.85rem' }}>{announcementsError}</div>
            )}

            {/* Plain <div>, not a nested <form> -- this page's own actions
                (Send Now, Schedule) live inside no <form> either, but a
                second submit button sharing a page with those triggers the
                same nested-form submit-bubbling bug Settings had. Enter-to-
                submit is wired manually instead. */}
            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <input
                type="text"
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePostAnnouncement(e); }}
                placeholder="e.g. Diwali celebration this Friday at 6pm!"
                maxLength={500}
                style={{ flex:1, padding:'10px 14px', borderRadius:8, border:`1px solid ${P.border}`, background:P.bg, color:P.text, fontSize:'0.9rem' }}
              />
              <button
                type="button"
                onClick={handlePostAnnouncement}
                disabled={postingAnnouncement || !newAnnouncement.trim()}
                style={{
                  padding:'10px 20px', borderRadius:8, border:'none', background:'#0a0a0a', color:'#fff',
                  fontWeight:700, fontSize:'0.88rem', whiteSpace:'nowrap',
                  cursor:(postingAnnouncement || !newAnnouncement.trim()) ? 'default' : 'pointer',
                  opacity:(postingAnnouncement || !newAnnouncement.trim()) ? 0.5 : 1,
                }}
              >
                {postingAnnouncement ? 'Posting…' : 'Post'}
              </button>
            </div>

            {announcementsLoading ? (
              <p style={{ fontSize:'0.85rem', color:P.faint }}>Loading announcements…</p>
            ) : announcements.length === 0 ? (
              <p style={{ fontSize:'0.85rem', color:P.faint, fontStyle:'italic' }}>No announcements yet. Post one above.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {announcements.map((a) => (
                  <div key={a.id} style={{
                    display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12,
                    padding:'11px 14px', borderRadius:8, border:`1px solid ${P.border}`,
                    background:P.bg, borderLeft:'3px solid #0a0a0a',
                  }}>
                    <div>
                      <p style={{ fontSize:'0.9rem', color:P.text, margin:0 }}>{a.message}</p>
                      {a.created_at && (
                        <p style={{ fontSize:'0.72rem', color:P.faint, margin:0, marginTop:4 }}>{new Date(a.created_at).toLocaleString()}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      disabled={deletingAnnouncementId === a.id}
                      title="Delete announcement"
                      style={{
                        padding:6, borderRadius:7, border:'none', background:'transparent', color:P.faint,
                        cursor:deletingAnnouncementId === a.id ? 'default' : 'pointer',
                        opacity:deletingAnnouncementId === a.id ? 0.5 : 1, flexShrink:0,
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Choose Channels */}
          <div style={card}>
            <div style={headRow}><IconBadge icon="📡" /><span style={lbl}>Choose Channels</span></div>
            <div className="cf-broadcast-channels" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
              {PLATFORMS.map(p => {
                const isOn = selected[p.id]; const st = status[p.id]; const pill = spill(st);
                return (
                  <div key={p.id} onClick={() => !isSending && setSelected(prev => { setDraftSaved(false); return { ...prev, [p.id]: !prev[p.id] }; })}
                    style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px', borderRadius:10, border:`1.5px solid ${isOn ? p.color : P.border}`, background:isOn ? `${p.color}12` : P.bg, cursor:isSending?'default':'pointer', transition:'all 0.15s', opacity:!p.setup&&!isOn?0.7:1, boxShadow: isOn ? `0 4px 14px -4px ${p.color}66` : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:`${p.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                        {p.Icon ? <p.Icon size={18} color={p.color} strokeWidth={2.2} /> : p.icon}
                      </div>
                      <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${isOn?p.color:P.muted}`, background:isOn?p.color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.781rem', color:'#fff', fontWeight:900, flexShrink:0 }}>{isOn&&'✓'}</div>
                    </div>
                    <div>
                      {/* No channel here has a real, checkable "connected" status (WhatsApp
                          sends via a wa.me link — there's no API/session to actually be
                          connected to; Facebook/Instagram need real tokens this app doesn't
                          have). A green "Connected" badge would just be a fabricated status,
                          so channels show only their label — `setup` still controls the
                          dimming below for channels that need real configuration first. */}
                      <div style={{ color:P.text, fontSize:'1.166rem', fontWeight:800, fontFamily:"'Playfair Display', Georgia, serif" }}>{p.label}</div>
                    </div>
                    {pill && <div style={{ ...pill, alignSelf:'flex-start' }}>{pill.label}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Creative */}
          <div style={card}>
            <div style={headRow}><IconBadge icon="🖼️" /><span style={lbl}>Add Creative</span></div>
            {!uploadedMedia ? (
              <label style={{ display:'block', border:`1.5px dashed ${P.border}`, borderRadius:9, padding:'20px', textAlign:'center', cursor:'pointer', background:'linear-gradient(120deg, rgba(0,0,0,0.035), rgba(0,0,0,0.015))' }}
                onMouseEnter={e => e.currentTarget.style.borderColor=P.gold} onMouseLeave={e => e.currentTarget.style.borderColor=P.border}>
                <div style={{ fontSize:24, marginBottom:5 }}>🖼️</div>
                <div style={{ color:P.muted, fontSize:'1.067rem', fontWeight:700 }}>Drag and drop an image or video here</div>
                <div style={{ color:P.faint, fontSize:'0.913rem', marginTop:3 }}>PNG, JPG, MP4 · Max 50MB</div>
                <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              // objectFit:'contain' (not 'cover') so a flyer/poster image shows at
              // its real proportions instead of being cropped to fill a fixed box —
              // posters are usually portrait and were getting their top/bottom cut off.
              <div style={{ position:'relative', borderRadius:9, overflow:'hidden', background:P.deep, display:'flex', justifyContent:'center' }}>
                {mediaType==='image' ? <img src={uploadedMedia} alt="Upload" style={{ maxWidth:'100%', maxHeight:420, width:'auto', height:'auto', objectFit:'contain', display:'block' }} /> : <video src={uploadedMedia} controls style={{ maxWidth:'100%', maxHeight:420 }} />}
                <button onClick={removeMedia} style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(239,68,68,0.85)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12} /></button>
              </div>
            )}
            {overWhatsAppLimit && (
              <div style={{ marginTop:9, padding:'8px 11px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:8, color:'#b45309', fontSize:'0.902rem', lineHeight:1.5 }}>
                ⚠️ This image is {mediaSizeMB.toFixed(1)}MB — WhatsApp only accepts images up to 5MB and will reject the send. Facebook and Instagram are unaffected; use a smaller image if you also want to send it over WhatsApp.
              </div>
            )}
          </div>

          {/* Write Your Message */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><IconBadge icon="✍️" /><span style={lbl}>Write Your Message</span></div>
              <button onClick={() => setShowTemplates(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', color:P.gold, fontSize:'0.935rem', fontWeight:700, fontFamily:"'DM Sans', sans-serif" }}>{showTemplates ? '▲ Hide' : '✨ Use Template'}</button>
            </div>
            {showTemplates && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {TEMPLATES.map((tpl, idx) => (
                  <button key={idx} onClick={() => applyTemplate(tpl, idx)} style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', border:`1px solid ${activeTemplate===idx ? P.gold : P.border}`, background:activeTemplate===idx ? 'rgba(0,0,0,0.08)' : P.card, color:activeTemplate===idx ? P.gold : P.muted, fontSize:'0.935rem', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}>{tpl.label}</button>
                ))}
              </div>
            )}
            <textarea value={caption} onChange={e => { setCaption(e.target.value); setActiveTemplate(null); setDraftSaved(false); }}
              placeholder={`Write your broadcast message...\n\nExample:\n🙏 Join us for Sri Satyanarayana Swamy Pooja\n📅 March 2, 2026 at 10:00 AM\n📍 Sample Temple Name`}
              style={{ width:'100%', padding:'10px 12px', boxSizing:'border-box', background:P.deep, border:`1.5px solid ${P.border}`, borderRadius:9, color:P.text, fontSize:'1.067rem', fontWeight:500, lineHeight:1.75, resize:'vertical', outline:'none', fontFamily:"'DM Sans', sans-serif", minHeight:120 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <div style={{ color:P.faint, fontSize:'0.88rem' }}>*bold* for WhatsApp bold text</div>
              <div style={{ color:charColor, fontSize:'0.913rem', fontWeight:600 }}>{charCount} / 1024</div>
            </div>
          </div>

          {/* RSVP & Links */}
          <div style={card}>
            <div style={headRow}><IconBadge icon="🔗" /><span style={lbl}>RSVP & Links</span></div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:P.deep, border:`1px solid ${P.border}`, borderRadius:9, padding:'9px 13px', display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:15 }}>🔗</span>
                <span style={{ color:P.gold, fontSize:'1.012rem', fontWeight:700, fontFamily:'monospace' }}>{rsvpUrl}</span>
              </div>
              <button onClick={copyLink} style={{ padding:'9px 13px', borderRadius:9, cursor:'pointer', background:copied?'rgba(74,222,128,0.1)':'rgba(0,0,0,0.06)', border:`1px solid ${copied?'#4ade80':P.gold}`, color:copied?'#4ade80':P.gold, fontWeight:700, fontSize:'1.012rem', display:'flex', alignItems:'center', gap:5, fontFamily:"'DM Sans', sans-serif" }}>
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:7, marginTop:9, cursor:'pointer' }}>
              <input type="checkbox" checked={autoRSVP} onChange={e => { setAutoRSVP(e.target.checked); setDraftSaved(false); }} style={{ width:14, height:14, accentColor:P.gold }} />
              <span style={{ color:P.muted, fontSize:'0.99rem' }}>Auto-include RSVP link in message</span>
            </label>
          </div>

          {/* Errors */}
          {Object.keys(errors).length > 0 && (
            <div style={{ padding:'11px 13px', marginBottom:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10 }}>
              {Object.entries(errors).map(([p, msg]) => <div key={p} style={{ color:'#fca5a5', fontSize:'1.001rem', marginBottom:3 }}><strong style={{ textTransform:'capitalize' }}>{p}:</strong> {msg}</div>)}
              <div style={{ color:P.faint, fontSize:'0.913rem', marginTop:5 }}>Check your API keys in App Runner environment variables.</div>
            </div>
          )}
          {/* Success — test-mode sends get a visibly different banner so a
              dev/sandbox deployment can never look like it reached the
              real community when it didn't (see anyTestMode above). */}
          {allSuccess && anyTestMode && (
            <div style={{ padding:'13px', marginBottom:12, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:10, textAlign:'center' }}>
              <div style={{ color:'#f59e0b', fontWeight:800 }}>🧪 Sent in TEST MODE</div>
              <div style={{ color:P.faint, fontSize:'0.957rem', marginTop:3 }}>This used dev/test credentials — your real community was NOT notified. Check GET /api/broadcast/mode or your environment config before going live.</div>
            </div>
          )}
          {allSuccess && !anyTestMode && (
            <div style={{ padding:'13px', marginBottom:12, background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:10, textAlign:'center' }}>
              <div style={{ color:'#4ade80', fontWeight:800 }}>🎉 Broadcast sent successfully!</div>
              <div style={{ color:P.faint, fontSize:'0.957rem', marginTop:3 }}>Your community will receive the message shortly.</div>
            </div>
          )}

          {/* Quick Send — three matching columns, one per platform. Every
              column has the same four things in the same order: Template,
              Send via API, Send without API, Live Preview — so the three
              platforms read as equivalent options, not WhatsApp-plus-two. */}
          <div style={{ ...lbl, marginBottom:8 }}>Quick Send — One Column Per Platform</div>
          <div className="cf-broadcast-3col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>

            {/* ── WhatsApp column ── */}
            <div style={colStyle('rgba(37,211,102,0.3)')}>
              <div style={colHeadStyle('linear-gradient(135deg,#25d366,#128c3e)')}>💬 WhatsApp</div>
              <div style={colBodyStyle}>
                <div>
                  <div style={colSubRow}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      Template
                      <span style={{ padding:'2px 8px', borderRadius:20, background:'rgba(37,211,102,0.15)', border:'1px solid rgba(37,211,102,0.45)', color:'#128c3e', fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.02em', textTransform:'none' }}>
                        ⭐ Recommended for first send
                      </span>
                    </span>
                    <button onClick={() => setShowWATemplate(v => !v)} style={miniLinkStyle('#128c3e')}>{showWATemplate ? '▲ Hide' : '▼ Use'}</button>
                  </div>
                  {!showWATemplate ? (
                    // Highlighted (not just a plain miniCard) because this is the path most
                    // broadcasts should take: WhatsApp only allows free-form text to someone
                    // who has messaged your number in the last 24h. Outside that window —
                    // which covers almost every first-time broadcast to a new devotee list,
                    // a fresh festival invite list, or any group you haven't messaged before —
                    // Meta requires this pre-approved template instead, or the send is rejected.
                    <div style={{ marginTop:5, padding:'9px 10px', borderRadius:9, background:'rgba(37,211,102,0.07)', border:'1.5px solid rgba(37,211,102,0.4)' }}>
                      <div style={{ fontSize:'0.858rem', color:P.text, fontWeight:700, lineHeight:1.5 }}>🙏 Meta-approved template — Event Name, Date, Time, RSVP Link fields.</div>
                      <div style={{ fontSize:'0.803rem', color:P.faint, lineHeight:1.55, marginTop:5 }}>
                        Use this for first-time or 24h+ contacts — new devotee lists, a fresh festival invite, or any group you haven't broadcast to before. WhatsApp blocks plain messages to contacts who haven't messaged you recently, so this is the reliable option when in doubt.
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop:7 }}>
                      {WA_TEMPLATES.map(tpl => (
                        <div key={tpl.id} onClick={() => setSelectedWATemplate(tpl)}
                          style={{ padding:'8px 10px', borderRadius:8, marginBottom:6, border:`1.5px solid ${selectedWATemplate.id===tpl.id ? '#25d366' : P.border}`, background:selectedWATemplate.id===tpl.id ? 'rgba(37,211,102,0.08)' : P.bg, cursor:'pointer' }}>
                          <div style={{ color:P.text, fontSize:'0.957rem', fontWeight:700 }}>{tpl.label}</div>
                          <div style={{ color:P.faint, fontSize:'0.836rem' }}>{tpl.description}</div>
                        </div>
                      ))}
                      {selectedWATemplate.vars.map((v, i) => (
                        <div key={i} style={{ marginBottom:6 }}>
                          <div style={{ color:P.muted, fontSize:'0.803rem', fontWeight:600, marginBottom:3 }}>{v.key} — {v.label}</div>
                          <input
                            value={waVars[i] || ''}
                            onChange={e => { const n=[...waVars]; n[i]=e.target.value; setWaVars(n); }}
                            placeholder={v.placeholder}
                            style={{ width:'100%', boxSizing:'border-box', padding:'7px 9px', background:P.deep, border:`1px solid ${P.border}`, borderRadius:7, color:P.text, fontSize:'0.913rem', outline:'none', fontFamily:"'DM Sans', sans-serif" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {waResult && <div style={resultBoxStyle(waResult.ok)}>{waResult.message}</div>}
                <button onClick={handleWATemplateBroadcast} disabled={waSending} style={solidBtnStyle('linear-gradient(135deg,#25d366,#128c3e)', waSending)}>
                  {waSending ? '⏳ Sending…' : '📤 Send via API'}
                </button>
                <button onClick={() => { const msg = caption ? (autoRSVP && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption) : `🙏 Temple Event Update\n\n📋 RSVP & details: ${rsvpUrl}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); }}
                  style={outlineBtnStyle('#128c3e')}>
                  💬 Quick Share via WhatsApp
                </button>
              </div>
            </div>

            {/* ── Facebook column ── */}
            <div style={colStyle('rgba(24,119,242,0.3)')}>
              <div style={colHeadStyle('linear-gradient(135deg,#1877f2,#0d5bc4)')}><Facebook size={15} /> Facebook</div>
              <div style={colBodyStyle}>
                <button onClick={shareFacebook} style={outlineBtnStyle('#0d5bc4')}>
                  <Facebook size={13} /> Quick Share to Facebook
                </button>
              </div>
            </div>

            {/* ── Instagram column ── */}
            <div style={colStyle('rgba(225,48,108,0.3)')}>
              <div style={colHeadStyle('linear-gradient(135deg,#e1306c,#833ab4)')}><Instagram size={15} /> Instagram</div>
              <div style={colBodyStyle}>
                <button onClick={shareInstagram} style={outlineBtnStyle('#833ab4')}>
                  <Instagram size={13} /> Quick Share to Instagram
                </button>
              </div>
            </div>

          </div>

          {/* Schedule for later — server/scheduler.js actually fires these
              (a ~60s poll, since this app has no queue/cron infra; see that
              file's header). Collapsed by default so it stays out of the
              way of the normal send-now flow. */}
          {!allSuccess && (
            <div style={{ ...card, background:P.bg2, marginBottom:0 }}>
              <div
                onClick={() => { setScheduleMode(v => !v); setScheduleError(''); setScheduledOk(false); if (!scheduleAt) setScheduleAt(minScheduleLocal()); }}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <IconBadge icon="🕐" size={22} />
                  <span style={lbl}>Schedule for later</span>
                </div>
                <span style={{ color:P.faint, fontSize:'0.913rem', fontWeight:700 }}>{scheduleMode ? '▲ Hide' : '▼ Set a time'}</span>
              </div>
              {scheduleMode && (
                <div style={{ marginTop:10, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div style={{ flex:'1 1 220px' }}>
                    <label style={{ display:'block', color:P.muted, fontSize:'0.858rem', fontWeight:700, marginBottom:4 }}>Send at</label>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      min={minScheduleLocal()}
                      onChange={e => setScheduleAt(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', border:`1px solid ${P.border}`, borderRadius:8, color:P.text, fontSize:'0.99rem', fontFamily:"'DM Sans', sans-serif" }}
                    />
                  </div>
                  <button
                    onClick={handleSchedule}
                    disabled={scheduling || !anySelected}
                    style={{ padding:'9px 16px', border:'none', borderRadius:8, background: (scheduling||!anySelected) ? P.border : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:800, fontSize:'0.99rem', cursor:(scheduling||!anySelected)?'not-allowed':'pointer', fontFamily:"'DM Sans', sans-serif" }}
                  >
                    {scheduling ? 'Scheduling…' : '📅 Schedule Broadcast'}
                  </button>
                </div>
              )}
              {scheduleError && (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:7, background:'rgba(239,68,68,0.08)', border:'1px solid #f8717140', color:'#dc2626', fontSize:'0.88rem', fontWeight:600 }}>{scheduleError}</div>
              )}
              {scheduledOk && (
                <div style={{ marginTop:8, padding:'7px 10px', borderRadius:7, background:'rgba(74,222,128,0.1)', border:'1px solid #4ade8040', color:'#16a34a', fontSize:'0.88rem', fontWeight:700 }}>
                  ✓ Scheduled! Find it under 🕓 History, where you can cancel it anytime before it sends.
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap:'wrap' }}>
            <button onClick={onClose} style={{ flex:'1 1 100px', padding:'11px', border:`1px solid ${P.border}`, background:'transparent', color:P.muted, borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'1.111rem', fontFamily:"'DM Sans', sans-serif" }}>{allSuccess ? 'Close' : 'Cancel'}</button>
            <button onClick={saveDraft} style={{ flex:'1 1 120px', padding:'11px', border:`1px solid ${P.border}`, background:'transparent', color:P.gold, borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:'1.111rem', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'DM Sans', sans-serif" }}>
              <Save size={13} /> Save Draft
            </button>
            <button onClick={allSuccess ? resetForAnother : handleBroadcast} disabled={!anySelected||isSending}
              style={{ flex:'2 1 160px', padding:'11px', border:'none', background:(!anySelected||isSending)?'#2a1508':'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)', color:(!anySelected||isSending)?P.faint:'#fff', borderRadius:10, cursor:(!anySelected||isSending)?'not-allowed':'pointer', fontWeight:800, fontSize:'1.166rem', fontFamily:"'DM Sans', sans-serif", boxShadow:(!anySelected||isSending)?'none':'0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.16)' }}>
              {isSending ? '⏳ Broadcasting…' : allSuccess ? '🔄 Send Another' : '📣 Review & Broadcast'}
            </button>
          </div>

        </div>
        {/* RIGHT — Preview */}
        <div className="cf-broadcast-preview">
          <div className="cf-broadcast-sticky" style={{ position:'sticky', top:150 }}>
            <div style={{ ...card, background:P.bg2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}><IconBadge icon="👁" /><span style={lbl}>Live Preview</span></div>
                {anySelected && (
                  <div style={{ padding:'3px 10px', borderRadius:20, background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.3)', color:'#4ade80', fontSize:'0.858rem', fontWeight:700 }}>
                    Sending to {selectedLabels.join(', ')}
                  </div>
                )}
              </div>
              {!anySelected && (
                <div style={{ padding:'22px 10px', textAlign:'center', color:P.faint, fontSize:'0.99rem' }}>
                  Select a channel below to see how your message will look there.
                </div>
              )}

              {/* One native-styled phone-frame card per selected platform —
                  this used to be a single WhatsApp-only mock regardless of
                  what was actually checked, plus separate duplicate mini
                  previews inside each Quick Send column. Consolidated here:
                  whichever channels are checked each get their own realistic
                  preview, stacked in the same place. */}
              {selected.whatsapp && (
                <div style={{ background:'#0a0a0a', borderRadius:16, padding:8, marginBottom: (selected.facebook || selected.instagram) ? 12 : 0 }}>
                  <div style={{ background:'#ffffff', borderRadius:11, padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${P.border}` }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#25d366,#128c3e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>💬</div>
                      <div>
                        <div style={{ color:'#0a0a0a', fontWeight:700, fontSize:'1.144rem', fontFamily:"'Playfair Display', Georgia, serif" }}>Temple WhatsApp</div>
                        <div style={{ color:P.faint, fontSize:'0.88rem' }}>Community Group</div>
                      </div>
                    </div>

                    <div style={{ background:'#f4f4f5', borderRadius:'4px 10px 10px 10px', padding:'9px 11px' }}>
                      {uploadedMedia && (
                        // objectFit:'contain' here too, so the preview shows the poster at
                        // its real proportions instead of a cropped 'cover' thumbnail.
                        <div style={{ borderRadius:7, overflow:'hidden', marginBottom:7, background:P.deep, display:'flex', justifyContent:'center' }}>
                          {mediaType==='image' ? <img src={uploadedMedia} alt="preview" style={{ maxWidth:'100%', maxHeight:240, width:'auto', height:'auto', objectFit:'contain', display:'block' }} /> : <video src={uploadedMedia} style={{ maxWidth:'100%', maxHeight:240 }} />}
                        </div>
                      )}
                      <div style={{ color:caption?'#0a0a0a':P.faint, fontSize:'1.067rem', fontWeight:500, lineHeight:1.75, whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:"'DM Sans', sans-serif" }}>
                        {showWATemplate ? selectedWATemplate.preview(waVars) : (caption || 'Your message will appear here…')}
                      </div>

                      {!showWATemplate && autoRSVP && caption && !caption.includes(rsvpUrl) && (
                        <div style={{ marginTop:7, padding:'5px 9px', background:'rgba(0,0,0,0.06)', border:`1px solid ${P.border}`, borderRadius:6 }}>
                          <div style={{ color:P.gold, fontSize:'0.913rem', fontFamily:'monospace', wordBreak:'break-all' }}>📋 RSVP: {rsvpUrl}</div>
                        </div>
                      )}
                      <div style={{ color:P.faint, fontSize:'0.803rem', marginTop:5, textAlign:'right' }}>{new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} ✓✓</div>
                    </div>
                  </div>
                </div>
              )}

              {selected.facebook && (
                <div style={{ background:'#0a0a0a', borderRadius:16, padding:8, marginBottom: selected.instagram ? 12 : 0 }}>
                  <div style={{ background:'#ffffff', borderRadius:11, padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      {organization?.logo_url ? (
                        <img src={organization.logo_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      ) : (
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'#1877f2', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'0.85rem', flexShrink:0 }}>
                          {(organization?.name || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ color:'#0a0a0a', fontWeight:700, fontSize:'1.03rem', fontFamily:"'Playfair Display', Georgia, serif" }}>{organization?.name || 'Your Temple'}</div>
                        <div style={{ color:P.faint, fontSize:'0.82rem' }}>Just now · 🌐</div>
                      </div>
                    </div>

                    <div style={{ color:caption?'#0a0a0a':P.faint, fontSize:'1rem', fontWeight:500, lineHeight:1.65, whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:"'DM Sans', sans-serif" }}>{caption || 'Your message will appear here…'}</div>

                    {autoRSVP && caption && !caption.includes(rsvpUrl) && (
                      <div style={{ marginTop:7, padding:'5px 9px', background:'rgba(0,0,0,0.06)', border:`1px solid ${P.border}`, borderRadius:6 }}>
                        <div style={{ color:P.gold, fontSize:'0.913rem', fontFamily:'monospace', wordBreak:'break-all' }}>📋 RSVP: {rsvpUrl}</div>
                      </div>
                    )}
                    {uploadedMedia && mediaType==='image' && (
                      <div style={{ borderRadius:7, overflow:'hidden', marginTop:9, background:P.deep, display:'flex', justifyContent:'center' }}>
                        <img src={uploadedMedia} alt="preview" style={{ maxWidth:'100%', maxHeight:240, width:'auto', height:'auto', objectFit:'contain', display:'block' }} />
                      </div>
                    )}
                    <div style={{ display:'flex', gap:16, marginTop:10, paddingTop:8, borderTop:`1px solid ${P.border}`, color:P.faint, fontSize:'0.84rem', fontWeight:700 }}>
                      <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
                    </div>
                  </div>
                </div>
              )}

              {selected.instagram && (
                <div style={{ background:'#0a0a0a', borderRadius:16, padding:8 }}>
                  <div style={{ background:'#ffffff', borderRadius:11, padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
                      {organization?.logo_url ? (
                        <img src={organization.logo_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      ) : (
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#e1306c,#833ab4)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'0.78rem', flexShrink:0 }}>
                          {(organization?.name || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ color:'#0a0a0a', fontWeight:700, fontSize:'0.93rem' }}>{organization?.subdomain || 'yourtemple'}</div>
                    </div>

                    {uploadedMedia && mediaType==='image' ? (
                      <div style={{ borderRadius:7, overflow:'hidden', background:'#000', display:'flex', justifyContent:'center' }}>
                        <img src={uploadedMedia} alt="preview" style={{ width:'100%', maxHeight:260, objectFit:'contain', display:'block' }} />
                      </div>
                    ) : (
                      // Instagram has no caption-only post — the API call fails outright
                      // without an image (see broadcastInstagram in broadcast.js) — so the
                      // preview says so instead of implying a text-only post would work.
                      <div style={{ borderRadius:7, height:150, display:'flex', alignItems:'center', justifyContent:'center', background:'#fef2f2', border:'1px dashed #fca5a5', color:'#b91c1c', fontSize:'0.85rem', fontWeight:700, textAlign:'center', padding:'0 14px' }}>
                        ⚠️ Instagram requires an image — add one under "Add Creative"
                      </div>
                    )}

                    <div style={{ display:'flex', gap:14, marginTop:9, marginBottom:7, fontSize:'1.1rem' }}>
                      <span>❤️</span><span>💬</span><span>📤</span>
                    </div>

                    <div style={{ color:'#0a0a0a', fontSize:'0.94rem', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:"'DM Sans', sans-serif" }}>
                      <span style={{ fontWeight:700 }}>{organization?.subdomain || 'yourtemple'}</span>{' '}
                      {igCaption || <span style={{ color:P.faint }}>Your message will appear here…</span>}
                    </div>
                    {autoRSVP && caption && !caption.includes(rsvpUrl) && (
                      <div style={{ marginTop:7, padding:'5px 9px', background:'rgba(0,0,0,0.06)', border:`1px solid ${P.border}`, borderRadius:6 }}>
                        <div style={{ color:P.gold, fontSize:'0.913rem', fontFamily:'monospace', wordBreak:'break-all' }}>📋 RSVP: {rsvpUrl}</div>
                      </div>
                    )}
                    {igTruncated && (
                      <div style={{ color:'#b91c1c', fontSize:'0.8rem', fontWeight:600, marginTop:5 }}>
                        ✂️ Truncated — Instagram caps captions at {IG_CAPTION_LIMIT} characters
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ready to send checklist */}
            <div style={{ ...card, background:P.bg2 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <IconBadge icon="✓" size={22} />
                <div style={{ color:P.text, fontWeight:800, fontSize:'1.144rem', fontFamily:"'Playfair Display', Georgia, serif" }}>{readyToSend ? 'Ready to send' : 'A few things left'}</div>
              </div>
              {/* Filled check-circles (green = done, gray dot = pending) instead
                  of a plain checkmark glyph — reads as a real checklist. */}
              {checklist.map(item => (
                <div key={item.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderTop:`1px solid ${P.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, color:P.text, fontSize:'1.012rem', fontWeight:700 }}>
                    <span style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900, background:item.ok?'#16a34a':'#e4e4e7', color:item.ok?'#fff':'#a1a1aa' }}>{item.ok?'✓':'·'}</span>
                    {item.label}
                  </div>
                  <div style={{ color:item.ok?'#16a34a':P.faint, fontSize:'0.957rem', fontWeight:700 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
