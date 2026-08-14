/**
 * RSVPPage.jsx
 * Route: /rsvp?event=event-slug
 *
 * Add to your router:
 *   import RSVPPage from './components/RSVPPage';
 *   <Route path="/rsvp" element={<RSVPPage />} />
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

const ATTENDING_OPTIONS = [
  { value: 'yes',   label: '✅ Yes, I\'ll be there',  color: '#16a34a' },
  { value: 'no',    label: '❌ Sorry, can\'t make it', color: '#dc2626' },
  { value: 'maybe', label: '🤔 Maybe',                color: '#d97706' },
];

function getEventByKey(key) {
  try {
    const events = JSON.parse(localStorage.getItem('templeEvents') || '[]');
    if (!key) return null;
    // Match by date-title slug format: YYYY-MM-DD-title-slug
    return events.find(e => {
      const slug = (e.title || '').toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
      return key === `${e.date}-${slug}`;
    }) || null;
  } catch { return null; }
}
export default function RSVPPage() {
  const { eventId } = useParams();
  const event = getEventByKey(eventId);
  const eventName = event?.title || 'Temple Event';
  const eventDate = event?.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const eventTime = event?.time || '';

  const [attending,   setAttending]   = useState('');
  const [name,      setName]      = useState('');
  const [count,     setCount]     = useState(1);
  const [phone,       setPhone]       = useState('');
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async () => {
    if (!name.trim())  return setError('Please enter your name');
    if (!attending)    return setError('Please select your attendance');
    setError('');
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
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const input = {
    width: '100%', padding: '12px 14px', boxSizing: 'border-box',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, color: '#e2e8f0', fontSize: '0.95rem',
    outline: 'none', fontFamily: 'Georgia, serif',
  };
  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🙏</div>
        <div style={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: '800', fontFamily: 'Georgia', marginBottom: 8 }}>
          Thank You, {name}!
        </div>
        <div style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.7 }}>
          Your RSVP for <strong style={{ color: '#e2e8f0' }}>{eventName}</strong> has been received.
          {attending === 'yes' && ` We look forward to seeing you!`}
          {attending === 'maybe' && ` We hope you can make it!`}
          {attending === 'no' && ` We'll miss you. Hope to see you at the next event!`}
        </div>
        <div style={{ marginTop: 24, color: '#64748b', fontSize: '0.85rem' }}>
          🌸 Sri Venkateswara Swamy Temple of Colorado
        </div>
        </div>
      </div>
    );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '32px 16px', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🛕</div>
          <div style={{ color: '#fbbf24', fontSize: '1.3rem', fontWeight: '800', marginBottom: 4 }}>
            {eventName}
          </div>
          {eventDate && <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 2 }}>📅 {eventDate}{eventTime ? ` · 🕐 ${eventTime}` : ''}</div>}
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Sri Venkateswara Swamy Temple of Colorado
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', padding: 28 }}>
          {/* Attending options */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Will you attend?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ATTENDING_OPTIONS.map(opt => (
                <div key={opt.value}
                  onClick={() => setAttending(opt.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${attending === opt.value ? opt.color : '#334155'}`,
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
                  <span style={{ color: attending === opt.value ? '#fff' : '#94a3b8', fontWeight: attending === opt.value ? '700' : '400', fontSize: '0.95rem' }}>
                    {opt.label}
                  </span>
            </div>
              ))}
        </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
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
              <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Number of People Attending
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                  <div key={n}
                    onClick={() => setCount(n)}
                    style={{
                      width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${count === n ? '#f59e0b' : '#334155'}`,
                      background: count === n ? 'rgba(245,158,11,0.15)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: count === n ? '#fbbf24' : '#64748b',
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
            <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Phone Number <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              type="tel" placeholder="+1 (719) 555-0000"
              value={phone} onChange={e => setPhone(e.target.value)}
              style={input}
            />
            </div>
          {/* Notes (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              Notes <span style={{ color: '#475569', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
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
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%', padding: '14px',
              background: submitting ? '#334155' : 'linear-gradient(135deg,#b45309,#78350f)',
              border: 'none', color: 'white', borderRadius: 12,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: '800', fontSize: '1rem', fontFamily: 'Georgia, serif',
            }}
          >
            {submitting ? '⏳ Submitting…' : '🙏 Submit RSVP'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: '#334155', fontSize: '0.75rem' }}>
          🌸 Om Namo Venkatesaya 🌸
        </div>
      </div>
    </div>
  );
}

