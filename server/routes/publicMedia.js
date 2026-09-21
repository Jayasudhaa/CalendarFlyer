/**
 * server/routes/publicMedia.js — the READ-ONLY, no-login-required side of
 * the Media feature, mounted at /api/public-media. Backs the public
 * calendar's event card indicators, the public event page's glimpse-video
 * + Photos content, and the org-wide public Photos/Glimpses galleries.
 *
 * Org resolution matches routes/events.js's own optionalAuth/resolveOrgId
 * pattern exactly: req.org comes from tenantMiddleware (subdomain or
 * ?org=), req.user from an optional admin token (irrelevant here but kept
 * for parity), so this file works identically to how every other public
 * route in this app resolves "whose calendar is this."
 *
 * `optionalCommunityAuth` (community-auth.js) is the other half of "who is
 * asking": a fully anonymous visitor sees 'public'/'link_only' content
 * only; a phone-verified community member (already required to Follow,
 * RSVP-verify, etc. elsewhere in this app) additionally sees
 * 'verified_attendees'/'members_only' content. 'private'/'hidden' never
 * appear from this file no matter who's asking -- those are admin-only,
 * reached through routes/livestreams.js / routes/photoAlbums.js instead.
 *
 * A glimpse video is a short (<=15s), admin-uploaded clip -- not a live
 * broadcast, so there is no live/upcoming/replay state here anymore, just
 * a list of published, visible glimpses per event.
 */

const express = require('express');
const { optionalCommunityAuth } = require('../community-auth');
const { getEvent } = require('../events');
const { listStreamsForEvent, listRecentGlimpsesForOrg } = require('../livestreams');
const { listAlbumsForEvent, listAlbumsForOrg, getAlbum } = require('../photoAlbums');
const { listLivePhotosForEvent } = require('../photos');

const router = express.Router();

function resolveOrgId(req) {
  if (req.user && req.user.org_id) return req.user.org_id;
  if (req.org && req.org.org_id) return req.org.org_id;
  return null;
}

/** Can this requester see something with this visibility setting? */
function isVisibleTo(visibility, req) {
  if (visibility === 'public' || visibility === 'link_only') return true;
  if (visibility === 'verified_attendees' || visibility === 'members_only') return !!req.communityUser;
  return false; // 'private' / 'hidden' -- never shown here, admin routes only
}

function publicStream(s) {
  return {
    stream_id: s.stream_id,
    event_id: s.event_id || null,
    date: s.date || null,
    title: s.title,
    video_url: s.video_url,
    cover_image_url: s.cover_image_url,
    duration_seconds: s.duration_seconds,
    visibility: s.visibility,
    created_at: s.created_at,
  };
}

function publicAlbum(a) {
  return {
    album_id: a.album_id,
    event_id: a.event_id,
    name: a.name,
    cover_photo_url: a.cover_photo_url,
    description: a.description,
    // hide_contributor_names governs per-photo attribution, which this app
    // doesn't currently render anywhere (photos carry member_id, never a
    // display name) -- surfaced here so the frontend can honor it the
    // moment it does add attribution, rather than silently ignoring the
    // admin's choice.
    photographer: a.hide_contributor_names ? null : a.photographer,
    visibility: a.visibility,
    download_permission: !!a.download_permission,
    photo_count: a.photo_count || 0,
    updated_at: a.updated_at,
  };
}

/** One event's media state, respecting visibility -- the shape both the
 *  single-event and batch endpoints below return per event. */
async function buildEventMediaSummary(event_id, req) {
  const [streams, albums] = await Promise.all([
    listStreamsForEvent(event_id),
    listAlbumsForEvent(event_id),
  ]);

  const visibleGlimpses = streams.filter((s) => isVisibleTo(s.visibility, req)).map(publicStream);

  const visibleAlbums = albums.filter((a) => a.publishing_status === 'published' && isVisibleTo(a.visibility, req));
  const photoCount = visibleAlbums.reduce((sum, a) => sum + (a.photo_count || 0), 0);
  // Registration/members-only indicators (Media spec's event-card icons)
  // read from whichever is more restrictive across this event's visible
  // media, since a card shows one badge, not one per stream/album.
  const anyVerifiedOnly = streams.some((s) => s.visibility === 'verified_attendees')
    || albums.some((a) => a.visibility === 'verified_attendees');
  const anyMembersOnly = streams.some((s) => s.visibility === 'members_only')
    || albums.some((a) => a.visibility === 'members_only');

  return {
    event_id,
    glimpses: visibleGlimpses,
    albums: visibleAlbums.map(publicAlbum),
    photo_count: photoCount,
    registration_required: anyVerifiedOnly,
    members_only: anyMembersOnly,
  };
}

// GET /api/public-media/events/:eventId — one event's glimpse-video/Photos
// state, for the public event page (EventDetailModal) and PhotoSharePage.
router.get('/events/:eventId', optionalCommunityAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.status(404).json({ error: 'No organization found for this request.' });
    const event = await getEvent(req.params.eventId);
    if (!event || event.org_id !== org_id) return res.status(404).json({ error: 'Event not found.' });
    const summary = await buildEventMediaSummary(req.params.eventId, req);
    res.json(summary);
  } catch (err) {
    console.error('[PUBLIC-MEDIA] Failed to load event media:', err);
    res.status(500).json({ error: 'Could not load media for that event.' });
  }
});

