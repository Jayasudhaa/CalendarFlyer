/**
 * src/pages/SignupPage.jsx
 * Route: /signups/:eventId  (eventId is the same date-title slug RSVPPage
 * and PhotoSharePage.jsx use -- see utils/rsvpUrl.js#getEventKey).
 *
 * Public devotee page for the Sign-Up Sheets feature (server/routes/
 * signups.js) -- shows every open Volunteer-shift or Potluck-dish sheet
 * for an event and lets a phone-verified devotee join/cancel a slot.
 * Same phone-verification identity as PhotoSharePage.jsx (token stored
 * under the same TOKEN_KEY, reused across both features), plus one extra
 * one-time step this feature needs that photos never did: a display name,
 * so the roster shows "Priya K." instead of a phone number.
 *
 * Polls every 12s while the tab is visible, same as PhotoSharePage.jsx's
 * Album -- catches another devotee filling a slot, or a waitlist
 * promotion, without the page needing a live-push mechanism.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { getEventKey } from '../utils/rsvpUrl';
import { SHEET_TYPE_LABELS } from '../utils/signupTemplates';

const TOKEN_KEY = 'cf_community_token';
const POLL_MS = 12000;

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

// Same convention as PhotoSharePage.jsx/useEvents.js — forwards ?org= from
// this page's own URL so local dev (no real subdomain) can still resolve
// the right tenant. Unused in production, where the subdomain does it.
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

export default function SignupPage() {
  const { eventId: eventSlug } = useParams();
  const { events, loading: eventsLoading } = useEvents();
  const event = findEventByKey(events, eventSlug);
  const eventName = event?.title || 'Temple Event';
  const eventDate = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const [token, setTok] = useState(getToken());

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '32px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
          <div style={{ color: '#c9943a', fontSize: '1.3rem', fontWeight: 800, marginBottom: 4, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {eventName} — Sign-Ups
          </div>
          {eventDate && <div style={{ color: '#92400e', fontSize: '0.85rem' }}>📅 {eventDate}</div>}
        </div>

        {eventsLoading ? (
          <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading event…</div>
        ) : !event ? (
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: '0.9rem' }}>Event not found.</div>
        ) : !token ? (
          <PhoneVerify onVerified={(t) => { setToken(t); setTok(t); }} />
        ) : (
          <SignupsPanel eventDbId={event.id} token={token} onTokenInvalid={() => { clearToken(); setTok(null); }} />
        )}
      </div>
    </div>
  );
}

// ── Phone verification — identical pattern to PhotoSharePage.jsx's own ──

function PhoneVerify({ onVerified }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
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
    if (!phone.trim()) return setError('Enter your phone number.');
    setError(''); setBusy(true);
    try {
      await apiFetch('/api/community/request-code', { method: 'POST', body: JSON.stringify({ phone: phone.trim() }) });
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return setError('Enter the code we texted you.');
    setError(''); setBusy(true);
    try {
      const data = await apiFetch('/api/community/verify-code', { method: 'POST', body: JSON.stringify({ phone: phone.trim(), code: code.trim() }) });
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
        To join a shift or claim a dish, verify your phone number — this keeps the sign-up list for people who are actually part of this community.
      </div>

      {step === 'phone' ? (
        <>
          <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Phone Number
          </label>
          <input type="tel" placeholder="+1 (719) 555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ ...input, marginBottom: 16 }} />
          {error && <ErrorBanner text={error} />}
          <button onClick={requestCode} disabled={busy} style={button(busy)}>{busy ? '⏳ Sending…' : 'Text me a code'}</button>
        </>
      ) : (
        <>
          <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            6-digit code sent to {phone}
          </label>
          <input type="text" inputMode="numeric" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, marginBottom: 12, letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.2rem' }} />
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => { setStep('phone'); setCode(''); setError(''); }} style={{ background: 'none', border: 'none', color: '#9a7a55', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
              ← Use a different number
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

// ── Name prompt — one-time, before a devotee's first sign-up anywhere ───

function NamePrompt({ token, onDone }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return setError('Enter your name.');
    setError(''); setBusy(true);
    try {
      const data = await apiFetch('/api/community/me', { token, method: 'PATCH', body: JSON.stringify({ display_name: name.trim() }) });
      onDone(data.display_name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#fffdf7', borderRadius: 16, border: '1px solid #e8d5b7', padding: 28 }}>
      <div style={{ color: '#92400e', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20 }}>
        One last step — what name should show up on the sign-up sheet?
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya K." style={{
        width: '100%', padding: '12px 14px', boxSizing: 'border-box',
        background: '#fffdf7', border: '1px solid #e8d5b7', borderRadius: 10,
        color: '#3d2008', fontSize: '0.95rem', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: 16,
      }} />
      {error && <ErrorBanner text={error} />}
      <button onClick={save} disabled={busy} style={{
        width: '100%', padding: '14px', background: busy ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
        border: 'none', color: 'white', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer',
        fontWeight: 800, fontSize: '1rem', fontFamily: "'DM Sans', sans-serif",
      }}>{busy ? 'Saving…' : 'Continue'}</button>
    </div>
  );
}

// ── Sign-up sheets ───────────────────────────────────────────────────────

function SignupsPanel({ eventDbId, token, onTokenInvalid }) {
  const [displayName, setDisplayName] = useState(undefined); // undefined = not checked yet
  const [sheets, setSheets] = useState([]);
  const [myHours, setMyHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busySlot, setBusySlot] = useState(null);
  const [claimingSlot, setClaimingSlot] = useState(null);
  const [dishDraft, setDishDraft] = useState('');

  const checkProfile = useCallback(async () => {
    try {
      const data = await apiFetch('/api/community/me', { token });
      setDisplayName(data.display_name || null);
    } catch (err) {
      if (/expired|verify/i.test(err.message)) onTokenInvalid();
    }
  }, [token, onTokenInvalid]);

  useEffect(() => { checkProfile(); }, [checkProfile]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/signups/event/${eventDbId}`, { token });
      setSheets(data.sheets || []);
      setMyHours(data.my_volunteer_hours || 0);
      setError('');
    } catch (err) {
      if (/expired|verify/i.test(err.message)) onTokenInvalid();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventDbId, token, onTokenInvalid]);

  useEffect(() => {
    if (!displayName) return;
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [displayName, load]);

  if (displayName === undefined) {
    return <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading…</div>;
  }
  if (!displayName) {
    return <NamePrompt token={token} onDone={(name) => setDisplayName(name)} />;
  }

  const join = async (slot, dish) => {
    setBusySlot(slot.slot_id);
    setError('');
    try {
      const data = await apiFetch(`/api/signups/slots/${slot.slot_id}/join`, {
        token, method: 'POST', body: JSON.stringify(dish ? { dish } : {}),
      });
      setClaimingSlot(null);
      setDishDraft('');
      if (data.message) setError(''); // success message shown via reload below, not treated as an error
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySlot(null);
    }
  };

  const cancel = async (entryId) => {
    setBusySlot(entryId);
    setError('');
    try {
      await apiFetch(`/api/signups/entries/${entryId}/cancel`, { token, method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySlot(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading sign-ups…</div>;
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 20, background: '#fdf6ea', border: '1px solid #e8d5b7', color: '#78350f', fontSize: '0.72rem', fontWeight: 700 }}>
          👤 Signed in as {displayName}
        </span>
        {myHours > 0 && (
          <div style={{ marginTop: 8, color: '#92400e', fontSize: '0.78rem', fontWeight: 600 }}>
            🙏 You've volunteered {Math.round(myHours * 10) / 10} hour{myHours === 1 ? '' : 's'} total — thank you!
          </div>
        )}
      </div>

      {error && <ErrorBanner text={error} />}

      {sheets.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9a7a55', fontSize: '0.9rem', padding: '40px 0' }}>
          Nothing to sign up for on this event yet.
        </div>
      ) : (
        sheets.map((sheet) => (
          <div key={sheet.sheet_id} style={{ marginBottom: 22 }}>
            <div style={{ color: '#c9943a', fontSize: '1.05rem', fontWeight: 800, marginBottom: 10, fontFamily: "'Playfair Display', Georgia, serif" }}>
              {SHEET_TYPE_LABELS[sheet.type]?.icon} {sheet.title}
            </div>
            <EarlyAccessBanner sheet={sheet} />
            {sheet.slots.map((slot) => (
              <SlotCard
                key={slot.slot_id}
                slot={slot}
                sheetType={sheet.type}
                locked={sheet.locked}
                busy={busySlot === slot.slot_id}
                cancelBusy={busySlot}
                onJoin={() => (sheet.type === 'potluck' ? setClaimingSlot(slot.slot_id) : join(slot))}
                onCancel={cancel}
                isClaiming={claimingSlot === slot.slot_id}
                dishDraft={dishDraft}
                setDishDraft={setDishDraft}
                onConfirmDish={() => join(slot, dishDraft)}
                onCancelClaim={() => { setClaimingSlot(null); setDishDraft(''); }}
              />
            ))}
          </div>
        ))
      )}

      <div style={{ textAlign: 'center', marginTop: 24, color: '#e8d5b7', fontSize: '0.75rem' }}>
        🌸 Om Namo Venkatesaya 🌸
      </div>
    </div>
  );
}

function EarlyAccessBanner({ sheet }) {
  if (!sheet.early_access_hours) return null;
  const stillOpen = sheet.early_access_until && Date.now() < sheet.early_access_until;
  if (!stillOpen) return null;
  const untilLabel = new Date(sheet.early_access_until).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return sheet.locked ? (
    <div style={{ background: '#f4f4f5', border: '1px solid #d4d4d8', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: '1.3rem' }}>🔒</span>
      <div style={{ color: '#52525b', fontSize: '0.8rem', fontWeight: 600 }}>Opens to everyone {untilLabel} -- follow the temple for early access.</div>
    </div>
  ) : (
    <div style={{ background: 'linear-gradient(135deg,#fdf6ea,#fbeed3)', border: '1px solid #e8c878', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: '1.3rem' }}>✓</span>
      <div style={{ color: '#78350f', fontSize: '0.8rem', fontWeight: 600 }}>Early access -- thanks for following! Everyone else can join starting {untilLabel}.</div>
    </div>
  );
}

function SlotCard({ slot, sheetType, locked, busy, cancelBusy, onJoin, onCancel, isClaiming, dishDraft, setDishDraft, onConfirmDish, onCancelClaim }) {
  const mineConfirmed = slot.confirmed.find((e) => e.mine);
  const mineWaitlisted = slot.waitlist.find((e) => e.mine);
  const full = slot.confirmed.length >= slot.capacity;
  const pct = Math.min(100, Math.round((slot.confirmed.length / slot.capacity) * 100));

  return (
    <div style={{ background: '#fffdf7', border: '1px solid #e8d5b7', borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#3d2008' }}>{slot.label}</div>
          {slot.time_label && <div style={{ color: '#9a7a55', fontSize: '0.78rem', marginTop: 2 }}>🕐 {slot.time_label}</div>}
        </div>
        <div style={{ color: full ? '#16a34a' : (slot.confirmed.length === 0 ? '#b45309' : '#92400e'), fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {full ? '✓ Full' : `${slot.confirmed.length} / ${slot.capacity}`}
        </div>
      </div>

      <div style={{ height: 6, background: '#fdf6ea', border: '1px solid #e8d5b7', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: full ? '#16a34a' : '#c9943a', borderRadius: 4 }} />
      </div>

      {slot.confirmed.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {slot.confirmed.map((e) => (
            <span key={e.entry_id} style={{
              padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem',
              background: e.mine ? '#c9943a' : '#fdf6ea', color: e.mine ? '#fff' : '#78350f',
              border: `1px solid ${e.mine ? '#c9943a' : '#e8d5b7'}`, fontWeight: e.mine ? 800 : 500,
            }}>
              {e.name}{e.dish ? ` — ${e.dish}` : ''}{e.mine ? ' (you)' : ''}
            </span>
          ))}
        </div>
      )}
      {slot.waitlist.length > 0 && (
        <div style={{ color: '#b45309', fontSize: '0.76rem', marginBottom: 10 }}>
          ⏳ Waitlist ({slot.waitlist.length}){mineWaitlisted ? ' — you are waitlisted' : ''}
        </div>
      )}
      {slot.confirmed.length === 0 && slot.waitlist.length === 0 && (
        <div style={{ color: '#b45309', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: 10 }}>No one yet — be the first!</div>
      )}

      {mineConfirmed && (
        <button onClick={() => onCancel(mineConfirmed.entry_id)} disabled={cancelBusy === mineConfirmed.entry_id} style={btnOutline('#16a34a')}>
          {cancelBusy === mineConfirmed.entry_id ? 'Cancelling…' : "✓ You're in — tap to cancel"}
        </button>
      )}
      {!mineConfirmed && mineWaitlisted && (
        <button onClick={() => onCancel(mineWaitlisted.entry_id)} disabled={cancelBusy === mineWaitlisted.entry_id} style={btnOutline('#b45309')}>
          {cancelBusy === mineWaitlisted.entry_id ? 'Cancelling…' : '⏳ Waitlisted — tap to cancel'}
        </button>
      )}
      {!mineConfirmed && !mineWaitlisted && !isClaiming && (
        <button onClick={onJoin} disabled={busy || locked} style={locked ? { ...btnSolid, background: '#e8d5b7', cursor: 'default' } : (full ? btnOutline('#78350f') : btnSolid)}>
          {locked ? 'Opens soon' : busy ? 'Joining…' : full ? 'Join waitlist' : SHEET_TYPE_LABELS[sheetType]?.joinCta}
        </button>
      )}
      {!mineConfirmed && !mineWaitlisted && isClaiming && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={dishDraft} onChange={(e) => setDishDraft(e.target.value)} placeholder="What are you bringing? e.g. Pulihora" style={{
            width: '100%', padding: '10px 12px', boxSizing: 'border-box', background: '#ffffff', border: '1px solid #e8d5b7',
            borderRadius: 8, color: '#3d2008', fontSize: '0.85rem',
          }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancelClaim} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid #e8d5b7', background: '#ffffff', color: '#78350f', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
            <button onClick={onConfirmDish} disabled={!dishDraft.trim() || busy} style={{
              flex: 2, padding: 9, borderRadius: 8, border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
              background: !dishDraft.trim() || busy ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
              cursor: !dishDraft.trim() || busy ? 'default' : 'pointer',
            }}>{busy ? 'Adding…' : 'Add my dish'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnSolid = {
  width: '100%', padding: 11, borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg,#b45309,#78350f)', color: '#fff',
  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
};
function btnOutline(color) {
  return {
    width: '100%', padding: 11, borderRadius: 10, border: `1.5px solid ${color}`,
    background: '#ffffff', color, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
  };
}
