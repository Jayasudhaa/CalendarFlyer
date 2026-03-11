/**
 * EventCard - CLEANER with compact icon row
 */

import React from 'react';
import { openGoogleCalendar } from '../utils/gcalUtils';

const EventCard = ({ event, onEdit, onDelete, onCreateFlyer, isAdmin }) => {
  const typeColors = {
    festival: { bg: '#fef3c7', text: '#78350f', border: '#fbbf24' },
    pooja: { bg: '#fce7f3', text: '#831843', border: '#f472b6' },
    abhishekam: { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' },
    jayanti: { bg: '#e0e7ff', text: '#3730a3', border: '#818cf8' },
    special: { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
  };

  const style = typeColors[event.type] || typeColors.special;
  return (
    <div style={{
      backgroundColor: style.bg,
      borderLeft: `4px solid ${style.border}`,
      borderRadius: '6px',
      padding: '8px 10px',
      fontSize: '0.75rem',
      lineHeight: '1.3',
      color: style.text,
      position: 'relative',
      transition: 'all 0.2s',
    }}>
      {/* Event Title & Type */}
      <div style={{ fontWeight: '700', marginBottom: '4px', paddingRight: isAdmin ? '0' : '0' }}>
            {event.title}
          </div>
      {/* Time */}
          {event.time && (
        <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '4px' }}>
          🕐 {event.time}
            </div>
          )}

      {/* Tithi & Nakshatra (compact) */}
      {(event.tithi || event.nakshatra) && (
        <div style={{ fontSize: '0.65rem', opacity: 0.75, marginBottom: isAdmin ? '6px' : '0' }}>
          {event.tithi && <span>T: {event.tithi}</span>}
          {event.tithi && event.nakshatra && <span> • </span>}
          {event.nakshatra && <span>N: {event.nakshatra}</span>}
            </div>
          )}

      {/* Admin Action Icons - COMPACT ROW */}
        {isAdmin && (
          <div style={{ 
            display: 'flex', 
            gap: '6px',
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: `1px solid ${style.border}30`
          }}>
            {/* Google Calendar */}
            <button
            onClick={(e) => { e.stopPropagation(); openGoogleCalendar(event); }}
              style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
              gap: '3px'
              }}
            title="Add to Google Calendar"
            >
            📅 GCal
            </button>
            {/* Flyer */}
            <button
            onClick={(e) => { e.stopPropagation(); onCreateFlyer(event); }}
              style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
              gap: '3px'
              }}
            title="Create Flyer"
            >
            🎨 Flyer
            </button>
            {/* Edit */}
            <button
            onClick={(e) => { e.stopPropagation(); onEdit(event); }}
              style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
              gap: '3px'
              }}
            title="Edit Event"
            >
            ✏️ Edit
            </button>
            {/* Delete */}
            <button
            onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
              style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
              gap: '3px'
              }}
            title="Delete Event"
            >
            🗑️ Del
            </button>
          </div>
        )}
    </div>
  );
};

export default EventCard;
