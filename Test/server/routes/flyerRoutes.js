/**
 * flyerRoutes.js — S3 Flyer Upload API
 * Add to your Express server:  app.use('/api/flyers', require('./flyerRoutes'));
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION          (e.g. us-east-2)
 *   S3_BUCKET_NAME      (e.g. svtemple-flyers-co)
 */

const express = require('express');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { incrementUsage } = require('../organizations');
const { authenticateToken } = require('./auth');
const { sendServerError } = require('../utils/errors');
const router  = express.Router();
// Lazy S3 client — created on first use so env vars are available
let s3 = null;
function getS3() {
  if (!s3) {
    s3 = new S3Client({ 
      region: process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2' 
    });
  }
  return s3;
}
function getBucket() {
  const b = process.env.S3_BUCKET_NAME;

  if (!b) throw new Error('S3_BUCKET_NAME is not set');

  return b;
  }

function getRegion() {
  return process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
}
function getS3Url(key) {
  return `https://${getBucket()}.s3.${getRegion()}.amazonaws.com/${key}`;
}
function getOrgPrefix(org_id) {
  return `orgs/${org_id}/flyers/`;
}

// Every upload route below used to accept whatever content-type the client
// claimed and store it straight to a public-read S3 bucket with no size
// check beyond the global 25mb JSON body limit in server.js. Two real
// risks from that: (1) image/svg+xml is allowed by the browser to contain
// <script> — served back with that content-type and opened directly (not
// just <img>-embedded), it executes as stored XSS under this app's own
// domain; (2) nothing stopped uploading arbitrary non-image files (PDF,
// HTML, anything) into a publicly-readable bucket, turning it into an open
// file host. This whitelist restricts uploads to actual raster image
// types and caps decoded size well under the JSON body limit (accounting
// for base64's ~37% overhead).
const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB decoded

// Parses a "data:<type>;base64,<data>" string, validating the content-type
// against the whitelist and the decoded size against MAX_IMAGE_BYTES.
// Returns { contentType, buffer, ext } on success, or { error } on failure
// — callers should respond 400 with that error rather than throwing, since
// this runs on user-controlled input.
function parseImageDataUri(imageData) {
  if (typeof imageData !== 'string') return { error: 'imageData required' };
  const matches = imageData.match(/^data:([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+);base64,(.+)$/);
  if (!matches) return { error: 'Invalid image data' };

  const contentType = matches[1].toLowerCase();
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    return { error: `Unsupported image type "${contentType}" — please upload a PNG, JPEG, WEBP, or GIF.` };
  }

  let buffer;
  try {
    buffer = Buffer.from(matches[2], 'base64');
  } catch {
    return { error: 'Invalid image data' };
  }
  if (buffer.length === 0) return { error: 'Empty image data' };
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { error: `Image is too large (max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB)` };
  }

  const ext = contentType.split('/')[1];
  return { contentType, buffer, ext };
}
// ── POST /api/flyers/upload ───────────────────────────────────────────────────
// Body: { imageData: "data:image/png;base64,...", filename: "flyers/xyz.png" }
// Returns: { url, key }
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ error: 'imageData and filename required' });
    }

    const org_id = (req.user && req.user.org_id) || (req.org && req.org.org_id) || 'default';
    const prefix = getOrgPrefix(org_id);

    const parsed = parseImageDataUri(imageData);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { contentType, buffer } = parsed;

    // S3 keys are opaque strings, not filesystem paths — a literal "../" in
    // one doesn't let it "escape" the orgs/<id>/flyers/ prefix the way it
    // would on disk. Stripped anyway as cheap defense-in-depth against
    // anything downstream (a CDN, a future migration to real storage) that
    // might interpret the key as a path.
    const cleanFilename = filename.replace(/^flyers\//, '').replace(/\.\.+/g, '').replace(/^\/+/, '');
    if (!cleanFilename) return res.status(400).json({ error: 'Invalid filename' });
    const key = `${prefix}${cleanFilename}`;

    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,

      CacheControl: 'public, max-age=31536000',
      // Public read — remove if you want private + signed URLs
      Metadata: {
        uploadedAt: new Date().toISOString(),
        org_id: org_id,
      },
    }));

    const url = getS3Url(key);

    if (req.org) {
      await incrementUsage(org_id, 'flyers').catch(err => 
        console.error('[FLYER] Failed to increment usage:', err)
      );
    }
    console.log(`[FLYER] Uploaded: ${key} for org: ${org_id}`);
    res.json({ url, key });
  } catch (err) {
    console.error('[FLYER] Upload error:', err);
    sendServerError(res, err);
  }
});
// Same pattern as /upload, but for the org's logo — stored in its own
router.post('/logo', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'imageData required' });
    }
    const org_id = (req.user && req.user.org_id) || (req.org && req.org.org_id);
    if (!org_id) {
      return res.status(404).json({ error: 'No organization found for this account' });
    }
    const parsed = parseImageDataUri(imageData);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { contentType, buffer, ext } = parsed;
    const key         = `orgs/${org_id}/logo/logo.${ext}`;
    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=3600', // shorter cache than flyers — logos get replaced in place
      Metadata: { uploadedAt: new Date().toISOString(), org_id },
    }));
    const url = getS3Url(key) + `?v=${Date.now()}`; // cache-bust so a re-upload shows immediately
    const { updateOrganization } = require('../organizations');
    await updateOrganization(org_id, { logo_url: url });
    console.log(`[LOGO] Uploaded for org: ${org_id}`);
    res.json({ url });
  } catch (err) {
    console.error('[LOGO] Upload error:', err);
    sendServerError(res, err);
  }
});

