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
 */

const express = require('express');
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');

const { authenticateCommunityToken } = require('../community-auth');
const { authenticateToken } = require('./auth');
const { getEvent } = require('../events');
const { getOrganization } = require('../organizations');
const {
  createPhoto,
  getPhoto,
  countCappablePhotosForMember,
  countCappablePhotosForEvent,
  listLivePhotosForEvent,
  listPendingReviewForOrg,
  setPhotoStatus,
} = require('../photos');

const router = express.Router();

const REGION = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
const BUCKET = process.env.S3_BUCKET_NAME;

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

    let status = 'live';
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
      if (flagged.length) status = 'pending_review';
    } catch (modErr) {
      // If the file genuinely never landed at `key`, Rekognition can't read
      // it and this is really a client error, not a moderation failure —
      // surface that distinctly instead of silently publishing unmoderated.
      if (modErr.name === 'InvalidS3ObjectException' || modErr.name === 'InvalidImageFormatException') {
        return res.status(400).json({ error: 'That upload could not be found or read — please try uploading again.' });
      }
      // Any other moderation failure (throttling, a transient AWS error):
      // fail closed to review rather than either blocking the upload
      // outright or publishing it unscreened.
      console.error('[PHOTOS] Moderation check failed, sending to review:', modErr.message);
      status = 'pending_review';
    }

    const photo = {
      photo_id: `ph-${crypto.randomUUID()}`,
      event_id,
      org_id: req.communityUser.org_id,
      member_id: req.communityUser.member_id,
      key,
      url: photoUrl(key),
      caption: (caption || '').toString().slice(0, 280),
      status,
      moderation_labels: moderation ? moderation.map((l) => ({ name: l.Name, confidence: l.Confidence })) : null,
      created_at: Date.now(),
    };
    await createPhoto(photo);

    res.status(201).json({
      success: true,
      status,
      photo:
        status === 'live'
          ? { photo_id: photo.photo_id, url: photo.url, caption: photo.caption, created_at: photo.created_at }
          : null,
      message: status === 'pending_review' ? 'Your photo was submitted and is awaiting a quick review before it appears.' : undefined,
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

module.exports = router;
