/**
 * src/utils/rsvpUrl.js
 * Generates shareable RSVP URLs and QR codes for events
 */

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (import.meta.env.VITE_APP_URL || 'http://localhost:5173');

// These share links (RSVP/Photos/Signups) are generated from the ADMIN
// dashboard, which is always browsed on the bare domain -- admins log in
// with email/password, not by visiting a per-org subdomain -- so BASE_URL
// alone resolves to NO organization once a devotee opens the link
// (confirmed in production logs: "[TENANT] No organization found for this
// domain", and the same 0-events symptom reproduces locally without an
// ?org= in the URL). The receiving pages (RSVPPage/useEvents,
// PhotoSharePage, SignupPage) already read a ?org= query param off their
// own URL and forward it to every API call they make -- see
// tenantMiddleware in server/middleware/tenant.js -- so appending it here
// is the whole fix, no changes needed on the receiving end. Reads the
// org's subdomain from the same `cf_org` localStorage AuthContext already
// keeps in sync (contexts/AuthContext.jsx) rather than threading it as a
// prop through every one of this file's callers.
function orgQuerySuffix() {
  try {
    const raw = localStorage.getItem('cf_org');
    const org = raw ? JSON.parse(raw) : null;
    return org && org.subdomain ? `?org=${encodeURIComponent(org.subdomain)}` : '';
  } catch {
    return '';
  }
}

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
/**
 * Returns the public calendar URL for this org -- same relative path/
 * ?org= convention as viewSiteUrl in AdminToolbar.jsx and ModeSelection's
 * viewerUrl, just as an ABSOLUTE url (via BASE_URL) since this one is
 * meant to be copied and pasted somewhere else (WhatsApp, email), not
 * just navigated to in-app.
 */
export const getPublicCalendarUrl = () => {
  return `${BASE_URL}/calendar${orgQuerySuffix()}`;
};

export const getEventKey = (event) => {
  const date = event.date || '';
  const title = slugify(event.title || 'event');
  return `${date}-${title}`;
};

/**
 * Returns the public RSVP URL for an event
 */
export const getRsvpUrl = (event) => {
  return `${BASE_URL}/rsvp/${getEventKey(event)}${orgQuerySuffix()}`;
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
 * Returns the public live photo album URL for an event (see
 * PhotoSharePage.jsx, routed at /photos/:eventId) — same slug as the RSVP
 * link above, just a different path, so it stays valid however the event
 * gets renamed/redated (getEventKey recomputes it from current data).
 */
export const getPhotoAlbumUrl = (event) => {
  return `${BASE_URL}/photos/${getEventKey(event)}${orgQuerySuffix()}`;
};
export const getPhotoAlbumQrUrl = (event, size = 200) => {
  const photoUrl = getPhotoAlbumUrl(event);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(photoUrl)}&color=7c2d12&bgcolor=FFF8E1`;
};

/**
 * Returns the public Sign-Up Sheets URL for an event (see SignupPage.jsx,
 * routed at /signups/:eventId) -- same slug pattern as RSVP/photos above,
 * shows every open sheet (Volunteer and/or Potluck) for that event.
 */
export const getSignupUrl = (event) => {
  return `${BASE_URL}/signups/${getEventKey(event)}${orgQuerySuffix()}`;
};
export const getSignupQrUrl = (event, size = 200) => {
  const signupUrl = getSignupUrl(event);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(signupUrl)}&color=7c2d12&bgcolor=FFF8E1`;
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
