/**
 * CalendarNavigation.jsx
 * Month navigation — premium warm charcoal theme matching CalendarGrid
 */

import React from 'react';

function CalendarNavigation({ currentDate, onMonthChange }) {



  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const prev  = () => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const next  = () => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const today = () => onMonthChange(new Date());
  const btnBase = {
    padding: '7px 16px',
    borderRadius: 8,
    border: '1px solid var(--cf-border)',
    background: 'var(--cf-bg-deep)',
    color: 'var(--cf-accent)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
    transition: 'all 0.18s ease',
  };
  return (
    <div
      style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      fontFamily: 'Georgia, serif',
      }}
    >
      <button
        onClick={prev}
        style={btnBase}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--cf-bg-card)';
          e.currentTarget.style.borderColor = 'var(--cf-accent)';
          e.currentTarget.style.color = 'var(--cf-accent-hover)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--cf-bg-deep)';
          e.currentTarget.style.borderColor = 'var(--cf-border)';
          e.currentTarget.style.color = 'var(--cf-accent)';
        }}
      >
        ← Previous
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2
          style={{
            fontSize: 'clamp(1.2rem, 2.5vw, 1.9rem)',
          fontWeight: 800,
            color: 'var(--cf-text-secondary)',
          letterSpacing: '0.02em',
          fontFamily: 'Georgia, serif',
          margin: 0,
          }}
        >
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={today}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--cf-border-accent)',
            background: 'var(--cf-accent-glow)',
            color: 'var(--cf-accent)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--cf-bg-deep)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--cf-accent-glow)'; }}
        >
          Today
        </button>
      </div>

      <button
        onClick={next}
        style={btnBase}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--cf-bg-card)';
          e.currentTarget.style.borderColor = 'var(--cf-accent)';
          e.currentTarget.style.color = 'var(--cf-accent-hover)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--cf-bg-deep)';
          e.currentTarget.style.borderColor = 'var(--cf-border)';
          e.currentTarget.style.color = 'var(--cf-accent)';
        }}
      >
        Next →
      </button>
    </div>
  );
}

export default CalendarNavigation;
