/**
 * CalendarNavigation Component
 * Month navigation controls
 */

import React from 'react';

const CalendarNavigation = ({ currentDate, onMonthChange }) => {
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="flex justify-between items-center mb-4">
      <button
        onClick={handlePrevMonth}
        className="px-4 py-2 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
      >
        ← Previous
      </button>

      <div className="flex gap-2 items-center">
        <h2 className="text-4xl font-extrabold text-orange-800 tracking-wide">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={handleToday}
          className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
        >
          Today
        </button>
      </div>

      <button
        onClick={handleNextMonth}
        className="px-4 py-2 bg-orange-100 rounded hover:bg-orange-200 transition-colors"
      >
        Next →
      </button>
    </div>
  );
};

export default CalendarNavigation;
