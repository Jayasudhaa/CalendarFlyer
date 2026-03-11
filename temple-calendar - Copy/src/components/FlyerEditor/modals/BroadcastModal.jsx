import React, { useState } from 'react';

const PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: '#25d366',
    darkColor: '#128c3e',
    description: 'Broadcast to your temple WhatsApp group',
  },
  {
    id: 'facebook',
    label: 'Facebook Page',
    icon: '📘',
    color: '#1877f2',
    darkColor: '#0d5cb6',
    description: 'Post to your temple Facebook page',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    color: '#e1306c',
    darkColor: '#a01040',
    description: 'Share to your temple Instagram page',
  },
];

export default function BroadcastModal({ onClose, fabricRef, event }) {
  const [selected,   setSelected]   = useState({ whatsapp: true, facebook: false, instagram: false });
  const [caption,    setCaption]    = useState(buildCaption(event));
  const [status,     setStatus]     = useState({}); // { whatsapp: 'sending'|'done'|'error', ... }
  const [errors,     setErrors]     = useState({});
  const [allDone,    setAllDone]    = useState(false);

  function buildCaption(ev) {
    // FIXED: Use correct deployment domain instead of window.location.origin
    const baseUrl = 'https://jyuxa8xvk6.us-east-2.awsapprunner.com';
    if (!ev) return `🙏 Join us for our upcoming event!\n\nRSVP & details: ${baseUrl}`;
    const lines = [`🙏 *${ev.title || 'Temple Event'}*`];
    if (ev.date)        lines.push(`📅 ${ev.date}`);
    if (ev.time)        lines.push(`🕐 ${ev.time}`);
    if (ev.location)    lines.push(`📍 ${ev.location}`);
    if (ev.description) lines.push(`\n${ev.description}`);
    lines.push('\n🌸 Sri Venkateswara Swamy Temple of Colorado');
    // RSVP link — matches App.jsx route /rsvp/:eventId
    const eventSlug = (ev.title || 'event').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const rsvpUrl   = `${baseUrl}/rsvp/${eventSlug}`;
    lines.push(`\n📋 RSVP: ${rsvpUrl}`);
    return lines.join('\n');
  }

  // Get flyer as base64 PNG from canvas
  const getFlyerBase64 = () => {
    const canvas = fabricRef?.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
    return dataUrl; // full data:image/png;base64,... string
  };

  const handleBroadcast = async () => {
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) return;

    const imageBase64 = getFlyerBase64();
    if (!imageBase64) { alert('Canvas not ready'); return; }

    // Reset
    const newStatus = {};
    platforms.forEach(p => { newStatus[p] = 'sending'; });
    setStatus(newStatus);
    setErrors({});

    // Fire all selected platforms in parallel
    await Promise.all(platforms.map(async (platform) => {
      try {
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, imageBase64, caption, event }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed');
        setStatus(prev => ({ ...prev, [platform]: 'done' }));
      } catch (err) {
        setStatus(prev => ({ ...prev, [platform]: 'error' }));
        setErrors(prev => ({ ...prev, [platform]: err.message }));
      }
    }));

    setAllDone(true);
  };

  const anySelected  = Object.values(selected).some(Boolean);
  const isSending    = Object.values(status).some(s => s === 'sending');
  const allSuccess   = allDone && Object.values(status).every(s => s === 'done');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, width: 480, maxWidth: '95vw',
        border: '1px solid #334155', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '1.1rem' }}>📣 Broadcast Flyer</div>
            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
              {event?.title || 'Temple Event'} — share to your community
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* Platform selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Choose Platforms
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLATFORMS.map(p => {
                const isOn  = selected[p.id];
                const st    = status[p.id];
                return (
                  <div key={p.id}
                    onClick={() => !isSending && setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: `2px solid ${isOn ? p.color : '#334155'}`,
                      background: isOn ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                      cursor: isSending ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isOn ? p.color : '#475569'}`,
                      background: isOn ? p.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', color: 'white', fontWeight: '900',
                    }}>
                      {isOn && '✓'}
                    </div>

                    {/* Icon */}
                    <span style={{ fontSize: '1.4rem' }}>{p.icon}</span>

                    {/* Label */}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>{p.label}</div>
                      <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{p.description}</div>
                    </div>

                    {/* Status badge */}
                    {st === 'sending' && (
                      <div style={{ color: '#facc15', fontSize: '0.75rem', fontWeight: '600' }}>⏳ Sending…</div>
                    )}
                    {st === 'done' && (
                      <div style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: '700' }}>✓ Sent!</div>
                    )}
                    {st === 'error' && (
                      <div style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: '600' }} title={errors[p.id]}>
                        ✗ Failed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Caption editor */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Caption / Message
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={6}
              style={{
                width: '100%', padding: '12px', boxSizing: 'border-box',
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: 10, color: '#e2e8f0', fontSize: '0.82rem',
                lineHeight: 1.7, resize: 'vertical', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 4 }}>
              *bold* for WhatsApp bold text. Max 1024 chars for WhatsApp.
            </div>
          </div>

          {/* Error details */}
          {Object.keys(errors).length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
              {Object.entries(errors).map(([p, msg]) => (
                <div key={p} style={{ color: '#fca5a5', fontSize: '0.78rem' }}>
                  <strong>{p}:</strong> {msg}
                </div>
              ))}
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 6 }}>
                Check your API keys in server .env — see setup guide below.
              </div>
            </div>
          )}

          {/* Success */}
          {allSuccess && (
            <div style={{ marginBottom: 16, padding: '14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ color: '#34d399', fontWeight: '700', fontSize: '0.95rem' }}>🎉 Broadcast sent successfully!</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>Your community will receive the flyer shortly.</div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', border: '1px solid #334155',
              background: 'transparent', color: '#94a3b8',
              borderRadius: 10, cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem',
            }}>
              Cancel
            </button>
            <button
              onClick={handleBroadcast}
              disabled={!anySelected || isSending || allSuccess}
              style={{
                flex: 2, padding: '12px',
                background: !anySelected || isSending || allSuccess
                  ? '#334155'
                  : 'linear-gradient(135deg,#c2410c,#7c2d12)',
                border: 'none', color: 'white', borderRadius: 10,
                cursor: !anySelected || isSending || allSuccess ? 'not-allowed' : 'pointer',
                fontWeight: '800', fontSize: '0.92rem',
                transition: 'background 0.15s',
              }}
            >
              {isSending ? '⏳ Broadcasting…' : allSuccess ? '✓ Done' : `📣 Broadcast Now`}
            </button>
          </div>


        </div>
      </div>
    </div>
  );
}
