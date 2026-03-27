/**
 * CalendarGrid Component
 * Displays monthly calendar with events, moon phase indicators, and improved typography
 */

import React from 'react';
import EventCard from './EventCard';

const CalendarGrid = ({ currentDate, events, onEditEvent, onDeleteEvent, onCreateFlyer, isAdmin }) => {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  };

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const getMoonPhase = (day) => {
    if (!day) return null;
    for (const e of getEventsForDay(day)) {
      if (e.moonPhase === 'new') return 'new';
      if (e.moonPhase === 'full') return 'full';
      const t = (e.tithi || '').toLowerCase();
      if (t.includes('amavasya')) return 'new';
      if (t.includes('purnima') || t.includes('purnama')) return 'full';
    }
    return null;
  };
  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();
  };
  return (
    <div style={{ fontFamily: "'Georgia','Times New Roman',serif" }}>
      

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(d => (
          <div key={d} style={{
            fontFamily:"'Georgia',serif", fontWeight:'800', letterSpacing:'0.04em',
            fontSize:'0.9rem', textAlign:'center', padding:'6px 2px',
            backgroundColor:'#fed7aa', color:'#7c2d12', borderRadius:'4px'
          }}>{d}</div>
        ))}

        {getDaysInMonth().map((day, idx) => {
          const moon = getMoonPhase(day);
          const today = isToday(day);
          return (
            <div key={idx} style={{
              minHeight:'7rem', padding:'5px',
              border: today ? '2px solid #f97316' : '1px solid #e5e7eb',
              borderRadius:'5px',
              backgroundColor: today ? '#fff7ed' : day ? '#ffffff' : '#f9fafb'
            }}>
            {day && (
              <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'3px' }}>
                    <span style={{
                      fontFamily:"'Georgia',serif", fontWeight:'700',
                      fontSize:'0.95rem', color: today ? '#150801' : '#374151'
                    }}>{day}</span>
                    {moon === 'new' && (
                      <span title="Amavasya — New Moon" style={{
                        width:'18px', height:'18px', borderRadius:'50%',
                        backgroundColor:'#979797', border:'2px solid #4b5563',
                        display:'inline-block', flexShrink:0
                      }}/>
                    )}
                    {moon === 'full' && (
                      <span title="Purnima — Full Moon" style={{
                        width:'18px', height:'18px', borderRadius:'50%',
                        backgroundColor:'#f8e793', border:'2px solid #ca8a04',
                        display:'inline-block', flexShrink:0
                      }}/>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                  {getEventsForDay(day).map(event => (
                      <EventCard key={event.id} event={event}
                        onEdit={onEditEvent} onDelete={onDeleteEvent} onCreateFlyer={onCreateFlyer} isAdmin={isAdmin}/>
                  ))}
                </div>
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
