
import React from 'react';
import { Calendar, Clock, MapPin, Edit2, Trash2, Image } from 'lucide-react';

const EventCard = ({ event, onEdit, onDelete, onCreateFlyer, isAdmin }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  // Generate Google Calendar URL
  const getGoogleCalendarUrl = () => {
    const date = new Date(event.date + 'T12:00:00');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const time = event.time || '10:00 AM';
    const [timeStr, period] = time.split(' ');
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const startDateTime = `${year}${month}${day}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
    const endDateTime = `${year}${month}${day}T${String(hours + 2).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
    const details = event.description || '';
    const location = event.location || '1495 South Ridge Road, Castle Rock, CO 80104';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDateTime}/${endDateTime}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  };


  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
      boxShadow: '0 2px 6px rgba(139, 69, 19, 0.15)',
      border: '2px solid #CD853F',
      transition: 'all 0.2s'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 69, 19, 0.25)';
      e.currentTarget.style.borderColor = '#8B4513';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = '0 2px 6px rgba(139, 69, 19, 0.15)';
      e.currentTarget.style.borderColor = '#CD853F';
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      {/* Event Title - Premium Style */}
      <h3 style={{
        fontSize: '1.05rem',
        fontWeight: '700',
        color: '#8B4513',
        marginBottom: '10px',
        lineHeight: '1.3',
        fontFamily: 'Georgia, serif'
      }}>
            {event.title}
      </h3>
      {/* Event Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5d4037' }}>
          <Calendar className="w-4 h-4" style={{ color: '#CD853F', flexShrink: 0 }} />
          <span style={{ fontWeight: '500' }}>{formatDate(event.date)}</span>
          </div>
        
          {event.time && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5d4037' }}>
            <Clock className="w-4 h-4" style={{ color: '#CD853F', flexShrink: 0 }} />
            <span style={{ fontWeight: '500' }}>{event.time}</span>
            </div>
          )}

        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#5d4037' }}>
            <MapPin className="w-4 h-4" style={{ color: '#CD853F', flexShrink: 0 }} />
            <span style={{ fontWeight: '500' }}>{event.location}</span>
            </div>
          )}
      </div>

      {/* Description */}
      {event.description && (
        <p style={{
          fontSize: '0.85rem',
          color: '#6b5d56',
          marginBottom: '12px',
          lineHeight: '1.5',
          fontStyle: 'italic'
        }}>
          {event.description}
        </p>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* +GCal Button - PREMIUM STYLE */}
        <button
          onClick={() => window.open(getGoogleCalendarUrl(), '_blank')}
          style={{
            background: 'linear-gradient(135deg, #4285f4 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex', 
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 3px 8px rgba(66, 133, 244, 0.3)',
            transition: 'all 0.2s',
            flex: isAdmin ? '0' : '1',
            justifyContent: 'center'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 5px 12px rgba(66, 133, 244, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 3px 8px rgba(66, 133, 244, 0.3)';
          }}
        >
          <Calendar className="w-4 h-4" />
          +GCal
        </button>
        {/* Admin Buttons */}
        {isAdmin && (
          <>
            <button
              onClick={() => onEdit(event)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.85rem',
              fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 3px 8px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 5px 12px rgba(245, 158, 11, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(245, 158, 11, 0.3)';
              }}
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>

            <button
              onClick={() => onDelete(event.id)}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.85rem',
              fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 3px 8px rgba(239, 68, 68, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 5px 12px rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(239, 68, 68, 0.3)';
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            {onCreateFlyer && (
              <button
                onClick={() => onCreateFlyer(event)}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 8px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 5px 12px rgba(124, 58, 237, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(124, 58, 237, 0.3)';
                }}
              >
                <Image className="w-4 h-4" />
                Flyer
              </button>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default EventCard;
