/**
 * server/routes/photos.js — live community photo album for an event.
 *
 * Two audiences, two auth middlewares:
 *  - Community members (devotees verified by phone OTP — see
 *    community-auth.js) get a presigned upload URL, register what they
 *    uploaded, and see the live album. `authenticateCommunityToken` sets
 *    req.communityUser = { member_id, org_id, phone, role }.
 *  - Temple admins/staff moderate: a queue of anything Rekognition
 *    flagged, plus approve/reject. `authenticateToken` (routes/auth.js)
 *    sets req.user = { user_id, org_id, email, role } — same pattern as
 *    every other admin route in this app.
 *
 * Every route re-derives the event's org from the DB (events.js#getEvent)
 * and checks it against the caller's own org_id — never trusts an event_id
 * to already be scoped correctly just because the caller is authenticated
 * for *some* org. Same reasoning as community-auth's separate signing
 * secret: cross-tenant access should be structurally checked, not assumed.
 *
 * Requires @aws-sdk/client-rekognition and @aws-sdk/s3-request-presigner
 * (added to package.json — not yet installed in this sandbox, same as
 * @aws-sdk/client-sns for community-auth.js; the person running this needs
 * to `npm install`).
 *
 * Policy: an attendee (community) upload NEVER auto-publishes, regardless
 * of what Rekognition finds. It always lands as 'pending_review' and
 * waits for an admin's approve/reject/flag (see the Media spec's photo
 * workflow). Rekognition still runs on every upload -- its result just
 * decides whether the pending photo is also marked auto_flagged, a signal
 * for the admin, not a publish/block decision by itself.
 */

const express = require('express');
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');

const { authenticateCommunityToken } = require('../community-auth');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getEvent } = require('../events');
const { getOrganization } = require('../organizations');
const {
  createPhoto,
  getPhoto,
  countCappablePhotosForMember,
  countCappablePhotosForEvent,
  countLivePhotosForEvent,
  listLivePhotosForEvent,
  listPendingReviewForOrg,
  setPhotoStatus,
} = require('../photos');
const { listAlbumsForEvent, bumpPhotoCount, updateAlbum, getOrCreateQuickAlbum } = require('../photoAlbums');

const router = express.Router();

const REGION = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
const BUCKET = process.env.S3_BUCKET_NAME;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function s3Client() {
  return new S3Client({ region: REGION });
}
function rekognitionClient() {
  return new RekognitionClient({ region: REGION });
}

function photoUrl(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// Per-event/per-org photo caps by plan. Deliberately kept as its own small
// table here rather than folded into organizations.js's PLAN_LIMITS —
// that structure is live and drives real billing/usage-gate logic
// elsewhere; a mistake there is a bigger blast radius than a mistake in a
// brand-new feature's own constants. Worth consolidating later once this
// has proven itself.
const PHOTO_CAPS = {
  free: { per_member: 5, per_event: 30 },
  starter: { per_member: 10, per_event: 100 },
  pro: { per_member: 15, per_event: 300 },
  enterprise: { per_member: 20, per_event: -1 }, // -1 = no event-wide cap
};
function capsForPlan(plan) {
  return PHOTO_CAPS[plan] || PHOTO_CAPS.free;
}

const ALLOWED_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Rekognition's moderation taxonomy is a tree (e.g. "Graphic Violence Or
// Gore" -> parent "Violence" -> top "Explicit Nudity" is its own top-level
// category, not a parent). Checking both Name and ParentName against this
// set catches a flagged label whichever level Rekognition returns it at.
// Deliberately stricter than a general-purpose app: this is photos from a
// temple/community event, shared with families, so "Suggestive" is
// included alongside the categories most apps would only flag on for
// outright explicit content.
const FLAGGED_CATEGORIES = new Set([
  'Explicit Nudity',
  'Suggestive',
  'Violence',
  'Visually Disturbing',
  'Hate Symbols',
]);
const MODERATION_CONFIDENCE_THRESHOLD = 75;

function eventKeyPrefix(org_id, event_id) {
  return `orgs/${org_id}/events/${event_id}/photos/`;
}

/** Loads the event and checks it belongs to org_id. Returns the event, or null. */
async function loadEventForOrg(event_id, org_id) {
  if (!event_id) return null;
  const event = await getEvent(event_id);
  if (!event || event.org_id !== org_id) return null;
  return event;
}

// Rekognition (like the Instagram post below it) costs real money per
// call, and every register also does a DynamoDB write — worth throttling
// per-member independently of the hard per-member/per-event caps below,
// since those only block once someone's actually near their limit, not a
// burst of retries against a flaky connection.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.communityUser ? req.communityUser.member_id : ipKeyGenerator(req.ip)),
  message: { error: 'Too many photo uploads in a short time — please slow down and try again shortly.' },
});

