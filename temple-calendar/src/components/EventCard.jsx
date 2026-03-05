/**
 * EventCard Component
 * Displays individual event with type-based styling
 */

import React from 'react';
import { Edit, Trash2, FileImage } from 'lucide-react';

const EventCard = ({ event, onEdit, onDelete, onCreateFlyer, isAdmin }) => {
  const typeColors = {
    pooja: 'bg-orange-100 border-orange-300',
    festival: 'bg-purple-300 border-purple-300',
    holiday: 'bg-blue-100 border-blue-300',
    kalyanam: 'bg-pink-200 border-pink-200',
    abhishekam: 'bg-green-200 border-green-200',
    panchang: 'bg-amber-100 border-amber-400'
  };

  return (
    <div className={`p-2 mb-2 rounded border-l-4 ${typeColors[event.type] || 'bg-gray-100 border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div style={{ fontFamily:"'Georgia',serif", fontWeight:"600", fontSize:"0.9rem", lineHeight:"1.35" }}>{event.title}</div>
          {event.time && <div style={{ fontFamily:"'Georgia',serif", fontSize:"0.8rem", color:"#4b5563" }}>{event.time}</div>}
          {event.tithi && <div style={{ fontFamily:"'Georgia',serif", fontSize:"0.8rem", color:"#6b7280" }}>T: {event.tithi}</div>}
          {event.nakshatra && <div style={{ fontFamily:"'Georgia',serif", fontSize:"0.8rem", color:"#6b7280" }}>N: {event.nakshatra}</div>}
        </div>

        {isAdmin && (
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => onCreateFlyer && onCreateFlyer(event)}
              className="p-1 hover:bg-purple-200 rounded transition-colors"
              title="Create flyer"
            >
              <FileImage className="w-4 h-4 text-purple-600" />
            </button>
            <button
              onClick={() => onEdit(event)}
              className="p-1 hover:bg-blue-200 rounded transition-colors"
              title="Edit event"
            >
              <Edit className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="p-1 hover:bg-red-200 rounded transition-colors"
              title="Delete event"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
