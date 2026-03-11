/**
 * src/utils/gcalUtils.js
 * Google Calendar integration utilities
 * Generates .ics files for "Add to Calendar" functionality
 */

/**
 * Format date for ICS format (YYYYMMDDTHHMMSS)
 */
const formatGCalDate = (dateStr, timeStr = '') => {
  const date = new Date(dateStr + 'T12:00:00'); // Default to noon
  
  if (timeStr) {
    // Parse time like "10:00 AM"
    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      const period = timeParts[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      date.setHours(hours, minutes, 0, 0);
    }
  }
  
  // Format as YYYYMMDDTHHMMSS
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}T${hour}${minute}00`;
};

/**
 * Generate ICS file content
 */
export const openGoogleCalendar = (event) => {
  const startDate = formatGCalDate(event.date, event.time);
  
  // End time is 2 hours after start (default duration)
  const endDateObj = new Date(startDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
  endDateObj.setHours(endDateObj.getHours() + 2);
  const endYear = endDateObj.getFullYear();
  const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDateObj.getDate()).padStart(2, '0');
  const endHour = String(endDateObj.getHours()).padStart(2, '0');
  const endMinute = String(endDateObj.getMinutes()).padStart(2, '0');
  const endDate = `${endYear}${endMonth}${endDay}T${endHour}${endMinute}00`;
  
  const title = encodeURIComponent(event.title || 'Temple Event');
  const description = encodeURIComponent(event.description || '');
  const location = encodeURIComponent('Sri Venkateswara Swamy Temple of Colorado, 1495 South Ridge Road, Castle Rock, CO 80104');
  
  // ICS file format
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}&location=${location}`;
  
  window.open(url, '_blank');
};

/**
 * Download ICS file
 */
export const downloadICS = openGoogleCalendar;

/**
 * Get Google Calendar URL (alternative to .ics download)
 */
export const getGoogleCalendarUrl = (event) => {
  const startDate = formatGCalDate(event.date, event.time);
  const title = encodeURIComponent(event.title || 'Temple Event');
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${startDate}&details=${details}&location=${location}`;
};
