/**
 * flyerRoutes.js — S3 Flyer Upload API
 * Add to your Express server:  app.use('/api/flyers', require('./flyerRoutes'));
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION          (e.g. us-east-2)
 *   S3_BUCKET_NAME      (e.g. svtemple-flyers)
 */

const express = require('express');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const router  = express.Router();
// Lazy S3 client — created on first use so env vars are available
let s3 = null;
function getS3() {
  if (!s3) {
    s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return s3;
}
function getBucket() {
  const b = process.env.S3_BUCKET_NAME;

  if (!b) throw new Error('S3_BUCKET_NAME is not set');

  return b;
  }

// ── POST /api/flyers/upload ───────────────────────────────────────────────────
// Body: { imageData: "data:image/png;base64,...", filename: "flyers/xyz.png" }
// Returns: { url, key }
router.post('/upload', async (req, res) => {
  try {
    const { imageData, filename } = req.body;
    if (!imageData || !filename) {
      return res.status(400).json({ error: 'imageData and filename required' });
    }

    // Strip data URI prefix: "data:image/png;base64,XXXX"
    const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image data' });

    const contentType = matches[1];
    const buffer      = Buffer.from(matches[2], 'base64');

    const key = filename.startsWith('flyers/') ? filename : `flyers/${filename}`;

    await getS3().send(new PutObjectCommand({
      Bucket: getBucket(),
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      ACL: 'public-read',

      CacheControl: "public, max-age=31536000",
      // Public read — remove if you want private + signed URLs
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;
    res.json({ url, key });
  } catch (err) {
    console.error('S3 upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/flyers/list ──────────────────────────────────────────────────────
// Returns list of all saved flyers in S3
router.get('/list', async (req, res) => {
  try {
    const data = await getS3().send(new ListObjectsV2Command({
      Bucket: getBucket(),
      Prefix: 'flyers/',
    }));

    const files = (data.Contents || []).map(obj => ({
      key:          obj.Key,
      url:          `https://${BUCKET}.s3.${process.env.AWS_REGION||'us-east-2'}.amazonaws.com/${obj.Key}`,
      size:         obj.Size,
      lastModified: obj.LastModified,
      filename:     obj.Key.replace('svtemple-flyers/', ''),
    }));

    res.json({ files, count: files.length });
  } catch (err) {
    console.error('S3 list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/flyers/:key ───────────────────────────────────────────────────
router.delete('/:key', async (req, res) => {
  try {
    const key = `flyers/${decodeURIComponent(req.params.key)}`;
    await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    res.json({ deleted: key });
  } catch (err) {
    console.error('S3 delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
