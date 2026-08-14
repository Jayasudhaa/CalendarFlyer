/**
 * useEvents Hook
 * Custom hook for managing events state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import * as eventService from '../services/eventService';

export const useEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load events on mount
  useEffect(() => {
    setLoading(true);
    try {
      eventService.deduplicateStoredEvents();
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load all events
   */
  const loadEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Add new event
   */
  const addEvent = useCallback((eventData) => {
    try {
      const newEvent = eventService.addEvent(eventData);
      setEvents(prev => [...prev, newEvent]);
      return { success: true, event: newEvent };
    } catch (err) {
      setError('Failed to add event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Update event
   */
  const updateEvent = useCallback((eventId, updatedData) => {
    try {
      const updated = eventService.updateEvent(eventId, updatedData);
      if (updated) {
        setEvents(prev => 
          prev.map(e => e.id === eventId ? updated : e)
        );
        return { success: true, event: updated };
      }
      return { success: false, error: 'Event not found' };
    } catch (err) {
      setError('Failed to update event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Delete event
   */
  const deleteEvent = useCallback((eventId) => {
    try {
      eventService.deleteEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      return { success: true };
    } catch (err) {
      setError('Failed to delete event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Import events
   */
  const importEvents = useCallback((newEvents) => {
    console.log('[useEvents] Importing events:', newEvents?.length || 0, 'events');
    try {
      const result = eventService.importEvents(newEvents);
      console.log('[useEvents] Import result:', result);
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
      return { success: true, added: result.added, skipped: result.skipped, rejected: result.rejected, year: result.year };
    } catch (err) {
      console.error('[useEvents] Import error:', err);
      setError('Failed to import events');
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Clear all events
   */
  const clearAll = useCallback(() => {
    try {
      eventService.clearAllEvents();
      setEvents([]);
      return { success: true };
    } catch (err) {
      setError('Failed to clear events');
      return { success: false };
    }
  }, []);
  const clearYear = useCallback((year) => {
    try {
      const result = eventService.clearEventsByYear(year);
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
      return { success: true, removed: result.removed, remaining: result.remaining };
    } catch (err) {
      setError('Failed to clear year');
      return { success: false };
    }
  }, []);

  /**
   * Get events for specific month
   */
  const getEventsByMonth = useCallback((year, month) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
  }, [events]);

  /**
   * Get events for specific date
   */
  const getEventsByDate = useCallback((dateString) => {
    return events.filter(event => event.date === dateString);
  }, [events]);

  return {
    events,
    loading,
    error,
    loadEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    importEvents,
    clearAll,
    clearYear,
    getEventsByMonth,
    getEventsByDate
  };
};
