import React, { useState, useRef } from 'react';

const PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: '#25d366',
    description: 'Broadcast to your temple WhatsApp group',
  },
  {
    id: 'facebook',
    label: 'Facebook Page',
    icon: '📘',
    color: '#1877f2',
    description: 'Post to your temple Facebook page',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📸',
    color: '#e1306c',
    description: 'Share to your temple Instagram page',
  },
];

const TEMPLATES = [
  { label: '🙏 Pooja Invite',    build: (ev) => buildTemplate(ev, 'pooja') },
  { label: '🎉 Festival',        build: (ev) => buildTemplate(ev, 'festival') },
  { label: '📢 Announcement',    build: (ev) => buildTemplate(ev, 'announcement') },
  { label: '✏️ Custom',          build: () => '' },
];

  function buildCaption(ev) {
    const baseUrl = 'https://calendarflyapp.com';
    if (!ev) return `🙏 Join us for our upcoming event!\n\nRSVP & details: ${baseUrl}/calendar`;
    const lines = [`🙏 *${ev.title || 'Temple Event'}*`];
    if (ev.date)        lines.push(`📅 ${ev.date}`);
    if (ev.time)        lines.push(`🕐 ${ev.time}`);
    if (ev.location)    lines.push(`📍 ${ev.location}`);
    if (ev.description) lines.push(`\n${ev.description}`);
    lines.push('\n🌸 Sample Temple Name');
    const dateSlug = ev.date || '';
    const titleSlug = (ev.title || 'event').toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
    const rsvpUrl = ev.date ? `${baseUrl}/rsvp/${dateSlug}-${titleSlug}` : `${baseUrl}/calendar`;
    lines.push(`\n📋 RSVP: ${rsvpUrl}`);
    return lines.join('\n');
  }

