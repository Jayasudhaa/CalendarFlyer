import React, { useRef } from 'react';

function UploadButton({ label, sub, icon, onChange, accentColor }) {
  const border   = accentColor ? `2px dashed ${accentColor}` : '2px dashed #334155';
  const bg       = accentColor ? 'rgba(194,65,12,0.08)' : 'rgba(255,255,255,0.02)';
  const color    = accentColor ? '#fb923c' : '#94a3b8';

  return (

      <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: '600', marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: 6 }}>{sub}</div>
      <div style={{ position: 'relative', width: '100%' }}>
        <button style={{ width: '100%', padding: '14px', border, background: bg, color, borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: accentColor ? '600' : '400', pointerEvents: 'none' }}>
          📤 {label}
        </button>
        <input type="file" accept="image/*" onChange={onChange}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
      </div>
      </div>
  );
}

export default function UploadPanel({ onUpload, onSetBackground, hasBg, onRemoveBg }) {
  return (
    <div>
      <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: 14 }}>📤 Upload</div>

      <UploadButton label="Temple Logo"         sub="Placed in header corners"             icon="🏛" onChange={e => onUpload(e, true)}  />
      <UploadButton label="Deity / Event Photo" sub="Placed in center image area"          icon="🖼" onChange={e => onUpload(e, false)} />
      <UploadButton label="Background Template" sub="Fills entire canvas behind all elements" icon="🎨" accentColor="#c2410c" onChange={e => onSetBackground(e)} />

      {/* Background controls */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: '600', marginBottom: 2 }}>🔁 Selected Image as Background</div>
        <div style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: 6 }}>Select any image on canvas, then click</div>
        <button onClick={() => onSetBackground(null)} style={{ width: '100%', padding: '11px', border: '1.5px solid #475569', background: '#0f172a', color: '#cbd5e1', borderRadius: 9, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
          ⬇ Set Selected as Background
        </button>
      </div>

      {/* Undo background — only shown when a background is active */}
      {hasBg && (
        <div style={{ marginBottom: 14, padding: '12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 9 }}>
          <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: '600', marginBottom: 6 }}>🖼 Background is active</div>
          <button onClick={onRemoveBg} style={{ width: '100%', padding: '10px', background: 'rgba(220,38,38,0.2)', border: '1px solid #dc2626', color: '#fca5a5', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
            🗑 Remove Background
        </button>
      </div>
      )}

      <div style={{ marginTop: 4, padding: '12px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 9, fontSize: '0.72rem', color: '#a5b4fc', lineHeight: 1.9 }}>
        💡 <strong>Tips</strong><br />
        • Background sits behind all text &amp; images<br />
        • Use Image panel → Edit tools to crop &amp; blur<br />
        • Double-click text to edit inline<br />
        • Delete / Backspace removes selected object
      </div>
    </div>
  );
}
