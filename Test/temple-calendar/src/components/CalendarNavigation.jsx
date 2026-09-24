/**
 * CalendarNavigation.jsx
 * Month navigation — premium warm charcoal theme matching CalendarGrid
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { playClick } from '../utils/sound';

function CalendarNavigation({ currentDate, onMonthChange, legend, onAddEvent }) {

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const prev  = () => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const next  = () => onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const today = () => onMonthChange(new Date());
  const btnBase = {
    padding: '8px 18px',
    borderRadius: 8,
    border: '1px solid var(--cf-border)',
    background: 'var(--cf-bg-deep)',
    color: '#000000',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Playfair Display', Georgia, serif",
    transition: 'all 0.18s ease',
  };
  return (
    <div
      style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 14,
      fontFamily: "'Playfair Display', Georgia, serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={prev}
          style={btnBase}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#000000';
            e.currentTarget.style.borderColor = '#000000';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--cf-bg-deep)';
            e.currentTarget.style.borderColor = 'var(--cf-border)';
            e.currentTarget.style.color = '#000000';
          }}
        >
          ← Previous
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2
            style={{
              fontSize: 'clamp(1.4rem, 2.8vw, 2.15rem)',
            fontWeight: 800,
              color: '#000000',
            letterSpacing: '0.02em',
            fontFamily: "'Playfair Display', Georgia, serif",
            margin: 0,
            whiteSpace: 'nowrap',
            }}
          >
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={today}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "'Playfair Display', Georgia, serif",
              boxShadow: '0 3px 8px -3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Today
          </button>
        </div>

        <button
          onClick={next}
          style={btnBase}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#000000';
            e.currentTarget.style.borderColor = '#000000';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--cf-bg-deep)';
            e.currentTarget.style.borderColor = 'var(--cf-border)';
            e.currentTarget.style.color = '#000000';
          }}
        >
          Next →
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {legend && legend.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
            {legend.map(({ key, label, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}22` }} />
                <span style={{ fontSize: 12.5, color: '#000000', fontWeight: 600, fontFamily: "'Playfair Display', Georgia, serif" }}>{label}</span>
              </div>
            ))}
          </div>
        )}
        {onAddEvent && (
          <button onClick={() => { playClick(); onAddEvent(); }} className="cf-nav-btn cf-nav-cta" style={{ padding: '8px 16px', fontSize: 14 }}>
            <Plus size={16} strokeWidth={2.5} /> Add Event
          </button>
        )}
      </div>
    </div>
  );
}

export default CalendarNavigation;