/** Bumps an album's live photo_count and, the first time it has a photo
 *  at all, sets that photo as its cover -- otherwise every album with no
 *  cover_photo_url set by hand shows a generic icon tile forever, even
 *  once it actually has photos. Never overwrites a cover already set. */
async function bumpAlbumAndMaybeSetCover(album_id, photo_url) {
  const updated = await bumpPhotoCount(album_id, 1).catch(() => null);
  if (updated && !updated.cover_photo_url) {
    await updateAlbum(album_id, { cover_photo_url: photo_url }).catch(() => null);
  }
}

// ── Community routes ────────────────────────────────────────────────────

// POST /api/photos/upload-url — issue a presigned S3 PUT URL. Checked
// against the caps up front so a devotee finds out they're at their limit
// before spending the time on an upload that register would reject anyway;
// register re-checks for real, since this is only a courtesy check.
router.post('/upload-url', authenticateCommunityToken, async (req, res) => {
  try {
    const { event_id, content_type } = req.body;
    const ext = ALLOWED_CONTENT_TYPES[content_type];
    if (!ext) {
      return res.status(400).json({ error: 'Photos must be JPEG, PNG, or WebP.' });
    }
    if (!BUCKET) {
      return res.status(500).json({ error: 'Photo storage is not configured yet — ask the temple admin to check S3 setup.' });
    }

    const event = await loadEventForOrg(event_id, req.communityUser.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const org = await getOrganization(req.communityUser.org_id);
    const caps = capsForPlan(org && org.plan);

    const [memberCount, eventCount] = await Promise.all([
      countCappablePhotosForMember(event_id, req.communityUser.member_id),
      countCappablePhotosForEvent(event_id),
    ]);
    if (memberCount >= caps.per_member) {
      return res.status(429).json({ error: `You've reached the ${caps.per_member}-photo limit for this event.` });
    }
    if (caps.per_event !== -1 && eventCount >= caps.per_event) {
      return res.status(429).json({ error: 'This event has reached its photo limit for now.' });
    }

    const key = `${eventKeyPrefix(req.communityUser.org_id, event_id)}${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: content_type }),
      { expiresIn: 300 }
    );

    res.json({ upload_url: uploadUrl, key, expires_in: 300 });
  } catch (err) {
    console.error('[PHOTOS] Failed to create upload URL:', err);
    res.status(500).json({ error: 'Could not start the upload — try again.' });
  }
});

// POST /api/photos/register — call once the browser has PUT the file to
// the presigned URL above. Runs content moderation and writes the photo
// row; the key's own prefix (org_id/event_id baked in by /upload-url, not
// supplied by the client) is what stops one org's upload slipping into
// another's album or cap count.
router.post('/register', authenticateCommunityToken, registerLimiter, async (req, res) => {
  try {
    const { event_id, key, caption } = req.body;
    if (!event_id || !key) {
      return res.status(400).json({ error: 'event_id and key are required.' });
    }
    if (!key.startsWith(eventKeyPrefix(req.communityUser.org_id, event_id))) {
      return res.status(400).json({ error: 'That upload key is not valid for this event.' });
    }

    const event = await loadEventForOrg(event_id, req.communityUser.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const org = await getOrganization(req.communityUser.org_id);
    const caps = capsForPlan(org && org.plan);

    const [memberCount, eventCount] = await Promise.all([
      countCappablePhotosForMember(event_id, req.communityUser.member_id),
      countCappablePhotosForEvent(event_id),
    ]);
    if (memberCount >= caps.per_member) {
      return res.status(429).json({ error: `You've reached the ${caps.per_member}-photo limit for this event.` });
    }
    if (caps.per_event !== -1 && eventCount >= caps.per_event) {
      return res.status(429).json({ error: 'This event has reached its photo limit for now.' });
    }

    // Attendee uploads always land in the moderation queue -- Rekognition
    // still runs (so the admin sees WHY a photo might need extra scrutiny)
    // but its result never decides whether this publishes automatically.
    // See this file's header comment and photos.js's status doc.
    let autoFlagged = false;
    let moderation = null;
    try {
      const result = await rekognitionClient().send(new DetectModerationLabelsCommand({
        Image: { S3Object: { Bucket: BUCKET, Name: key } },
        MinConfidence: 60,
      }));
      const labels = result.ModerationLabels || [];
      const flagged = labels.filter(
        (l) =>
          (FLAGGED_CATEGORIES.has(l.Name) || FLAGGED_CATEGORIES.has(l.ParentName)) &&
          l.Confidence >= MODERATION_CONFIDENCE_THRESHOLD
      );
      moderation = labels;
      autoFlagged = flagged.length > 0;
    } catch (modErr) {
      // If the file genuinely never landed at `key`, Rekognition can't read
      // it and this is really a client error, not a moderation failure —
      // surface that distinctly instead of silently queuing a broken row.
      if (modErr.name === 'InvalidS3ObjectException' || modErr.name === 'InvalidImageFormatException') {
        return res.status(400).json({ error: 'That upload could not be found or read — please try uploading again.' });
      }
      // Any other moderation failure (throttling, a transient AWS error) —
      // the photo still queues for review either way, this just means the
      // admin won't have a moderation_labels hint on this particular one.
      console.error('[PHOTOS] Moderation check failed (photo still queued for review):', modErr.message);
    }

    // If this event has an album, stamp the photo with it so the album's
    // photo_count and the "Manage" view can find it — an event can have
    // zero albums (nothing created yet) and the photo is still perfectly
    // valid, just not attributed to one until an admin creates one.
    const albums = await listAlbumsForEvent(event_id);
    const album_id = albums[0] ? albums[0].album_id : null;

    const photo = {
      photo_id: `ph-${crypto.randomUUID()}`,
      event_id,
      album_id,
      org_id: req.communityUser.org_id,
      member_id: req.communityUser.member_id,
      key,
      url: photoUrl(key),
      caption: (caption || '').toString().slice(0, 280),
      status: 'pending_review',
      auto_flagged: autoFlagged,
      moderation_labels: moderation ? moderation.map((l) => ({ name: l.Name, confidence: l.Confidence })) : null,
      created_at: Date.now(),
    };
    await createPhoto(photo);

    res.status(201).json({
      success: true,
      status: photo.status,
      photo: null,
      message: 'Your photo was submitted and is awaiting a quick review before it appears.',
    });
  } catch (err) {
    console.error('[PHOTOS] Failed to register photo:', err);
    res.status(500).json({ error: 'Could not save that photo — try again.' });
  }
});

