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
    Promise.all([
      fetch('/api/events').then(r => r.json()).catch(() => []),
      fetch('/api/events/panchang').then(r => r.json()).catch(() => []),
    ])
      .then(([eventsData, panchangData]) => {
        const events   = Array.isArray(eventsData)   ? eventsData   : [];
        const panchang = Array.isArray(panchangData)  ? panchangData : [];
        const all = [...events, ...panchang];
        eventService.saveEvents(all);
        setEvents(all);
      })
      .catch(err => {
        console.warn('[useEvents] DynamoDB fetch failed, falling back to localStorage:', err.message);
      eventService.deduplicateStoredEvents();
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
        setError('Using cached events — check connection');
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Load all events
   */
  const loadEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/events').then(r => r.json()).catch(() => []),
      fetch('/api/events/panchang').then(r => r.json()).catch(() => []),
    ])
      .then(([eventsData, panchangData]) => {
        const events   = Array.isArray(eventsData)  ? eventsData  : [];
        const panchang = Array.isArray(panchangData) ? panchangData : [];
        const all = [...events, ...panchang];
        eventService.saveEvents(all);
        setEvents(all);
      })
      .catch(err => {
        console.warn('[useEvents] Load failed:', err.message);
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
        setError('Using cached events');
      })
      .finally(() => setLoading(false));
  }, []);
  const syncToDynamo = useCallback(async (eventsToSync) => {
    const token = localStorage.getItem('cf_token');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    try {
      const regular = eventsToSync.filter(e => e.type !== 'panchang');
      await fetch('/api/chat/sync-dynamo', {
        method: 'POST', headers,
        body: JSON.stringify({ events: regular }),
      });
      const panchang = eventsToSync.filter(e => e.type === 'panchang');
      if (panchang.length > 0) {
        await fetch('/api/chat/sync-panchang', {
          method: 'POST', headers,
          body: JSON.stringify({ events: panchang }),
      });
      }
    } catch (err) {
      console.warn('[useEvents] DynamoDB sync error:', err.message);
    }
  }, []);

  /**
   * Add new event
   */
  const addEvent = useCallback(async (eventData) => {
    try {
      const newEvent = eventService.addEvent(eventData);
      const all = eventService.getAllEvents();
      setEvents(all);
      await syncToDynamo(all);
      return { success: true, event: newEvent };
    } catch (err) {
      setError('Failed to add event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, [syncToDynamo]);

  /**
   * Update event
   */
  const updateEvent = useCallback(async (eventId, updatedData) => {
    try {
      const updated = eventService.updateEvent(eventId, updatedData);
      if (updated) {
        const all = eventService.getAllEvents();
        setEvents(all);
        await syncToDynamo(all);
        return { success: true, event: updated };
      }
      return { success: false, error: 'Event not found' };
    } catch (err) {
      setError('Failed to update event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, [syncToDynamo]);

  /**
   * Delete event
   */
  const deleteEvent = useCallback(async (eventId) => {
    try {
      eventService.deleteEvent(eventId);
      const all = eventService.getAllEvents();
      setEvents(all);
      await syncToDynamo(all);
      return { success: true };
    } catch (err) {
      setError('Failed to delete event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, [syncToDynamo]);

  /**
   * Import events
   */
  const importEvents = useCallback(async (newEvents) => {
    console.log('[useEvents] Importing events:', newEvents?.length || 0, 'events');
    try {
      const result = eventService.importEvents(newEvents);
      console.log('[useEvents] Import result:', result);
      const loadedEvents = eventService.getAllEvents();
      setEvents(loadedEvents);
      const token = localStorage.getItem('cf_token');
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      try {
        console.log('[useEvents] Auto-syncing events to DynamoDB...');
        const regularEvents = loadedEvents.filter(e => e.type !== 'panchang');
        const res = await fetch('/api/chat/sync-dynamo', {
          method: 'POST', headers,
          body: JSON.stringify({ events: regularEvents }),
        });
        const data = await res.json();
        if (res.ok) {
          console.log(`[useEvents] ✅ Auto-synced ${regularEvents.length} events to DynamoDB`);
        } else {
          console.warn('[useEvents] ⚠️ Events DynamoDB sync failed:', data.error);
        }
      } catch (syncErr) {
        console.warn('[useEvents] ⚠️ Events auto-sync error:', syncErr.message);
      }
      const panchangEvents = loadedEvents.filter(e => e.type === 'panchang');
      if (panchangEvents.length > 0) {
        try {
          console.log(`[useEvents] Auto-syncing ${panchangEvents.length} panchang entries to DynamoDB...`);
          const res = await fetch('/api/chat/sync-panchang', {
            method: 'POST', headers,
            body: JSON.stringify({ events: panchangEvents }),
        });
        const data = await res.json();
        if (res.ok) {
            console.log(`[useEvents] ✅ Auto-synced ${panchangEvents.length} panchang entries to DynamoDB`);
        } else {
            console.warn('[useEvents] ⚠️ Panchang DynamoDB sync failed:', data.error);
        }
      } catch (syncErr) {
          console.warn('[useEvents] ⚠️ Panchang auto-sync error:', syncErr.message);
        }
      }
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
  const clearAll = useCallback(async () => {
    try {
      eventService.clearAllEvents();
      setEvents([]);
      await syncToDynamo([]);
      return { success: true };
    } catch (err) {
      setError('Failed to clear events');
      return { success: false };
    }
  }, [syncToDynamo]);
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
