/**
 * GlassCard - Premium glassmorphism card component
 */
import React from 'react';

export default function GlassCard({ children, className = '', hover = false, gradient = false }) {
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
