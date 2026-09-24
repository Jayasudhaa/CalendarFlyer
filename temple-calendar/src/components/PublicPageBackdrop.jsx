/**
 * src/components/PublicPageBackdrop.jsx
 * Shared decorative page background for visitor-facing pages (the org
 * calendar page, the Explore/Radar page) -- a near-white surface with a
 * faint diagonal light sweep and a thin geometric arc/line motif in the
 * upper-right, rather than a flat solid color. Fixed and behind everything
 * (pointer-events: none, negative z-index) so it never intercepts clicks
 * or affects layout -- the page's own content just needs a background
 * that isn't opaque so this shows through (or renders its own content in
 * a position: relative wrapper).
 */
import React from 'react';

export default function PublicPageBackdrop() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
        // Flat white -- the previous version faded to a light gray
        // (#f3f3f4/#ececee) toward the bottom-right, which read as slightly
        // off-white/gray rather than a clean white page background.
        background: '#ffffff',
      }}
    >
      <svg width="1000" height="560" viewBox="0 0 1000 560" style={{ position: 'absolute', top: -100, right: -160 }}>
        <circle cx="760" cy="180" r="280" fill="none" stroke="#00000014" strokeWidth="1" />
        <circle cx="760" cy="180" r="195" fill="none" stroke="#00000010" strokeWidth="1" />
        <circle cx="760" cy="180" r="115" fill="none" stroke="#0000000d" strokeWidth="1" />
        <line x1="420" y1="560" x2="1000" y2="20" stroke="#00000012" strokeWidth="1" />
        <line x1="540" y1="560" x2="1000" y2="140" stroke="#00000012" strokeWidth="1" />
        <line x1="660" y1="560" x2="1000" y2="260" stroke="#00000012" strokeWidth="1" />
        <line x1="780" y1="560" x2="1000" y2="380" stroke="#00000012" strokeWidth="1" />
      </svg>
    </div>
  );
}
