/**
 * PremiumButton - Animated gradient button
 */
import React from 'react';

export default function PremiumButton({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  fullWidth = false,
  type = 'button'
}) {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white shadow-lg shadow-purple-500/50',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    ghost: 'bg-transparent hover:bg-white/5 text-white',
    gold: 'bg-gradient-to-r from-yellow-400 to-emerald-400 hover:from-yellow-500 hover:to-emerald-500 text-gray-900 font-bold shadow-lg shadow-yellow-500/30',
    // Monochrome pairs for the black & white marketing site (landing/blog).
    // 'mono'/'monoOutline' are for use ON a black surface (e.g. the dark
    // footer banner): white-filled, and its outline counterpart.
    mono: 'bg-white hover:bg-gray-200 text-black font-bold shadow-lg shadow-white/10',
    monoOutline: 'bg-transparent hover:bg-white hover:text-black text-white border border-white/40',
    // 'dark'/'darkOutline' are for use ON a white surface (the landing page,
    // blog, nav): black-filled, and its outline counterpart.
    dark: 'bg-black hover:bg-gray-800 text-white font-bold shadow-lg shadow-black/20',
    darkOutline: 'bg-transparent hover:bg-black hover:text-white text-black border border-black/60',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-xl font-semibold
        transition-all duration-300
        transform hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        relative overflow-hidden
      `}
    >
      <span className="relative z-10">{children}</span>
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
    </button>
  );
}
