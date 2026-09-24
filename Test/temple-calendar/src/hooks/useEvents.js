/**
 * useEvents Hook
 * Custom hook for managing events state and operations
 */

import { useState, useEffect, useCallback } from 'react';
function authHeaders() {
  const token = localStorage.getItem('cf_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
function orgQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get('org');
  return org ? `?org=${encodeURIComponent(org)}` : '';
}
async function apiGetEvents() {
  const res = await fetch('/api/events' + orgQueryParam(), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Failed to load events');
  const data = await res.json();
  return (data.events || []).map(e => ({ ...e, id: e.event_id }));
}
async function apiAddEvent(eventData) {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(eventData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add event');
  }
  const data = await res.json();
  return { ...data.event, id: data.event.event_id, duplicate: !!data.duplicate };
}

async function apiUpdateEvent(eventId, updatedData) {
  const res = await fetch(`/api/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updatedData)
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { ...data.event, id: data.event.event_id };
}
async function apiDeleteEvent(eventId) {
  const res = await fetch(`/api/events/${eventId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  });
  return res.ok;
}
export const useEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load events on mount

  /**
   * Load all events
   */
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedEvents = await apiGetEvents();
      setEvents(loadedEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load events on mount
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const addEvent = useCallback(async (eventData) => {
    try {
      const newEvent = await apiAddEvent(eventData);
      if (!newEvent.duplicate) {
        setEvents(prev => [...prev, newEvent]);
      }
      return { success: true, event: newEvent, duplicate: !!newEvent.duplicate };
    } catch (err) {
      setError('Failed to add event');
      console.error(err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Update event
   */
  const updateEvent = useCallback(async (eventId, updatedData) => {
    try {
      const updated = await apiUpdateEvent(eventId, updatedData);
      if (updated) {
        setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
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
  const deleteEvent = useCallback(async (eventId) => {
    try {
      const ok = await apiDeleteEvent(eventId);
      if (!ok) return { success: false, error: 'Event not found' };
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
   * onProgress (optional) — called after each item as { done, total, added, skipped, rejected }
   * so callers can show live status instead of a blind wait.
   */
  const importEvents = useCallback(async (newEvents, onProgress) => {
    let added = 0, skipped = 0, rejected = 0;
    // Every rejection's actual server message used to be thrown away (just
    // rejected++), so a failed bulk import gave no clue why -- a plan's
    // monthly event-limit 403 looked identical to a malformed row. Keep the
    // first occurrence of each distinct message so the caller can show it.
    const rejectReasons = {};
    const items = newEvents || [];
    const total = items.length;
    let done = 0;
    for (const ev of items) {
    try {
        const result = await apiAddEvent(ev);
        if (result.duplicate) skipped++; else added++;
      } catch (err) {
        rejected++;
        const msg = err && err.message ? err.message : 'Unknown error';
        rejectReasons[msg] = (rejectReasons[msg] || 0) + 1;
        }
      done++;
      if (onProgress) onProgress({ done, total, added, skipped, rejected });
    }
    await loadEvents();
    return { success: true, added, skipped, rejected, rejectReasons };
  }, [loadEvents]);

  /**
   * Clear all events
   */
  const clearAll = useCallback(async () => {
    try {
      for (const ev of events) {
        await apiDeleteEvent(ev.id);
      }
      setEvents([]);
      return { success: true };
    } catch (err) {
      setError('Failed to clear events');
      return { success: false };
    }
  }, [events]);
  const clearYear = useCallback(async (year) => {
    try {
      // Bare 'YYYY-MM-DD' parses as UTC midnight, which is the *previous*
      // local day in every US timezone — without the T12:00:00 anchor, a
      // Jan 1 event could read as Dec 31 locally and dodge "clear year
      // 2026" (or get swept up in "clear year 2025" instead). Matches the
      // same fix already used in CalendarGrid.jsx.
      const toRemove = events.filter(e => new Date(e.date + 'T12:00:00').getFullYear() === year);
      for (const ev of toRemove) {
        await apiDeleteEvent(ev.id);
      }
      const remaining = events.filter(e => new Date(e.date + 'T12:00:00').getFullYear() !== year);
      setEvents(remaining);
      return { success: true, removed: toRemove.length, remaining: remaining.length };
    } catch (err) {
      setError('Failed to clear year');
      return { success: false };
    }
  }, [events]);

  /**
   * Get events for specific month
   */
  const getEventsByMonth = useCallback((year, month) => {
    return events.filter(event => {
      const eventDate = new Date(event.date + 'T12:00:00');
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
    events, loading, error,
    loadEvents, addEvent, updateEvent, deleteEvent,
    importEvents, clearAll, clearYear,
    getEventsByMonth, getEventsByDate
  };
};
