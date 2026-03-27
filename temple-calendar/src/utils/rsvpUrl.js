/**
 * src/utils/rsvpUrl.js
 * Generates shareable RSVP URLs and QR codes for events
 */

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (import.meta.env.VITE_APP_URL || 'http://localhost:5173');

/**
 * Generate URL-friendly slug from event title
 */
const slugify = (text) =>
  (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/^-+|-+$/g, '');  // Trim - from start/end

/**
 * Generate consistent eventId from event data
 * Uses slugified title to match what's saved in DynamoDB
 */
export const getEventKey = (event) => {
  const date = event.date || '';
  const title = slugify(event.title || 'event');
  return `${date}-${title}`;
};

/**
 * Returns the public RSVP URL for an event
 */
export const getRsvpUrl = (event) => {
  return `${BASE_URL}/rsvp/${getEventKey(event)}`;
};
/**
 * Uses session authentication (no secret parameter needed)
 */
export const getAdminUrl = (event) => {
  return `${BASE_URL}/admin/rsvp/${getEventKey(event)}`;
};
export const getQrUrl = (event, size = 200) => {
  const rsvpUrl = getRsvpUrl(event);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rsvpUrl)}&color=7c2d12&bgcolor=FFF8E1`;
};
/**
 * LEGACY: Keep old base64 functions for backward compatibility
 * (Not used anymore, but kept in case old links exist)
 */
export const getEventId = getEventKey;

/**
 * Returns the public RSVP URL for an event
 */

/**
 * Returns the admin dashboard URL for an event
 * Requires VITE_ADMIN_SECRET in .env
 */

/**
 * Returns a QR code image URL (uses free api.qrserver.com — no key needed)
 */
