/**
 * src/pages/AdminHome.jsx
 * Admin landing page — routed at /dashboard, replacing the old
 * "choose Viewer or Admin mode" screen (ModeSelection.jsx). Login,
 * Google login, and the guest-sandbox flow now send a manageable account
 * straight here instead of making them click through a picker every time
 * (see PremiumLogin.jsx/PremiumLanding.jsx's postLoginDestination logic —
 * a viewer-only account skips this page entirely and goes straight to the
 * public calendar, same as before).
 *
 * Every number on this page is real: next event, this-month event count,
 * and the next event's attendee count all come from the same
 * /api/events + /api/rsvp endpoints the rest of the admin app already
 * uses. No page-view/"reach" tracking exists anywhere in this app (see
 * RSVPAnalyticsPage.jsx's own header comment on the same rule), so this
 * deliberately doesn't show one rather than fabricate it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Globe, Image, Megaphone, TrendingUp, Link2, Check, MapPin, Clock, Users } from 'lucide-react';
import AdminToolbar from '../components/AdminToolbar';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { getPublicCalendarUrl } from '../utils/rsvpUrl';

const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

function authHeader() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Soft one-time-per-day welcome chime -- three ascending notes, synthesized
// with the Web Audio API so no audio file/asset has to ship or load. Gated
// to once per calendar day (localStorage) so it doesn't replay every time
// you click back into the dashboard during the same day.
function playWelcomeChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => ctx.close(), 900);
  } catch {
    // Autoplay-blocked or unsupported browser -- skip silently, the visual
    // greeting still shows either way.
  }
}

// Same slug convention as utils/rsvpUrl.js's getEventKey / RSVPAnalyticsPage.jsx's
// own copy of it — GET/POST /api/rsvp expect this exact key, not event.id.
const slugify = (text) =>
  (text || '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
const getEventKey = (event) => `${event?.date}-${slugify(event?.title)}`;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { events, loading } = useEvents();
  const [copied, setCopied] = useState(false);
  const [attending, setAttending] = useState(null);
  const [attentionItems, setAttentionItems] = useState([]);

  const firstName = (user?.display_name || user?.email?.split('@')[0] || 'there').trim();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const today = toDateStr(new Date());
  const monthKey = today.slice(0, 7);

  const upcoming = useMemo(
    () => events.filter(e => e.type !== 'panchang' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [events, today]
  );
  const thisMonthCount = useMemo(
    () => events.filter(e => e.type !== 'panchang' && e.date.slice(0, 7) === monthKey).length,
    [events, monthKey]
  );
  const nextEvent = upcoming[0] || null;

  // Fire the welcome chime once per calendar day. Chrome/Firefox refuse to
  // start an AudioContext unless it's triggered by a real user gesture, and
  // by the time this effect runs (after the async login + route change)
  // that gesture window has already closed -- so instead of playing right
  // away, arm it and fire on the very next click/tap/keypress anywhere on
  // the page, which fires almost immediately in practice.
  useEffect(() => {
    let lastPlayed = null;
    try {
      lastPlayed = localStorage.getItem('cf_welcome_chime_date');
    } catch {
      // localStorage unavailable (private browsing, etc.) -- treat as unplayed.
    }
    if (lastPlayed === today) return undefined;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      playWelcomeChime();
      try {
        localStorage.setItem('cf_welcome_chime_date', today);
      } catch {
        // Ignore -- worst case it plays again next reload today.
      }
      window.removeEventListener('pointerdown', fire);
      window.removeEventListener('keydown', fire);
    };
    window.addEventListener('pointerdown', fire, { once: true });
    window.addEventListener('keydown', fire, { once: true });
    return () => {
      window.removeEventListener('pointerdown', fire);
      window.removeEventListener('keydown', fire);
    };
  }, [today]);

  // Real attendee count for the next event (server/routes/rsvp.js) — same
  // "real data only" rule RSVPAnalyticsPage.jsx documents for itself.
  useEffect(() => {
    let cancelled = false;
    setAttending(null);
    if (!nextEvent) return undefined;
    fetch(`/api/rsvp/${encodeURIComponent(getEventKey(nextEvent))}`, { headers: { ...authHeader() } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setAttending(data ? (data.totalCount || 0) : 0); })
      .catch(() => { if (!cancelled) setAttending(null); });
    return () => { cancelled = true; };
  }, [nextEvent?.id]);

  // "Needs attention": events in the next 7 days with zero RSVPs yet —
  // the one real, computable "this could use a nudge" signal available
  // without inventing new tracking. One batch call, same endpoint the
  // Analytics Overview already uses to avoid N+1 requests.
  useEffect(() => {
    const soon = upcoming.filter(e => {
      const days = (new Date(`${e.date}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000;
      return days >= 0 && days <= 7;
    }).slice(0, 5);
    if (!soon.length) { setAttentionItems([]); return undefined; }
    let cancelled = false;
    fetch('/api/rsvp/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ eventIds: soon.map(getEventKey) }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const flagged = soon
          .filter(e => ((data.results || {})[getEventKey(e)]?.totalCount || 0) === 0)
          .map(e => ({ event: e, label: `No RSVPs yet for "${e.title}"` }));
        setAttentionItems(flagged);
      })
      .catch(() => { if (!cancelled) setAttentionItems([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming.map(e => e.id).join(',')]);

  function copyLink() {
    navigator.clipboard.writeText(getPublicCalendarUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const dateBadge = nextEvent ? new Date(`${nextEvent.date}T12:00:00`) : null;

  return (
    <div style={{ minHeight: '100vh', ...HALO_BG }}>
      <style>{`
        @media (max-width: 760px) {
          .cf-home-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <AdminToolbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Greeting row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {greeting}, {firstName}
            </h1>
            <p style={{ color: 'var(--cf-text-muted)', margin: '6px 0 0', fontSize: '0.95rem' }}>
              {loading
                ? 'Loading your community…'
                : `Your community has ${thisMonthCount} event${thisMonthCount === 1 ? '' : 's'} coming up this month.`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => window.open(getPublicCalendarUrl(), '_blank', 'noopener')} style={secondaryBtn}>
              <Globe size={15} /> View public calendar
            </button>
            <button onClick={() => navigate('/admin', { state: { pendingAction: 'addEvent' } })} style={primaryBtn}>
              <Plus size={15} /> Create event
            </button>
          </div>
        </div>

        <div className="cf-home-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(240px,1fr)', gap: 18, marginBottom: 18 }}>
          {/* Next community event */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cf-accent)', marginBottom: 8 }}>
              Next community event
            </div>
            {nextEvent ? (
              <>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--cf-text-primary)', margin: '0 0 6px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {nextEvent.title}
                </h2>
                {nextEvent.description && (
                  <p style={{ color: 'var(--cf-text-muted)', margin: '0 0 14px', fontSize: '0.92rem' }}>{nextEvent.description}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={dateBadgeStyle}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--cf-accent)', textTransform: 'uppercase' }}>
                      {dateBadge.toLocaleDateString([], { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--cf-text-primary)' }}>{dateBadge.getDate()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--cf-text-primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={13} /> {dateBadge.toLocaleDateString([], { weekday: 'long' })}{nextEvent.time ? ` · ${nextEvent.time}` : ''}
                    </div>
                    {nextEvent.location && (
                      <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <MapPin size={13} /> {nextEvent.location}
                      </div>
                    )}
                  </div>
                </div>
                {attending !== null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--cf-text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
                    <Users size={14} /> {attending} {attending === 1 ? 'person' : 'people'} attending
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '20px 0', color: 'var(--cf-text-muted)' }}>
                No upcoming events yet —{' '}
                <button onClick={() => navigate('/admin', { state: { pendingAction: 'addEvent' } })} style={linkBtn}>create your first one</button>.
              </div>
            )}
          </div>

          {/* Needs attention */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cf-text-muted)' }}>
                Needs attention
              </div>
              {attentionItems.length > 0 && (
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--cf-accent)' }}>{attentionItems.length}</span>
              )}
            </div>
            {attentionItems.length === 0 ? (
              <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.9rem', padding: '8px 0' }}>You're all caught up.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attentionItems.map(({ event, label }) => (
                  <button
                    key={event.id}
                    onClick={() => navigate('/admin', { state: { pendingAction: 'broadcast' } })}
                    style={attentionRowStyle}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <button onClick={() => navigate('/admin', { state: { pendingAction: 'flyer' } })} style={tileStyle}>
            <Image size={18} />
            <div>
              <div style={tileTitle}>Create a flyer</div>
              <div style={tileSub}>Start with an event</div>
            </div>
          </button>
          <button onClick={() => navigate('/admin', { state: { pendingAction: 'broadcast' } })} style={tileStyle}>
            <Megaphone size={18} />
            <div>
              <div style={tileTitle}>Send an announcement</div>
              <div style={tileSub}>WhatsApp, email and social</div>
            </div>
          </button>
          <button onClick={() => navigate('/analytics')} style={tileStyle}>
            <TrendingUp size={18} />
            <div>
              <div style={tileTitle}>View analytics</div>
              <div style={tileSub}>RSVPs and event performance</div>
            </div>
          </button>
          <button onClick={copyLink} style={tileStyle}>
            {copied ? <Check size={18} color="#16a34a" /> : <Link2 size={18} />}
            <div>
              <div style={{ ...tileTitle, color: copied ? '#16a34a' : undefined }}>{copied ? 'Link copied!' : 'Copy calendar link'}</div>
              <div style={tileSub}>Share your public calendar</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 14,
  padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};
const dateBadgeStyle = {
  width: 52, height: 52, borderRadius: 12, background: 'var(--cf-accent-glow)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
const linkBtn = {
  border: 'none', background: 'transparent', color: 'var(--cf-accent)', fontWeight: 700, cursor: 'pointer',
  fontSize: 'inherit', padding: 0, textDecoration: 'underline',
};
const tileStyle = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 12,
  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-surface)', cursor: 'pointer', textAlign: 'left',
  color: 'var(--cf-text-primary)', boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
};
const tileTitle = { fontWeight: 800, fontSize: '0.92rem', color: 'var(--cf-text-primary)' };
const tileSub = { fontSize: '0.78rem', color: 'var(--cf-text-muted)', marginTop: 2 };
const attentionRowStyle = {
  display: 'block', width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--cf-border)', background: 'var(--cf-bg-base)', color: 'var(--cf-text-primary)',
  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};
