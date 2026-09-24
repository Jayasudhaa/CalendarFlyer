/**
 * server/routes/livestreams.js — admin "event glimpse" video management,
 * mounted at /api/livestreams (see server.js). Backs the Media Overview
 * page's glimpse-video panel and the Add Event Glimpse form.
 *
 * A glimpse is a short (<=MAX_GLIMPSE_SECONDS), admin-uploaded video clip
 * -- not a real-time broadcast, so there's no scheduling and no
 * start/end/live-status lifecycle here, just: get a presigned upload URL,
 * upload the file straight to S3, then register it. Picking an event is
 * optional -- the frontend auto-fills today's event when there is exactly
 * one, and otherwise this is just tagged with a date -- so every route
 * here accepts EITHER event_id OR date, never requires event_id.
 *
 * Every route that does get an event_id re-derives its org from the DB
 * (events.js#getEvent) and checks it against the caller's own org_id,
 * same cross-tenant discipline as routes/photos.js -- an event_id is
 * never trusted to already be scoped correctly just because the caller
 * is authenticated for *some* org.
 */

const express = require('express');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getEvent } = require('../events');
const {
  createStream,
  getStream,
  updateStream,
  deleteStream,
  listStreamsForEvent,
  countGlimpsesForGroup,
  listRecentGlimpsesForOrg,
  VISIBILITY_OPTIONS,
  MAX_GLIMPSE_SECONDS,
  MAX_GLIMPSES_PER_EVENT,
} = require('../livestreams');

const router = express.Router();

const REGION = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
const BUCKET = process.env.S3_BUCKET_NAME;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function s3Client() {
  return new S3Client({ region: REGION });
}
function videoUrl(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
/** Every upload's S3 key lives under its event when one's attached,
 *  otherwise under its date -- either way scoped to this org so a key
 *  can be validated as belonging to this exact upload request. */
function keyPrefix(org_id, { event_id, date }) {
  return event_id
    ? `orgs/${org_id}/events/${event_id}/glimpses/`
    : `orgs/${org_id}/glimpses/${date}/`;
}

const ALLOWED_CONTENT_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Loads the event and checks it belongs to org_id. Returns the event, or null. */
async function loadEventForOrg(event_id, org_id) {
  if (!event_id) return null;
  const event = await getEvent(event_id);
  if (!event || event.org_id !== org_id) return null;
  return event;
}

/** Loads the stream and checks it belongs to org_id. Returns the stream, or null. */
async function loadStreamForOrg(stream_id, org_id) {
  const stream = await getStream(stream_id);
  if (!stream || stream.org_id !== org_id) return null;
  return stream;
}

/** Validates the {event_id, date} pair shared by upload-url and create:
 *  date always required and well-formed; event_id, when given, must be a
 *  real event in this org. Returns { error } or { event_id, date }. */
async function resolveGroup(req) {
  const { event_id } = req.body;
  const date = req.body.date || todayDate();
  if (!DATE_RE.test(date)) return { error: 'date must be in YYYY-MM-DD format.' };
  if (event_id) {
    const event = await loadEventForOrg(event_id, req.user.org_id);
    if (!event) return { error: 'Event not found.' };
    return { event_id, date };
  }
  return { event_id: null, date };
}

// POST /api/livestreams/upload-url — issue a presigned S3 PUT URL for a
// new glimpse video. Checked against the per-group cap up front so an
// admin finds out they're at the limit before spending time on an upload
// that the create step below would reject anyway.
router.post('/upload-url', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { content_type } = req.body;
    const ext = ALLOWED_CONTENT_TYPES[content_type];
    if (!ext) {
      return res.status(400).json({ error: 'Glimpse videos must be MP4, WebM, or MOV.' });
    }
    if (!BUCKET) {
      return res.status(500).json({ error: 'Video storage is not configured yet — check S3 setup.' });
    }

    const group = await resolveGroup(req);
    if (group.error) return res.status(404).json({ error: group.error });

    const existingCount = await countGlimpsesForGroup(req.user.org_id, group);
    if (existingCount >= MAX_GLIMPSES_PER_EVENT) {
      return res.status(429).json({ error: `Already at ${MAX_GLIMPSES_PER_EVENT} glimpse videos, the most allowed here.` });
    }

    const key = `${keyPrefix(req.user.org_id, group)}${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: content_type }),
      { expiresIn: 300 }
    );

    res.json({ upload_url: uploadUrl, key, expires_in: 300, max_seconds: MAX_GLIMPSE_SECONDS, date: group.date });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to create upload URL:', err);
    res.status(500).json({ error: 'Could not start the upload — try again.' });
  }
});

// POST /api/livestreams — register a glimpse video once the browser has
// PUT the file to the presigned URL above. The key's own prefix (org_id/
// event-or-date baked in by /upload-url, not supplied by the client) is
// what stops one org's upload slipping into another's.
router.post('/', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { key, title } = req.body;
    // Number(req.body.duration_seconds) rather than trusting the raw
    // body value -- the old `!duration_seconds` check only rejected
    // falsy values, so a negative number or a non-numeric string (both
    // truthy, and both compare false against MAX_GLIMPSE_SECONDS with
    // `>`) sailed straight through and got persisted.
    const duration_seconds = Number(req.body.duration_seconds);
    if (!key || !Number.isFinite(duration_seconds) || duration_seconds <= 0) {
      return res.status(400).json({ error: 'key and a valid duration_seconds are required.' });
    }
    if (duration_seconds > MAX_GLIMPSE_SECONDS) {
      return res.status(400).json({ error: `Glimpse videos must be ${MAX_GLIMPSE_SECONDS} seconds or less.` });
    }

    const group = await resolveGroup(req);
    if (group.error) return res.status(404).json({ error: group.error });
    if (!key.startsWith(keyPrefix(req.user.org_id, group))) {
      return res.status(400).json({ error: 'That upload key is not valid for this request.' });
    }

    const existingCount = await countGlimpsesForGroup(req.user.org_id, group);
    if (existingCount >= MAX_GLIMPSES_PER_EVENT) {
      return res.status(429).json({ error: `Already at ${MAX_GLIMPSES_PER_EVENT} glimpse videos, the most allowed here.` });
    }
    if (req.body.visibility && !VISIBILITY_OPTIONS.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITY_OPTIONS.join(', ')}.` });
    }

    const stream = await createStream(req.user.org_id, req.user.user_id, {
      event_id: group.event_id,
      date: group.date,
      title,
      visibility: req.body.visibility,
      video_url: videoUrl(key),
      video_key: key,
      duration_seconds,
    });
    res.status(201).json({ success: true, stream });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to save glimpse video:', err);
    res.status(500).json({ error: 'Could not save the glimpse video.' });
  }
});

