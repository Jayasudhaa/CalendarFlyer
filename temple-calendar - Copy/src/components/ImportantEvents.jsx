/**
 * ImportantEvents Component
 * Shows monthly event highlights (excluding panchang)
 */

import React from 'react';
import SimpleEventCard from './SimpleEventCard';

const ImportantEvents = ({ events }) => {
  // Filter out panchang entries
  const importantEvents = events.filter(event => event.type !== 'panchang');

  if (importantEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-orange-700 mb-4">
          Important Events This Month
        </h3>
        <p className="text-gray-500 text-center py-8">
          No events scheduled for this month
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-orange-700 mb-4">
        Important Events This Month
      </h3>
      <div className="grid md:grid-cols-2 gap-4">
        {importantEvents.map(event => (
          <SimpleEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

export default ImportantEvents;