// POST /api/public-media/events/batch — the calendar's event-card badges
// (📹 Glimpse video / 📷 N photos / 🎟 / 🔒), one call for every event
// currently on screen instead of one request per card.
router.post('/events/batch', optionalCommunityAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.status(404).json({ error: 'No organization found for this request.' });
    const eventIds = Array.isArray(req.body && req.body.eventIds) ? req.body.eventIds.slice(0, 200) : [];
    if (!eventIds.length) return res.status(400).json({ error: 'eventIds must be a non-empty array.' });

    const results = {};
    await Promise.all(eventIds.map(async (event_id) => {
      try {
        results[event_id] = await buildEventMediaSummary(event_id, req);
      } catch {
        results[event_id] = { event_id, glimpses: [], albums: [], photo_count: 0 };
      }
    }));
    res.json({ results });
  } catch (err) {
    console.error('[PUBLIC-MEDIA] Failed to load batch media:', err);
    res.status(500).json({ error: 'Could not load media right now.' });
  }
});

// GET /api/public-media/glimpses-recent — the org-wide public Glimpses
// tab and the calendar header's "new glimpse" banner: this org's most
// recently published, publicly-visible glimpse videos.
router.get('/glimpses-recent', optionalCommunityAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.status(404).json({ error: 'No organization found for this request.' });
    const streams = (await listRecentGlimpsesForOrg(org_id, { limit: 30 })).filter((s) => isVisibleTo(s.visibility, req));
    // Attach the event's own title when there is one, since each card
    // reads "<Event Name>" -- a date-only glimpse (no event attached) has
    // no event to look up, so it falls back to its own title, or just its
    // date, formatted for display.
    const withEventNames = await Promise.all(streams.map(async (s) => {
      const event = s.event_id ? await getEvent(s.event_id).catch(() => null) : null;
      const fallback = s.title || (s.date ? new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null);
      return { ...publicStream(s), event_title: (event && event.title) || fallback };
    }));
    res.json({ recent: withEventNames });
  } catch (err) {
    console.error('[PUBLIC-MEDIA] Failed to load recent glimpses:', err);
    res.status(500).json({ error: 'Could not check for glimpse videos right now.' });
  }
});

// GET /api/public-media/albums — the org-wide public Photos tab: every
// PUBLISHED album visible to this requester, newest first.
router.get('/albums', optionalCommunityAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.status(404).json({ error: 'No organization found for this request.' });
    const albums = (await listAlbumsForOrg(org_id, { limit: 200 }))
      .filter((a) => a.publishing_status === 'published' && isVisibleTo(a.visibility, req));

    // The gallery groups by event (Media spec: "albums, not one large
    // collection of individual images") so it needs each album's event
    // name/date alongside the album's own fields. A "quick add photos"
    // album (no event picked -- see photoAlbums.js's synthetic event_id)
    // has no real event to look up, so it falls back to its own date,
    // same as a date-only glimpse video already does.
    const withEventInfo = await Promise.all(albums.map(async (a) => {
      const isQuick = !a.event_id || a.event_id.startsWith('noevent-');
      const event = isQuick ? null : await getEvent(a.event_id).catch(() => null);
      const dateLabel = a.date ? new Date(`${a.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
      // has_event tells the frontend whether this album can go through the
      // existing event-keyed photo page (PhotoSharePage, OTP + attendee
      // upload) or needs the plain album-id viewer instead -- a quick
      // album (no event picked) has no event to resolve that slug against.
      return { ...publicAlbum(a), event_title: (event && event.title) || dateLabel, event_date: (event && event.date) || a.date || null, has_event: !!event };
    }));
    res.json({ albums: withEventInfo });
  } catch (err) {
    console.error('[PUBLIC-MEDIA] Failed to load public albums:', err);
    res.status(500).json({ error: 'Could not load photo albums right now.' });
  }
});

// GET /api/public-media/albums/:albumId — one album's public detail: its
// settings (for the download button / attribution) plus its live photos.
router.get('/albums/:albumId', optionalCommunityAuth, async (req, res) => {
  try {
    const org_id = resolveOrgId(req);
    if (!org_id) return res.status(404).json({ error: 'No organization found for this request.' });
    const album = await getAlbum(req.params.albumId);
    if (!album || album.org_id !== org_id || album.publishing_status !== 'published') {
      return res.status(404).json({ error: 'Album not found.' });
    }
    if (!isVisibleTo(album.visibility, req)) {
      return res.status(403).json({ error: 'This album requires verification to view.', visibility: album.visibility });
    }

    const event = await getEvent(album.event_id).catch(() => null);
    const allEventPhotos = await listLivePhotosForEvent(album.event_id, { limit: 200 });
    // An event can in principle hold more than one album (see
    // photoAlbums.js's header comment); only show photos actually
    // stamped with THIS album once they're tagged that way, but fall back
    // to the whole event's live photos for the common one-album case so
    // photos registered before this album existed still show up.
    const stamped = allEventPhotos.filter((p) => p.album_id === album.album_id);
    const photos = (stamped.length ? stamped : allEventPhotos).map((p) => ({
      photo_id: p.photo_id,
      url: p.url,
      caption: p.caption || '',
      created_at: p.created_at,
    }));

    res.json({
      album: { ...publicAlbum(album), event_title: (event && event.title) || null, event_date: (event && event.date) || null },
      photos,
    });
  } catch (err) {
    console.error('[PUBLIC-MEDIA] Failed to load album detail:', err);
    res.status(500).json({ error: 'Could not load that album right now.' });
  }
});

module.exports = router;
