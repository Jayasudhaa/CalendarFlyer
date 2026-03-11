/**
 * Events Service
 * Handles all event-related data operations
 */

const STORAGE_KEY = 'templeEvents';

/**
 * Get all events from localStorage
 */
export const getAllEvents = () => {
  try {
    const savedEvents = localStorage.getItem(STORAGE_KEY);
    return savedEvents ? JSON.parse(savedEvents) : [];
  } catch (error) {
    console.error('Error loading events:', error);
    return [];
  }
};

/**
 * Save events to localStorage
 */
export const saveEvents = (events) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error('Error saving events:', error);
    return false;
  }
};

/**
 * Add new event
 */
export const addEvent = (event) => {
  const events = getAllEvents();
  const newEvent = {
    ...event,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
  };
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
};

/**
 * Update existing event
 */
export const updateEvent = (eventId, updatedData) => {
  const events = getAllEvents();
  const index = events.findIndex(e => e.id === eventId);
  
  if (index !== -1) {
    events[index] = { ...events[index], ...updatedData };
    saveEvents(events);
    return events[index];
  }
  return null;
};

/**
 * Delete event
 */
export const deleteEvent = (eventId) => {
  const events = getAllEvents();
  const filteredEvents = events.filter(e => e.id !== eventId);
  saveEvents(filteredEvents);
  return true;
};

/**
 * Get events for specific month
 */
export const getEventsByMonth = (year, month) => {
  const events = getAllEvents();
  return events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getMonth() === month && eventDate.getFullYear() === year;
  });
};

/**
 * Get events for specific date
 */
export const getEventsByDate = (dateString) => {
  const events = getAllEvents();
  return events.filter(event => event.date === dateString);
};

const getEventYear = (event) => {
  if (!event.date) return null;
  const year = parseInt(event.date.substring(0, 4), 10);
  return isNaN(year) ? null : year;
};
/**
 * Import multiple events
 */
export const importEvents = (newEvents, expectedYear = null) => {
  const existing = getAllEvents();
  if (!expectedYear && newEvents.length > 0) {
    expectedYear = getEventYear(newEvents[0]);
  }
  const yearFiltered = expectedYear
    ? newEvents.filter(e => getEventYear(e) === expectedYear)
    : newEvents;
  const rejected = newEvents.length - yearFiltered.length;
  const fingerprint = (e) =>
    `${e.date}__${(e.type || '').toLowerCase()}__${(e.title || '').toLowerCase().trim()}`;
  const existingKeys = new Set(existing.map(fingerprint));
  const deduplicated = yearFiltered.filter(e => !existingKeys.has(fingerprint(e)));
  const updatedEvents = [...existing, ...deduplicated];
  saveEvents(updatedEvents);
  return {
    total: updatedEvents.length,
    added: deduplicated.length,
    skipped: yearFiltered.length - deduplicated.length,
    rejected,                // events from wrong year — never imported
    year: expectedYear
  };
};

/**
 * Clear all events
 */
export const clearAllEvents = () => {
  saveEvents([]);
  return true;
};

export const clearEventsByYear = (year) => {
  const events = getAllEvents();
  const kept = events.filter(e => getEventYear(e) !== year);
  const removed = events.length - kept.length;
  saveEvents(kept);
  return { removed, remaining: kept.length, year };
};

export const deduplicateStoredEvents = () => {
  const events = getAllEvents();
  const seen = new Set();
  const unique = events.filter(e => {
    const key = `${e.date}__${(e.type || '').toLowerCase()}__${(e.title || '').toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const removed = events.length - unique.length;
  saveEvents(unique);
  return { removed, remaining: unique.length };
};
export const exportEvents = () => {
  const events = getAllEvents();
  return JSON.stringify(events, null, 2);
};
