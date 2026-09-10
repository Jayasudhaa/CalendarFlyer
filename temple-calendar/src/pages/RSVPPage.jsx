/**
 * RSVPPage.jsx
 * Route: /rsvp?event=event-slug
 *
 * Add to your router:
 *   import RSVPPage from './components/RSVPPage';
 *   <Route path="/rsvp" element={<RSVPPage />} />
 */
import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { getEventKey } from '../utils/rsvpUrl';

// The server has no de-dup check on RSVP submissions (any POST just inserts
// a new row), so nothing stopped a double-click or a page refresh from
// silently inflating an event's headcount with duplicate entries from the
// same person. This local marker is a lightweight client-side guard — not
// a substitute for a real server-side check, but it covers the two common
// real-world cases (an impatient double-tap, and someone reopening the same
// RSVP link after submitting) without needing a login or a schema change.
const rsvpStorageKey = (eventId) => `cf_rsvp_submitted_${eventId}`;

const ATTENDING_OPTIONS = [
  { value: 'yes',   label: '✅ Yes, I\'ll be there',  color: '#16a34a' },
  { value: 'no',    label: '❌ Sorry, can\'t make it', color: '#dc2626' },
  { value: 'maybe', label: '🤔 Maybe',                color: '#d97706' },
];

// Events used to be looked up from localStorage['templeEvents'], but nothing
// in the app writes that key anymore — real event data lives on the backend.
// That meant this page could never actually find the event someone tapped a
// link for. Now it fetches the org's live events (useEvents, same call the
// public calendar and admin dashboard use — no login required, org is
// resolved server-side from the subdomain) and matches by the same
// date-title-slug key (getEventKey) used to build the link in the first
// place, so a link generated anywhere in the app resolves here.
function findEventByKey(events, key) {
  if (!key) return null;
  return events.find(e => getEventKey(e) === key) || null;
}
export default function RSVPPage() {
  const { eventId } = useParams();
  const { events, loading: eventsLoading } = useEvents();
  const event = findEventByKey(events, eventId);
  const eventName = event?.title || 'Temple Event';
  const eventDate = event?.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const eventTime = event?.time || '';

  const [attending,   setAttending]   = useState('');
  const [name,      setName]      = useState('');
  const [count,     setCount]     = useState(1);
  const [phone,       setPhone]       = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  // Initialized from localStorage so reopening this link after a successful
  // RSVP (refresh, back/forward, tapping the same link again) shows the
  // "already submitted" confirmation instead of a blank form ready to
  // submit a second time.
  const [submitted,   setSubmitted]   = useState(() => {
    try { return !!(eventId && localStorage.getItem(rsvpStorageKey(eventId))); }
    catch { return false; }
  });
  const [error,       setError]       = useState('');
  // `submitting` (React state) doesn't flip to true until the next render,
  // so a double-click or a fast repeat tap could both pass the button's
  // disabled check and fire two RSVPs before either finishes — the server
  // has no de-dup check of its own, so both would land. This ref is set
  // synchronously and is the actual re-entry guard.
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!name.trim())  return setError('Please enter your name');
    if (!attending)    return setError('Please select your attendance');
    setError('');
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/rsvp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId:   eventId,
          name:      name.trim(),
          count:     attending === 'no' ? 0 : count,
          attending,
          phone:     phone.trim(),
          notes:     notes.trim(),
          meal:      `attending:${attending}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      try { localStorage.setItem(rsvpStorageKey(eventId), '1'); } catch { /* best-effort only */ }
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#fffdf7', border: '1px solid #e8d5b7',
    borderRadius: 10, color: '#3d2008', fontSize: '0.95rem',
    outline: 'none', fontFamily: "'DM Sans', sans-serif",
  };
  // Brief loading guard so the placeholder "Temple Event" title doesn't
  // flash before the real event data (fetched from the backend) arrives.
  if (eventsLoading) return (
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9a7a55', fontSize: '0.9rem' }}>⏳ Loading event…</div>
    </div>
  );
  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🙏</div>
        <div style={{ color: '#c9943a', fontSize: '1.5rem', fontWeight: '800', fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 8 }}>
          {/* `name`/`attending` are only known within the session that just
              submitted — reopening this link later restores `submitted`
              from localStorage (see rsvpStorageKey) with neither, so this
              falls back to a name-less thank-you instead of "Thank You, !". */}
          {name ? `Thank You, ${name}!` : 'Thank You!'}
        </div>
        <div style={{ color: '#92400e', fontSize: '1rem', lineHeight: 1.7 }}>
          {attending
            ? <>Your RSVP for <strong style={{ color: '#3d2008' }}>{eventName}</strong> has been received.</>
            : <>You've already RSVP'd for <strong style={{ color: '#3d2008' }}>{eventName}</strong>.</>}
          {attending === 'yes' && ` We look forward to seeing you!`}
          {attending === 'maybe' && ` We hope you can make it!`}
          {attending === 'no' && ` We'll miss you. Hope to see you at the next event!`}
        </div>
        <div style={{ marginTop: 24, color: '#9a7a55', fontSize: '0.85rem' }}>
          🌸 Sample Temple Name
        </div>
        </div>
      </div>
    );

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', padding: '32px 16px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛕</div>
          <div style={{ color: '#c9943a', fontSize: '1.3rem', fontWeight: '800', marginBottom: 4 }}>
            {eventName}
          </div>
          {eventDate && <div style={{ color: '#92400e', fontSize: '0.85rem', marginBottom: 2 }}>📅 {eventDate}{eventTime ? ` · 🕐 ${eventTime}` : ''}</div>}
          <div style={{ color: '#9a7a55', fontSize: '0.85rem' }}>
            Sample Temple Name
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#fffdf7', borderRadius: 16, border: '1px solid #e8d5b7', padding: 28 }}>
          {/* Attending options */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Will you attend?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ATTENDING_OPTIONS.map(opt => (
                <div key={opt.value}
                  onClick={() => setAttending(opt.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${attending === opt.value ? opt.color : '#e8d5b7'}`,
                    background: attending === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.02)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${attending === opt.value ? opt.color : '#475569'}`,
                    background: attending === opt.value ? opt.color : 'transparent',
                  }} />
                  <span style={{ color: attending === opt.value ? '#fff' : '#92400e', fontWeight: attending === opt.value ? '700' : '400', fontSize: '0.95rem' }}>
                    {opt.label}
                  </span>
            </div>
              ))}
        </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Your Name *
            </label>
            <input
              type="text" placeholder="Full name"
              value={name} onChange={e => setName(e.target.value)}
              style={input}
            />
          </div>

          {/* Number attending — only show if yes or maybe */}
          {(attending === 'yes' || attending === 'maybe') && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Number of People Attending
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                  <div key={n}
                    onClick={() => setCount(n)}
                    style={{
                      width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${count === n ? '#f59e0b' : '#e8d5b7'}`,
                      background: count === n ? 'rgba(201,148,58,0.15)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: count === n ? '#c9943a' : '#9a7a55',
                      fontWeight: count === n ? '800' : '400', fontSize: '0.95rem',
                      transition: 'all 0.15s',
                    }}
                  >
                  {n}
                  </div>
              ))}
            </div>
          </div>
          )}

          {/* Phone (optional) */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Phone Number <span style={{ color: '#b97a3a', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              type="tel" placeholder="+1 (719) 555-0000"
              value={phone} onChange={e => setPhone(e.target.value)}
              style={input}
            />
            </div>
          {/* Notes (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: '#92400e', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Notes <span style={{ color: '#b97a3a', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              placeholder="Any message for the temple..."
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '14px',
              background: submitting ? '#e8d5b7' : 'linear-gradient(135deg,#b45309,#78350f)',
              border: 'none', color: 'white', borderRadius: 12,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: '800', fontSize: '1rem', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {submitting ? '⏳ Submitting…' : '🙏 Submit RSVP'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: '#e8d5b7', fontSize: '0.75rem' }}>
          🌸 Om Namo Venkatesaya 🌸
        </div>
      </div>
    </div>
  );
}

