/**
 * SimpleEventCard Component
 * Simplified event display without panchang (for monthly highlights)
 */

import React from 'react';

const SimpleEventCard = ({ event }) => {
  const typeColors = {
    pooja: 'bg-orange-100 border-orange-300',
    festival: 'bg-purple-100 border-purple-300',
    holiday: 'bg-blue-100 border-blue-300',
    kalyanam: 'bg-pink-100 border-pink-300',
    abhishekam: 'bg-green-100 border-green-300'
  };

  // Format date
  const eventDate = new Date(event.date);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][eventDate.getDay()];
  const day = eventDate.getDate();

  return (
    <div className={`p-3 rounded border-l-4 ${typeColors[event.type] || 'bg-gray-100 border-gray-300'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-center">
          <div className="text-2xl font-bold text-orange-600">{day}</div>
          <div className="text-xs text-gray-500">{dayOfWeek}</div>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800">{event.title}</div>
          {event.time && <div className="text-xs text-gray-600 mt-1">{event.time}</div>}
        </div>
      </div>
    </div>
  );
};

export default SimpleEventCard;
