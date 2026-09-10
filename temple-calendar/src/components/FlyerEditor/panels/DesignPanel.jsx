import React from 'react';
import { LAYOUTS, STYLES, COLORS } from '../constants';

const { sectionLabel: sL } = STYLES;

// Canvas size selector. Used to sit in its own wide card pinned below the
// canvas — that bar was an absolute overlay, so whenever the canvas ran
// taller than the visible viewport it overlapped and visually sliced
// through the poster ("break in the canvas" — a real layout bug). Moved
// into the Brand & Edit tab (AI mode) and Media tab (DIY mode) instead, as
// a plain field alongside the rest of those panels' controls, matching
// their sectionLabel styling rather than its old standalone-card look.
export default function DesignPanel({ layout, setLayout }) {
  return (
    <div>
      <span style={sL}>Canvas Size</span>
      <select value={layout} onChange={e => setLayout(e.target.value)} style={{
        width: '100%', padding: '8px 11px', background: '#ffffff',
        border: `1.5px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8,
        fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {Object.entries(LAYOUTS).map(([key, l]) => (
          <option key={key} value={key}>{l.label} — {l.desc}</option>
        ))}
      </select>
    </div>
  );
}