// Same pattern as /logo, but for the org's public-calendar banner image.
router.post('/banner', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'imageData required' });
    }
    const org_id = (req.user && req.user.org_id) || (req.org && req.org.org_id);
    if (!org_id) {
      return res.status(404).json({ error: 'No organization found for this account' });
    }
    const parsed = parseImageDataUri(imageData);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { contentType, buffer, ext } = parsed;
    const key         = `orgs/${org_id}/banner/banner.${ext}`;
    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=3600', // shorter cache than flyers — banners get replaced in place
      Metadata: { uploadedAt: new Date().toISOString(), org_id },
    }));
    const url = getS3Url(key) + `?v=${Date.now()}`; // cache-bust so a re-upload shows immediately
    const { updateOrganization } = require('../organizations');
    await updateOrganization(org_id, { banner_url: url });
    console.log(`[BANNER] Uploaded for org: ${org_id}`);
    res.json({ url });
  } catch (err) {
    console.error('[BANNER] Upload error:', err);
    sendServerError(res, err);
  }
});

// ── Reference photos — the org's own photos (temple/venue, deities, decor)
// used to visually ground AI image generation via images.edit() in
// generate-image.js, instead of generating freely from a text prompt alone.
// Stored under their own S3 prefix and tracked in the org record's
// `reference_photos` array (server/organizations.js — updateOrganization()
// accepts arbitrary fields, so no schema change needed there).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reference-photos', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'No organization found for this account' });
    const { getOrganization } = require('../organizations');
    const org = await getOrganization(org_id);
    res.json({ photos: (org && org.reference_photos) || [] });
  } catch (err) {
    console.error('[REF-PHOTO] List error:', err);
    sendServerError(res, err);
  }
});

router.post('/reference-photos', authenticateToken, async (req, res) => {
  try {
    const { imageData, label } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData required' });
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'No organization found for this account' });

    const parsed = parseImageDataUri(imageData);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { contentType, buffer, ext } = parsed;
    const key         = `orgs/${org_id}/reference-photos/${uuidv4()}.${ext}`;

    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
      Metadata: { uploadedAt: new Date().toISOString(), org_id },
    }));

    const url = getS3Url(key);
    const { getOrganization, updateOrganization } = require('../organizations');
    const org = await getOrganization(org_id);
    const photo = { key, url, label: String(label || '').slice(0, 100), uploaded_at: Date.now() };
    // Cap the saved library so this can't unboundedly grow the DynamoDB item.
    const photos = [...((org && org.reference_photos) || []), photo].slice(-30);
    await updateOrganization(org_id, { reference_photos: photos });

    console.log(`[REF-PHOTO] Uploaded ${key} for org: ${org_id}`);
    res.json({ photo, photos });
  } catch (err) {
    console.error('[REF-PHOTO] Upload error:', err);
    sendServerError(res, err);
  }
});

router.delete('/reference-photos/:key(*)', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'No organization found for this account' });
    const key = decodeURIComponent(req.params.key);
    if (!key.startsWith(`orgs/${org_id}/reference-photos/`)) {
      return res.status(403).json({ error: 'Not allowed to delete this file' });
    }
    await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    const { getOrganization, updateOrganization } = require('../organizations');
    const org = await getOrganization(org_id);
    const photos = ((org && org.reference_photos) || []).filter(p => p.key !== key);
    await updateOrganization(org_id, { reference_photos: photos });
    console.log(`[REF-PHOTO] Deleted ${key} for org: ${org_id}`);
    res.json({ deleted: key, photos });
  } catch (err) {
    console.error('[REF-PHOTO] Delete error:', err);
    sendServerError(res, err);
  }
});

// ── GET /api/flyers/list ──────────────────────────────────────────────────────
// Returns list of all saved flyers in S3
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const prefix = getOrgPrefix(org_id);
    const data = await getS3().send(new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: prefix,
    }));

    const files = (data.Contents || []).map(obj => ({
      key:          obj.Key,
      url: getS3Url(obj.Key),
      size:         obj.Size,
      lastModified: obj.LastModified,
      filename: obj.Key.replace(prefix, ''),
    }));

    console.log(`[FLYER] Listed ${files.length} flyers for org: ${org_id}`);
    res.json({ files, count: files.length });
  } catch (err) {
    console.error('[FLYER] List error:', err);
    sendServerError(res, err);
  }
});

// ── DELETE /api/flyers/:key ───────────────────────────────────────────────────
router.delete('/:key(*)', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    const prefix = getOrgPrefix(org_id);
    let key = decodeURIComponent(req.params.key);
    if (!key.startsWith(prefix)) {
      key = `${prefix}${key.replace(/^flyers\//, '')}`;
    }
    await getS3().send(new DeleteObjectCommand({ 
      Bucket: getBucket(), 
      Key: key 
    }));
    console.log(`[FLYER] Deleted: ${key} for org: ${org_id}`);
    res.json({ deleted: key });
  } catch (err) {
    console.error('[FLYER] Delete error:', err);
    sendServerError(res, err);
  }
});

module.exports = router;
