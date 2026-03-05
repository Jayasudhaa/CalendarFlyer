import React from 'react';
import { THEMES, STYLES } from '../constants';

const { sectionLabel: sL } = STYLES;

export default function DesignPanel({ theme, setTheme, sponsorship, setSponsorship, onShowSponsor, onRemoveSponsor }) {
  return (
    <div>
      <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: 14 }}>🎨 Design</div>

      <span style={sL}>Color Theme</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {Object.entries(THEMES).map(([key, th]) => (
          <button key={key} onClick={() => setTheme(key)} style={{
            padding: '7px 6px',
            border: `2px solid ${theme === key ? '#c2410c' : '#334155'}`,
            background: theme === key ? 'rgba(194,65,12,0.18)' : '#0f172a',
            color: theme === key ? '#fb923c' : '#94a3b8',
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.75rem', fontWeight: theme === key ? '700' : '400',
          }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: th.bg, border: `2px solid ${th.border}`, flexShrink: 0 }} />
            {th.label}
          </button>
        ))}
      </div>

      <span style={sL}>Sponsorship</span>
      <button onClick={onShowSponsor} style={{
        width: '100%', padding: '11px 14px',
        background: sponsorship ? 'rgba(194,65,12,0.18)' : '#0f172a',
        border: `1.5px ${sponsorship ? 'solid #c2410c' : 'dashed #334155'}`,
        color: sponsorship ? '#fb923c' : '#475569',
        borderRadius: 8, cursor: 'pointer',
        textAlign: 'left', fontSize: '0.78rem',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>🙏</span>
        <span>{sponsorship ? `Sponsorship: ${sponsorship}` : 'Add sponsorship text…'}</span>
      </button>

      {sponsorship && (
        <button onClick={onRemoveSponsor} style={{
          width: '100%', marginTop: 4, padding: '4px',
          background: 'transparent', border: 'none',
          color: '#f87171', cursor: 'pointer', fontSize: '0.72rem',
        }}>
          ✕ Remove sponsorship
        </button>
      )}
    </div>
  );
}
