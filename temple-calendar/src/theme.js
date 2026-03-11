/**
 * Premium Design System - CalendarFly Studio
 * Boxfox-inspired premium theme
 */

export const theme = {
  colors: {
    // Deep backgrounds
    deepNavy: '#0A0E27',
    midnight: '#1A1F3A',
    darkSlate: '#0F1729',
    
    // Accent colors
    electricPurple: '#6C5CE7',
    neonBlue: '#00D9FF',
    gold: '#FFD700',
    emerald: '#00F5A0',
    
    // Neutrals
    white: '#FFFFFF',
    lightGray: '#E5E7EB',
    mediumGray: '#9CA3AF',
    darkGray: '#374151',
    
    // Glass effects
    glassWhite: 'rgba(255, 255, 255, 0.1)',
    glassDark: 'rgba(0, 0, 0, 0.2)',
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #6C5CE7 0%, #00D9FF 100%)',
    hero: 'linear-gradient(135deg, #0A0E27 0%, #1A1F3A 50%, #2A1A4A 100%)',
    card: 'linear-gradient(135deg, rgba(108, 92, 231, 0.1) 0%, rgba(0, 217, 255, 0.1) 100%)',
    accent: 'linear-gradient(90deg, #FFD700 0%, #00F5A0 100%)',
  },
  
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
    md: '0 4px 16px rgba(0, 0, 0, 0.2)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.3)',
    glow: '0 0 20px rgba(108, 92, 231, 0.5)',
    neon: '0 0 30px rgba(0, 217, 255, 0.6)',
  },
  
  glass: {
    card: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    button: {
      background: 'rgba(108, 92, 231, 0.2)',
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(108, 92, 231, 0.3)',
    },
  },
  
  typography: {
    fontFamily: {
      sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: '"Poppins", sans-serif',
      serif: '"Playfair Display", serif',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
    },
  },
  
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
  },
};

export default theme;
