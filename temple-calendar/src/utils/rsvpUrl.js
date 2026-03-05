/**
 * src/utils/rsvpUrl.js
 * Generates shareable RSVP URLs and QR codes for events
 */

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_APP_URL || 'http://localhost:5173');

/**
 * Encode event info into a URL-safe base64 string used as eventId
 */
export const encodeEventId = (event) => {
  const payload = {
    eventId: event.id || event._id || String(event.date),
    title:   event.title,
    date:    event.date,
    time:    event.time || '',
  };
  return btoa(JSON.stringify(payload));
};

/**
 * Returns the public RSVP URL for an event
 */
export const getRsvpUrl = (event) => {
  const id = encodeEventId(event);
  return `${BASE_URL}/rsvp/${id}`;
};

/**
 * Returns the admin dashboard URL for an event
 * Requires VITE_ADMIN_SECRET in .env
 */
export const getAdminUrl = (event) => {
  const id     = encodeEventId(event);
  const secret = import.meta.env.VITE_ADMIN_SECRET || '';
  return `${BASE_URL}/admin/rsvp/${id}${secret ? `?secret=${secret}` : ''}`;
};

/**
 * Returns a QR code image URL (uses free api.qrserver.com — no key needed)
 */
export const getQrUrl = (event, size = 200) => {
  const rsvpUrl = getRsvpUrl(event);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rsvpUrl)}&color=7c2d12&bgcolor=FFF8E1`;
};