// GET /api/photos/event/:eventId — the public live album, newest first.
router.get('/event/:eventId', authenticateCommunityToken, async (req, res) => {
  try {
    const event = await loadEventForOrg(req.params.eventId, req.communityUser.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const photos = await listLivePhotosForEvent(req.params.eventId, { limit: 100 });
    res.json({
      photos: photos.map((p) => ({
        photo_id: p.photo_id,
        url: p.url,
        caption: p.caption || '',
        created_at: p.created_at,
        mine: p.member_id === req.communityUser.member_id,
      })),
    });
  } catch (err) {
    console.error('[PHOTOS] Failed to list event photos:', err);
    res.status(500).json({ error: 'Could not load photos right now.' });
  }
});

// ── Admin quick-upload routes ───────────────────────────────────────────
// A simpler, second on-ramp for photos: an admin adding one or more
// photos straight from the Media page, targeting the same auto-detected
// event/date group as routes/livestreams.js's glimpse videos, and
// skipping moderation entirely since this is the admin's own trusted
// upload, not an attendee's. Every photo still lands in an album (see
// getOrCreateQuickAlbum) so it shows up wherever the rest of the app
// already expects photos to live -- the admin just never sees that form.

const MAX_QUICK_PHOTOS = 20;

/** Same {event_id, date} validation as routes/livestreams.js#resolveGroup. */
async function resolveAdminPhotoGroup(req) {
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

function quickKeyPrefix(org_id, { event_id, date }) {
  return event_id ? eventKeyPrefix(org_id, event_id) : `orgs/${org_id}/photos/${date}/`;
}

// POST /api/photos/admin/upload-url — issue a presigned S3 PUT URL for an
// admin-uploaded photo. Checked against the group cap up front, same
// courtesy-check reasoning as the community /upload-url above.
router.post('/admin/upload-url', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { content_type } = req.body;
    const ext = ALLOWED_CONTENT_TYPES[content_type];
    if (!ext) {
      return res.status(400).json({ error: 'Photos must be JPEG, PNG, or WebP.' });
    }
    if (!BUCKET) {
      return res.status(500).json({ error: 'Photo storage is not configured yet — check S3 setup.' });
    }

    const group = await resolveAdminPhotoGroup(req);
    if (group.error) return res.status(404).json({ error: group.error });

    const effectiveEventId = group.event_id || `noevent-${req.user.org_id}-${group.date}`;
    const existingCount = await countLivePhotosForEvent(effectiveEventId);
    if (existingCount >= MAX_QUICK_PHOTOS) {
      return res.status(429).json({ error: `Already at ${MAX_QUICK_PHOTOS} photos, the most allowed here.` });
    }

    const key = `${quickKeyPrefix(req.user.org_id, group)}${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      s3Client(),
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: content_type }),
      { expiresIn: 300 }
    );

    res.json({ upload_url: uploadUrl, key, expires_in: 300, date: group.date });
  } catch (err) {
    console.error('[PHOTOS] Failed to create admin upload URL:', err);
    res.status(500).json({ error: 'Could not start the upload — try again.' });
  }
});

// POST /api/photos/admin/register — register an admin-uploaded photo once
// the browser has PUT the file to the presigned URL above. Publishes
// immediately as 'live' -- no moderation queue, no approval step -- and
// stamps it onto that group's quick album.
router.post('/admin/register', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required.' });

    const group = await resolveAdminPhotoGroup(req);
    if (group.error) return res.status(404).json({ error: group.error });
    if (!key.startsWith(quickKeyPrefix(req.user.org_id, group))) {
      return res.status(400).json({ error: 'That upload key is not valid for this request.' });
    }

    const effectiveEventId = group.event_id || `noevent-${req.user.org_id}-${group.date}`;
    const existingCount = await countLivePhotosForEvent(effectiveEventId);
    if (existingCount >= MAX_QUICK_PHOTOS) {
      return res.status(429).json({ error: `Already at ${MAX_QUICK_PHOTOS} photos, the most allowed here.` });
    }

    const album = await getOrCreateQuickAlbum(req.user.org_id, req.user.user_id, group);

    const photo = {
      photo_id: `ph-${crypto.randomUUID()}`,
      event_id: effectiveEventId,
      album_id: album.album_id,
      org_id: req.user.org_id,
      member_id: null,
      key,
      url: photoUrl(key),
      caption: '',
      status: 'live',
      auto_flagged: false,
      moderation_labels: null,
      created_at: Date.now(),
    };
    await createPhoto(photo);
    await bumpAlbumAndMaybeSetCover(album.album_id, photo.url);

    res.status(201).json({ success: true, photo });
  } catch (err) {
    console.error('[PHOTOS] Failed to save admin-uploaded photo:', err);
    res.status(500).json({ error: 'Could not save that photo.' });
  }
});

// GET /api/photos/admin/count — how many photos already exist for a
// group (?event_id=... or ?date=YYYY-MM-DD), so the upload UI can show
// "N/20 used" before the admin even picks a file.
router.get('/admin/count', authenticateToken, async (req, res) => {
  try {
    const { event_id } = req.query;
    const date = req.query.date || todayDate();
    if (event_id) {
      const event = await getEvent(event_id);
      if (!event || event.org_id !== req.user.org_id) {
        return res.status(404).json({ error: 'Event not found.' });
      }
    }
    const effectiveEventId = event_id || `noevent-${req.user.org_id}-${date}`;
    const count = await countLivePhotosForEvent(effectiveEventId);
    res.json({ count, max: MAX_QUICK_PHOTOS });
  } catch (err) {
    console.error('[PHOTOS] Failed to count admin photos:', err);
    res.status(500).json({ error: 'Could not check photos right now.' });
  }
});

// ── Admin moderation routes ─────────────────────────────────────────────

// GET /api/photos/moderation-queue — everything Rekognition flagged for
// this admin's org, oldest first.
router.get('/moderation-queue', authenticateToken, async (req, res) => {
  try {
    const photos = await listPendingReviewForOrg(req.user.org_id, { limit: 50 });
    res.json({ photos });
  } catch (err) {
    console.error('[PHOTOS] Failed to load moderation queue:', err);
    res.status(500).json({ error: 'Could not load the moderation queue.' });
  }
});

router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const photo = await getPhoto(req.params.id);
    if (!photo || photo.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    await setPhotoStatus(photo.photo_id, 'live', { moderated_by: req.user.user_id });
    if (photo.album_id) await bumpAlbumAndMaybeSetCover(photo.album_id, photo.url);
    res.json({ success: true });
  } catch (err) {
    console.error('[PHOTOS] Failed to approve photo:', err);
    res.status(500).json({ error: 'Could not approve that photo.' });
  }
});

router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const photo = await getPhoto(req.params.id);
    if (!photo || photo.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    await setPhotoStatus(photo.photo_id, 'rejected', { moderated_by: req.user.user_id });
    res.json({ success: true });
  } catch (err) {
    console.error('[PHOTOS] Failed to reject photo:', err);
    res.status(500).json({ error: 'Could not reject that photo.' });
  }
});

// POST /api/photos/:id/flag — escalate a pending photo instead of
// approving or rejecting it outright (Media spec's "Approve, reject or
// flag" action on the Pending approval thumbnail grid).
router.post('/:id/flag', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const photo = await getPhoto(req.params.id);
    if (!photo || photo.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    await setPhotoStatus(photo.photo_id, 'flagged', { moderated_by: req.user.user_id, flag_reason: (req.body && req.body.reason) || null });
    res.json({ success: true });
  } catch (err) {
    console.error('[PHOTOS] Failed to flag photo:', err);
    res.status(500).json({ error: 'Could not flag that photo.' });
  }
});

// POST /api/photos/bulk-approve — the Pending approval panel's "Bulk
// approval" action. Applies each id independently so one bad id (already
// moderated, wrong org, doesn't exist) doesn't block the rest of the
// batch; the response reports per-id success so the UI can show which
// ones didn't go through.
router.post('/bulk-approve', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array.' });
  try {
    const results = await Promise.all(ids.map(async (photo_id) => {
      try {
        const photo = await getPhoto(photo_id);
        if (!photo || photo.org_id !== req.user.org_id) {
          return { photo_id, success: false, error: 'not_found' };
        }
        await setPhotoStatus(photo_id, 'live', { moderated_by: req.user.user_id });
        if (photo.album_id) await bumpAlbumAndMaybeSetCover(photo.album_id, photo.url);
        return { photo_id, success: true, error: null };
      } catch (err) {
        console.error(`[PHOTOS] Bulk approve failed for ${photo_id}:`, err);
        return { photo_id, success: false, error: 'failed' };
      }
    }));
    res.json({ results });
  } catch (err) {
    console.error('[PHOTOS] Bulk approve failed:', err);
    res.status(500).json({ error: 'Could not complete bulk approval.' });
  }
});

// POST /api/photos/bulk-reject — same shape as bulk-approve, for rejecting
// a batch of pending photos at once.
router.post('/bulk-reject', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids must be a non-empty array.' });
  try {
    const results = await Promise.all(ids.map(async (photo_id) => {
      try {
        const photo = await getPhoto(photo_id);
        if (!photo || photo.org_id !== req.user.org_id) {
          return { photo_id, success: false, error: 'not_found' };
        }
        await setPhotoStatus(photo_id, 'rejected', { moderated_by: req.user.user_id });
        return { photo_id, success: true, error: null };
      } catch (err) {
        console.error(`[PHOTOS] Bulk reject failed for ${photo_id}:`, err);
        return { photo_id, success: false, error: 'failed' };
      }
    }));
    res.json({ results });
  } catch (err) {
    console.error('[PHOTOS] Bulk reject failed:', err);
    res.status(500).json({ error: 'Could not complete bulk rejection.' });
  }
});

module.exports = router;
