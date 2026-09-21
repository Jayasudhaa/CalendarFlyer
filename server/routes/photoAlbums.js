/**
 * server/routes/photoAlbums.js — admin photo album management, mounted at
 * /api/photo-albums (see server.js). Backs the Media Overview page's
 * "Recent albums" panel, the top summary cards, and the Create Photo
 * Album form.
 *
 * This file owns album *settings* (name, cover, visibility, upload/
 * download/approval toggles). The photos themselves are still individual
 * rows in calendarfly_event_photos (server/photos.js, routes/photos.js) --
 * that file's attendee-upload and moderation-queue routes are unchanged
 * except for one deliberate policy change: an attendee upload never
 * auto-publishes, full stop (see routes/photos.js's own comment on this).
 */

const express = require('express');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getEvent } = require('../events');
const {
  createAlbum,
  getAlbum,
  updateAlbum,
  deleteAlbum,
  listAlbumsForEvent,
  listAlbumsForOrg,
  countPublishedAlbumsForOrg,
  VISIBILITY_OPTIONS,
} = require('../photoAlbums');
const { listPendingReviewForOrg } = require('../photos');

const router = express.Router();

/** Loads the album and checks it belongs to org_id. Returns the album, or null. */
async function loadAlbumForOrg(album_id, org_id) {
  const album = await getAlbum(album_id);
  if (!album || album.org_id !== org_id) return null;
  return album;
}

// POST /api/photo-albums — create an album for an event.
router.post('/', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { event_id, name } = req.body;
    if (!event_id || !name) {
      return res.status(400).json({ error: 'event_id and name are required.' });
    }
    const event = await getEvent(event_id);
    if (!event || event.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (req.body.visibility && !VISIBILITY_OPTIONS.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITY_OPTIONS.join(', ')}.` });
    }

    const album = await createAlbum(req.user.org_id, req.user.user_id, req.body);
    res.status(201).json({ success: true, album });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to create album:', err);
    res.status(500).json({ error: 'Could not create the album.' });
  }
});

// GET /api/photo-albums/overview — the Media Overview page's four summary
// cards + Recent albums + Pending approval panels, in one round trip.
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const [albums, publishedCount, pending] = await Promise.all([
      listAlbumsForOrg(req.user.org_id),
      countPublishedAlbumsForOrg(req.user.org_id),
      listPendingReviewForOrg(req.user.org_id, { limit: 100 }),
    ]);
    res.json({
      recent_albums: albums,
      published_album_count: publishedCount,
      pending_approval: pending,
      pending_approval_count: pending.length,
    });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to load overview:', err);
    res.status(500).json({ error: 'Could not load albums right now.' });
  }
});

// GET /api/photo-albums/event/:eventId — every album for one event.
router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const event = await getEvent(req.params.eventId);
    if (!event || event.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    const albums = await listAlbumsForEvent(req.params.eventId);
    res.json({ albums });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to list event albums:', err);
    res.status(500).json({ error: 'Could not load albums for that event.' });
  }
});

// GET /api/photo-albums/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const album = await loadAlbumForOrg(req.params.id, req.user.org_id);
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    res.json({ album });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to load album:', err);
    res.status(500).json({ error: 'Could not load that album.' });
  }
});

// PATCH /api/photo-albums/:id — the "Manage" button: visibility, download
// permission, upload/approval toggles, publishing status, name/cover/etc.
router.patch('/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const album = await loadAlbumForOrg(req.params.id, req.user.org_id);
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    if (req.body.visibility && !VISIBILITY_OPTIONS.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITY_OPTIONS.join(', ')}.` });
    }
    const updated = await updateAlbum(req.params.id, req.body);
    res.json({ success: true, album: updated });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to update album:', err);
    res.status(500).json({ error: 'Could not update that album.' });
  }
});

// DELETE /api/photo-albums/:id
router.delete('/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const album = await loadAlbumForOrg(req.params.id, req.user.org_id);
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    await deleteAlbum(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[PHOTO-ALBUMS] Failed to delete album:', err);
    res.status(500).json({ error: 'Could not delete that album.' });
  }
});

module.exports = router;