function buildTemplate(ev, type) {
  const baseUrl  = 'https://calendarflyapp.com';
  const title    = ev?.title    || 'Temple Event';
  const date     = ev?.date     || '';
  const time     = ev?.time     || '';
  const location = ev?.location || 'Sample Temple Name';
  const dateSlug  = date;
  const titleSlug = title.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  const rsvpUrl  = date ? `${baseUrl}/rsvp/${dateSlug}-${titleSlug}` : `${baseUrl}/calendar`;
  if (type === 'pooja') {
    return [
      `🪔 *${title}*`,
      '',
      `You are warmly invited to join us for a sacred pooja ceremony.`,
      '',
      date     && `📅 ${date}`,
      time     && `🕐 ${time}`,
      location && `📍 ${location}`,
      '',
      `🌸 Sample Temple Name`,
      ``,
      `📋 RSVP: ${rsvpUrl}`,
    ].filter(l => l !== false).join('\n');
  }
  if (type === 'festival') {
    return [
      `🎊 *${title} — Celebrations Begin!*`,
      '',
      `Join our temple family for this auspicious occasion filled with devotion, culture, and community.`,
      '',
      date     && `📅 ${date}`,
      time     && `🕐 ${time}`,
      location && `📍 ${location}`,
      '',
      `All are welcome. Bring your family and friends! 🙏`,
      ``,
      `🌸 Sample Temple Name`,
      `📋 RSVP: ${rsvpUrl}`,
    ].filter(l => l !== false).join('\n');
  }
  if (type === 'announcement') {
    return [
      `📢 *Important Announcement — ${title}*`,
      '',
      date     && `📅 ${date}`,
      time     && `🕐 ${time}`,
      location && `📍 ${location}`,
      '',
      `Please mark your calendars and share with your family and friends.`,
      '',
      `🌸 Sample Temple Name`,
      `📋 Details: ${rsvpUrl}`,
    ].filter(l => l !== false).join('\n');
  }
  return '';
}
export default function BroadcastModal({ onClose, fabricRef, event }) {
  const [selected, setSelected] = useState({ whatsapp: true, facebook: false, instagram: false });
  const [caption,  setCaption]  = useState(buildCaption(event));
  const [status,   setStatus]   = useState({});
  const [errors,   setErrors]   = useState({});
  const [allDone,  setAllDone]  = useState(false);
  const [flyerThumb, setFlyerThumb] = useState(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  // Generate flyer thumbnail on mount
  React.useEffect(() => {
    try {
      const canvas = fabricRef?.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 0.4 });
      setFlyerThumb(dataUrl);
    } catch (e) {
      // canvas not ready
    }
  }, [fabricRef]);
  function getFlyerBase64() {
    const canvas = fabricRef?.current;
    if (!canvas) return null;
    return canvas.toDataURL({ format: 'png', multiplier: 2 });
  };
  function applyTemplate(tpl, idx) {
    setActiveTemplate(idx);
    const text = tpl.build(event);
    if (text) setCaption(text);
    setShowTemplates(false);
  };

  const handleBroadcast = async () => {
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) return;

    const imageBase64 = getFlyerBase64();
    if (!imageBase64) { alert('Canvas not ready'); return; }

    const newStatus = {};
    platforms.forEach(p => { newStatus[p] = 'sending'; });
    setStatus(newStatus);
    setErrors({});
    setAllDone(false);

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
  const allSuccess  = allDone && Object.keys(status).length > 0 && Object.values(status).every(s => s === 'done');
  const charCount   = caption.length;
  const charColor   = charCount > 950 ? '#f87171' : charCount > 800 ? '#facc15' : '#475569';

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    },
    card: {
      background: '#111827',
      borderRadius: 18,
      width: 520,
      maxWidth: '100%',
      maxHeight: '92vh',
      overflowY: 'auto',
      border: '1px solid #1f2937',
      boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      scrollbarWidth: 'thin',
      scrollbarColor: '#1f2937 transparent',
    },
    header: {
      padding: '20px 22px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '1px solid #1f2937',
    },
    sectionLabel: {
      color: '#4b5563',
      fontSize: '0.68rem',
      fontWeight: '700',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    platformRow: (isOn, color, isSending) => ({
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderRadius: 11,
      border: `1.5px solid ${isOn ? color : '#1f2937'}`,
      background: isOn ? `${color}12` : 'rgba(255,255,255,0.015)',
      cursor: isSending ? 'default' : 'pointer',
      transition: 'all 0.15s',
      marginBottom: 8,
    }),
    checkbox: (isOn, color) => ({
      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
      border: `2px solid ${isOn ? color : '#374151'}`,
      background: isOn ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.65rem', color: 'white', fontWeight: '900',
    }),
    textarea: {
      width: '100%', padding: '11px 13px', boxSizing: 'border-box',
      background: '#0d1117',
      border: '1.5px solid #1f2937',
      borderRadius: 10, color: '#e2e8f0', fontSize: '0.82rem',
      lineHeight: 1.75, resize: 'vertical', outline: 'none',
      fontFamily: 'inherit', minHeight: 140,
      transition: 'border-color 0.15s',
    },
    templateBtn: (isActive) => ({
      padding: '5px 11px',
      borderRadius: 20,
      border: `1px solid ${isActive ? '#6366f1' : '#1f2937'}`,
      background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
      color: isActive ? '#a5b4fc' : '#6b7280',
      fontSize: '0.72rem',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.12s',
    }),
    cancelBtn: {
      flex: 1, padding: '11px',
      border: '1px solid #1f2937',
      background: 'transparent', color: '#6b7280',
      borderRadius: 10, cursor: 'pointer',
      fontWeight: '600', fontSize: '0.86rem',
    },
    broadcastBtn: (disabled) => ({
      flex: 2, padding: '11px',
      background: disabled
        ? '#1f2937'
        : 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)',
      border: 'none', color: disabled ? '#4b5563' : 'white',
      borderRadius: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: '800', fontSize: '0.9rem',
      transition: 'all 0.15s',
      letterSpacing: '0.01em',
    }),
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.card}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: '800', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              📣 Broadcast Flyer
            </div>
            <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 3 }}>
              {event?.title || 'Temple Event'} — share to your community
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0 4px', transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = '#9ca3af'}
            onMouseLeave={e => e.target.style.color = '#4b5563'}
          >×</button>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>

          {/* ── Flyer Thumbnail ── */}
          {(flyerThumb || fabricRef?.current) && (
            <div style={{ marginBottom: 18 }}>
              <div style={S.sectionLabel}>Flyer Attached</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.06)',
                border: '1.5px solid rgba(99,102,241,0.2)',
                borderRadius: 11,
              }}>
                {flyerThumb ? (
                  <img
                    src={flyerThumb}
                    alt="Flyer preview"
                    onLoad={() => setThumbLoaded(true)}
                    style={{
                      width: 52, height: 52, objectFit: 'cover',
                      borderRadius: 7, border: '1px solid #1f2937',
                      flexShrink: 0, opacity: thumbLoaded ? 1 : 0,
                      transition: 'opacity 0.3s',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 52, height: 52, borderRadius: 7,
                    background: '#1f2937', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem',
                  }}>🖼️</div>
                )}
                <div>
                  <div style={{ color: '#a5b4fc', fontWeight: '700', fontSize: '0.82rem' }}>
                    ✓ Flyer ready to send
            </div>
                  <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 2 }}>
                    Your designed flyer will be included with this broadcast
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── Platform Selection ── */}
          <div style={{ marginBottom: 18 }}>
            <div style={S.sectionLabel}>Choose Platforms</div>
              {PLATFORMS.map(p => {
                const isOn  = selected[p.id];
                const st    = status[p.id];
                return (
                <div
                  key={p.id}
                    onClick={() => !isSending && setSelected(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  style={S.platformRow(isOn, p.color, isSending)}
                  >
                  <div style={S.checkbox(isOn, p.color)}>{isOn && '✓'}</div>

                  <span style={{ fontSize: '1.25rem' }}>{p.icon}</span>

                    <div style={{ flex: 1 }}>
                    <div style={{ color: '#f1f5f9', fontWeight: '700', fontSize: '0.88rem' }}>{p.label}</div>
                    <div style={{ color: '#4b5563', fontSize: '0.7rem' }}>{p.description}</div>
                    </div>

                    {/* Status badge */}
                  {!st && !isOn && (
                    <div style={{ color: '#374151', fontSize: '0.68rem', fontWeight: '600', background: '#1f2937', padding: '3px 8px', borderRadius: 20 }}>
                      Off
                    </div>
                  )}
                    {st === 'sending' && (
                    <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(251,191,36,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(251,191,36,0.2)' }}>
                      ⏳ Sending
                    </div>
                    )}
                    {st === 'done' && (
                    <div style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(52,211,153,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(52,211,153,0.2)' }}>
                      ✓ Sent
                    </div>
                    )}
                    {st === 'error' && (
                    <div style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(248,113,113,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(248,113,113,0.2)' }} title={errors[p.id]}>
                        ✗ Failed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          {/* ── Message Templates ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={S.sectionLabel}>Caption / Message</div>
              <button
                onClick={() => setShowTemplates(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6366f1', fontSize: '0.72rem', fontWeight: '700',
                  padding: '2px 0', letterSpacing: '0.02em',
                }}
              >
                {showTemplates ? '▲ Hide templates' : '✨ Use template'}
              </button>
          </div>

            {showTemplates && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyTemplate(tpl, idx)}
                    style={S.templateBtn(activeTemplate === idx)}
                  >
                    {tpl.label}
                  </button>
                ))}
            </div>
            )}
            <textarea
              value={caption}
              onChange={e => { setCaption(e.target.value); setActiveTemplate(null); }}
              rows={7}
              style={S.textarea}
              onFocus={e => e.target.style.borderColor = '#374151'}
              onBlur={e => e.target.style.borderColor = '#1f2937'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
              <div style={{ color: '#374151', fontSize: '0.68rem' }}>
                *bold* for WhatsApp bold text
              </div>
              <div style={{ color: charColor, fontSize: '0.7rem', fontWeight: '600', transition: 'color 0.2s' }}>
                {charCount} / 1024
              </div>
            </div>
          </div>

          {/* ── Errors ── */}
          {Object.keys(errors).length > 0 && (
            <div style={{
              marginTop: 14, padding: '12px 14px',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10,
            }}>
              {Object.entries(errors).map(([p, msg]) => (
                <div key={p} style={{ color: '#fca5a5', fontSize: '0.77rem', marginBottom: 3 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{p}:</strong> {msg}
                </div>
              ))}
              <div style={{ color: '#4b5563', fontSize: '0.7rem', marginTop: 6 }}>
                Check your API keys in App Runner environment variables.
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {allSuccess && (
            <div style={{
              marginTop: 14, padding: '14px',
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 10, textAlign: 'center',
            }}>
              <div style={{ color: '#34d399', fontWeight: '800', fontSize: '0.95rem' }}>🎉 Broadcast sent!</div>
              <div style={{ color: '#4b5563', fontSize: '0.74rem', marginTop: 4 }}>Your community will receive the flyer shortly.</div>
            </div>
          )}

          {/* ── WhatsApp Broadcast List — no API needed ── */}
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            background: 'rgba(37,211,102,0.06)',
            border: '1.5px solid rgba(37,211,102,0.2)',
            borderRadius: 11,
            }}>
            <div style={{ color: '#4b5563', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              💬 WhatsApp Broadcast List — No API Needed
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', marginBottom: 10, lineHeight: 1.5 }}>
              Opens WhatsApp with your message pre-filled. Select your <strong style={{ color: '#34d399' }}>Broadcast List</strong> and tap Send — reaches all members who have saved your number.
            </div>
            <button
              onClick={() => {
                const msg = caption + (caption.includes('calendarflyapp.com') ? '' : '\n\n📋 RSVP: https://calendarflyapp.com/calendar');
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              style={{
                width: '100%', padding: '10px',
                background: 'linear-gradient(135deg, #25d366, #128c3e)',
                border: 'none', borderRadius: 9,
                color: '#fff', fontWeight: '800', fontSize: '0.88rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                boxShadow: '0 3px 10px rgba(37,211,102,0.3)',
              }}
            >
              💬 Open WhatsApp with Message
            </button>
          </div>
          {/* ── Actions ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={onClose} style={S.cancelBtn}>Cancel</button>
            <button
              onClick={handleBroadcast}
              disabled={!anySelected || isSending || allSuccess}
              style={S.broadcastBtn(!anySelected || isSending || allSuccess)}
            >
              {isSending ? '⏳ Broadcasting…' : allSuccess ? '✓ Done' : '📣 API Broadcast'}
            </button>
          </div>


        </div>
      </div>
    </div>
  );
}
