/**
 * BrandMark - the small CalendarFly logo glyph used in headers/footers.
 *
 * Replaces <img src="/calendarfly-icon.png" .../> everywhere it was being
 * used as a small square icon. That PNG is actually a full promotional
 * poster (crowd silhouettes, five feature callouts, the wordmark, a
 * tagline) meant to be viewed large — squeezed into a 40-56px rounded
 * square it reads as illegible noise. A composite raster scene like that
 * can't be cleanly cropped down to an icon (there's no isolated element on
 * its own transparent layer), so this is a purpose-built, crisp SVG mark
 * instead: scales perfectly at any size.
 *
 * Solid black-on-white by default (for the light-background pages —
 * PremiumSignup, etc.); pass `light` to flip it to white-on-black for the
 * marketing site's now-monochrome black nav/footer, where a black badge
 * would disappear into the background.
 *
 * The full poster graphic is untouched and still used for the PWA/app
 * icons in manifest.json and OG/share images, where a fuller illustration
 * at a large size is the right call.
 */
import React from 'react';

export default function BrandMark({ size = 48, radius, light = false }) {
  const r = radius ?? Math.max(8, Math.round(size * 0.22));
  const bg = light ? '#ffffff' : '#0a0a0a';
  const fg = light ? '#0a0a0a' : '#ffffff';
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: bg,
        border: light ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.14)',
      }}
    >
      <svg
        width={Math.round(size * 0.58)}
        height={Math.round(size * 0.58)}
        viewBox="0 0 24 24"
        fill="none"
        stroke={fg}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <path d="M16 2.5v4M8 2.5v4M3 10h18" />
        <circle cx="8" cy="15" r="1.15" fill={fg} stroke="none" />
        <circle cx="12" cy="15" r="1.15" fill={fg} stroke="none" />
        <circle cx="16" cy="15" r="1.15" fill={fg} stroke="none" />
      </svg>
    </span>
  );
}
