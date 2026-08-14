/**
 * server/routes/imageLibrary.js
 * Lists curated temple images stored in S3 under temple-images/library/
 *
 * S3 folder structure:
 *   temple-images/library/Deities/venkateswara_1.jpg
 *   temple-images/library/Deities/lakshmi_1.jpg
 *   temple-images/library/Garlands/marigold_garland_1.jpg
 *   temple-images/library/Rangoli/diwali_rangoli_1.jpg
 *   temple-images/library/Festival/navratri_1.jpg
 *   temple-images/library/Decor/deepam_1.jpg
 *
 * Each image's S3 key encodes its category via the folder name.
 */

const express = require('express');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const router = express.Router();

const S3_PREFIX    = 'temple-images/library/';
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

// Valid categories (maps to S3 sub-folder names)
const CATEGORY_MAP = {
  'deities':   'Deities',
  'festivals': 'Festivals',
  'flowers':   'Flowers',
  'rangoli':   'Rangoli',
  'general':   'General',
};
// Cache for 5 minutes to avoid hammering S3 on every panel open

router.get('/', async (req, res) => {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION_S3 || 'us-east-2';

      // Return empty array gracefully if AWS not configured yet
  if (!bucket) {
    console.warn('[image-library] S3_BUCKET not set — returning empty library');
    return res.json({ images: [], warning: 'S3_BUCKET not set in .env' });
    }

  try {
    const s3 = new S3Client({ region });
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: S3_PREFIX,
      MaxKeys: 200,
    });

    const data = await s3.send(command);
    const contents = data.Contents || [];

    const images = contents
      .filter(obj => {
        const key = obj.Key.toLowerCase();
        return ALLOWED_EXTS.some(ext => key.endsWith(ext));
      })
      .map(obj => {
        const key      = obj.Key;
        const parts    = key.replace(S3_PREFIX, '').split('/');
        const folder   = parts.length > 1 ? parts[0] : 'general';
        const filename = parts[parts.length - 1];
        const name     = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const url      = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

        return {
          url,
          thumb:    url,
          name:     name.charAt(0).toUpperCase() + name.slice(1),
          category: CATEGORY_MAP[folder.toLowerCase()] || 'General',
          key,
        };
      });
    // Update cache

    console.log(`[image-library] found ${images.length} images in s3://${bucket}/${S3_PREFIX}`);
    return res.json({ images });

  } catch (err) {
    console.error('[image-library] S3 error:', err.message);
    // Return empty gracefully — don't crash the editor
    return res.status(500).json({ error: err.message, images: [] });
  }
});

module.exports = router;
