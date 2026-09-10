/**
 * GlassCard - Premium glassmorphism card component
 *
 * `light` renders a plain white/black-border card meant to sit on a white
 * page (the monochrome marketing site — landing, blog, pricing, etc.)
 * instead of the default translucent glass treatment, which only reads
 * correctly on a black surface.
 */
import React from 'react';

export default function GlassCard({ children, className = '', hover = false, gradient = false, light = false, ...rest }) {
  // ...rest forwards onClick and any other prop (onMouseEnter, id, aria-*,
  // etc.) to the underlying div — without this, a GlassCard used as a
  // clickable card (e.g. PremiumSignup.jsx's plan-selection cards) silently
  // never reacts to clicks, since neither branch below used to pass any
  // props through at all.
  if (light) {
    return (
      <div
        className={`
          relative overflow-hidden rounded-2xl
          border border-gray-200
          bg-white
          transition-all duration-300
          ${hover ? 'hover:border-gray-300 hover:shadow-xl hover:scale-[1.02]' : 'shadow-sm'}
          ${className}
        `}
        {...rest}
      >
        <div className="relative z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        backdrop-blur-xl
        border border-white/10
        transition-all duration-300
        ${gradient ? 'bg-gradient-to-br from-white/5 to-white/10' : 'bg-white/5'}
        ${hover ? 'hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:scale-[1.02]' : ''}
        ${className}
      `}
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
      {...rest}
    >
      {/* Gradient overlay */}
      {gradient && (
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.1) 0%, rgba(0, 217, 255, 0.1) 100%)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