// GET /api/livestreams/overview — Media Overview's glimpse-video panel:
// this org's most recent glimpses, newest first, plus a total count.
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const recent = await listRecentGlimpsesForOrg(req.user.org_id, { limit: 12 });
    res.json({ recent, total: recent.length, max_per_event: MAX_GLIMPSES_PER_EVENT, max_seconds: MAX_GLIMPSE_SECONDS });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to load overview:', err);
    res.status(500).json({ error: 'Could not load glimpse videos right now.' });
  }
});

// GET /api/livestreams/event/:eventId — every glimpse video tied to one event.
router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const event = await getEvent(req.params.eventId);
    if (!event || event.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    const streams = await listStreamsForEvent(req.params.eventId);
    res.json({ streams, max_per_event: MAX_GLIMPSES_PER_EVENT });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to list event glimpses:', err);
    res.status(500).json({ error: 'Could not load glimpse videos for that event.' });
  }
});

// GET /api/livestreams/count — how many glimpses already exist for a given
// group (?event_id=... or ?date=YYYY-MM-DD), so the upload form can show
// "N/10 used" before the admin even picks a file.
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const { event_id } = req.query;
    const date = req.query.date || todayDate();
    if (event_id) {
      const event = await getEvent(event_id);
      if (!event || event.org_id !== req.user.org_id) {
        return res.status(404).json({ error: 'Event not found.' });
      }
    }
    const count = await countGlimpsesForGroup(req.user.org_id, { event_id: event_id || null, date });
    res.json({ count, max_per_event: MAX_GLIMPSES_PER_EVENT });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to count glimpses:', err);
    res.status(500).json({ error: 'Could not check glimpse videos right now.' });
  }
});

// GET /api/livestreams/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const stream = await loadStreamForOrg(req.params.id, req.user.org_id);
    if (!stream) return res.status(404).json({ error: 'Glimpse video not found.' });
    res.json({ stream });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to load glimpse video:', err);
    res.status(500).json({ error: 'Could not load that glimpse video.' });
  }
});

// PATCH /api/livestreams/:id — edit a glimpse's title/visibility.
router.patch('/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const stream = await loadStreamForOrg(req.params.id, req.user.org_id);
    if (!stream) return res.status(404).json({ error: 'Glimpse video not found.' });
    if (req.body.visibility && !VISIBILITY_OPTIONS.includes(req.body.visibility)) {
      return res.status(400).json({ error: `visibility must be one of: ${VISIBILITY_OPTIONS.join(', ')}.` });
    }
    const updated = await updateStream(req.params.id, req.body);
    res.json({ success: true, stream: updated });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to update glimpse video:', err);
    res.status(500).json({ error: 'Could not update that glimpse video.' });
  }
});

// DELETE /api/livestreams/:id — removes the row and best-effort deletes
// the S3 object (a leftover orphaned file is harmless clutter; a failed
// delete here should never block the row itself from going away).
router.delete('/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const stream = await loadStreamForOrg(req.params.id, req.user.org_id);
    if (!stream) return res.status(404).json({ error: 'Glimpse video not found.' });
    await deleteStream(req.params.id);
    if (stream.video_key && BUCKET) {
      s3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: stream.video_key })).catch((err) =>
        console.error('[LIVESTREAMS] Best-effort S3 delete failed:', err)
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[LIVESTREAMS] Failed to delete glimpse video:', err);
    res.status(500).json({ error: 'Could not delete that glimpse video.' });
  }
});

module.exports = router;
