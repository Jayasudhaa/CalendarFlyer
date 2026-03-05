/**
 * broadcast.js — POST /api/broadcast
 *
 * Sends the flyer image + caption to WhatsApp and/or Facebook.
 *
 * Required .env:
 *   WHATSAPP_TOKEN       — Meta Cloud API permanent token
 *   WHATSAPP_PHONE_ID    — Phone Number ID from Meta Business dashboard
 *   WHATSAPP_GROUP_ID    — WhatsApp recipient ID (group or individual)
 *   FB_PAGE_TOKEN        — Facebook Page access token
 *   FB_PAGE_ID           — Facebook Page ID
 *
 * Flow:
 *   1. Receive { platform, imageBase64, caption, event } from client
 *   2. Upload image to platform (WhatsApp media upload / Facebook photo)
 *   3. Send message with uploaded media ID
 *   4. Return { success: true, messageId }
 */

const express  = require('express');
const fetch    = require('node-fetch');
const FormData = require('form-data');

const router = express.Router();

function base64ToBuffer(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}
function getWhatsAppRecipient() {
  const isTest = process.env.TEST_MODE === 'true';
  if (isTest) {
    const num = process.env.TEST_RECIPIENT_NUMBER;
    if (!num) throw new Error('TEST_MODE=true but TEST_RECIPIENT_NUMBER not set in .env');
    console.log(`[broadcast] 🧪 TEST MODE — sending to ${num}`);
    return num;
  }
  const groupId = process.env.WHATSAPP_GROUP_ID;
  if (!groupId) throw new Error('WHATSAPP_GROUP_ID not set in .env');
  console.log(`[broadcast] 🚀 PROD MODE — sending to group`);
  return groupId;
}
// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert data:image/png;base64,... → Buffer

// ── WhatsApp ──────────────────────────────────────────────────────────────────

async function broadcastWhatsApp({ imageBase64, caption }) {
  const token   = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token)   throw new Error('WHATSAPP_TOKEN not set in .env');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID not set in .env');

  const recipient = getWhatsAppRecipient();

  // Step 1: Upload image to WhatsApp media
  console.log('[broadcast] uploading image...');
  const imgBuffer = base64ToBuffer(imageBase64);
  const form = new FormData();
  form.append('file', imgBuffer, { filename: 'flyer.png', contentType: 'image/png' });
  form.append('type', 'image/png');
  form.append('messaging_product', 'whatsapp');

  const uploadRes = await fetch(
    `https://graph.facebook.com/v20.0/${phoneId}/media`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
      body:    form,
    }
  );
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || uploadData.error) {
    throw new Error(uploadData.error?.message || 'WhatsApp media upload failed');
  }
  const mediaId = uploadData.id;
  console.log(`[broadcast] ✓ uploaded mediaId: ${mediaId}`);

  // Step 2: Send image message with caption
  const msgRes = await fetch(
    `https://graph.facebook.com/v20.0/${phoneId}/messages`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:   recipient,
        type: 'image',
        image: { id: mediaId, caption: caption.substring(0, 1024) },
      }),
    }
  );
  const msgData = await msgRes.json();
  if (!msgRes.ok || msgData.error) {
    throw new Error(msgData.error?.message || 'WhatsApp send failed');
  }

  const messageId = msgData.messages?.[0]?.id;
  console.log(`[broadcast] ✓ sent to ${recipient}`);
  return { messageId, recipient, testMode: process.env.TEST_MODE === 'true' };
}

// ── Facebook ──────────────────────────────────────────────────────────────────

async function broadcastFacebook({ imageBase64, caption }) {
  const token  = process.env.FB_PAGE_TOKEN;
  const pageId = process.env.FB_PAGE_ID;

  if (!token)  throw new Error('FB_PAGE_TOKEN not set in .env');
  if (!pageId) throw new Error('FB_PAGE_ID not set in .env');
  const isTest = process.env.TEST_MODE === 'true';

  // Facebook /photos endpoint accepts multipart upload with caption
  const imgBuffer = base64ToBuffer(imageBase64);
  const form = new FormData();
  form.append('source',    imgBuffer, { filename: 'flyer.png', contentType: 'image/png' });
  form.append('caption',   caption);
  form.append('access_token', token);
  if (isTest) form.append('published', 'false'); // draft — only you see it

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${pageId}/photos`,
    { method: 'POST', headers: form.getHeaders(), body: form }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Facebook post failed');
  }

  console.log(`[broadcast] ✓ Facebook ${isTest ? 'draft' : 'post'} id: ${data.id}`);
  return { postId: data.id, testMode: isTest };
}

async function broadcastInstagram({ imageBase64, caption }) {
  const token   = process.env.FB_PAGE_TOKEN;    // same token as Facebook
  const igAccId = process.env.IG_ACCOUNT_ID;    // Instagram Business Account ID
  if (!token)   throw new Error('FB_PAGE_TOKEN not set in .env');
  if (!igAccId) throw new Error('IG_ACCOUNT_ID not set in .env — find in Meta Business Suite → Instagram account ID');
  const isTest = process.env.TEST_MODE === 'true';
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const imgBuffer = base64ToBuffer(imageBase64);
  const key = `broadcast-temp/flyer-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET,
    Key:         key,
    Body:        imgBuffer,
    ContentType: 'image/png',
  }));
  const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  console.log(`[broadcast] Instagram image URL: ${imageUrl}`);
  const containerRes = await fetch(
    `https://graph.facebook.com/v20.0/${igAccId}/media`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url:  imageUrl,
        caption:    caption.substring(0, 2200), // Instagram caption limit
        access_token: token,
      }),
    }
  );
  const containerData = await containerRes.json();
  if (!containerRes.ok || containerData.error) {
    throw new Error(containerData.error?.message || 'Instagram container creation failed');
  }
  const containerId = containerData.id;
  console.log(`[broadcast] ✓ Instagram container: ${containerId}`);
  if (isTest) {
    console.log('[broadcast] 🧪 TEST MODE — Instagram container created but not published');
    return { containerId, testMode: true, published: false };
  }
  const publishRes = await fetch(
    `https://graph.facebook.com/v20.0/${igAccId}/media_publish`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    }
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) {
    throw new Error(publishData.error?.message || 'Instagram publish failed');
  }
  console.log(`[broadcast] ✓ Instagram published: ${publishData.id}`);
  return { postId: publishData.id, testMode: false, published: true };
}
// ── Route ─────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { platform, imageBase64, caption, event } = req.body;

  if (!platform || !imageBase64 || !caption) {
    return res.status(400).json({ error: 'Missing platform, imageBase64, or caption' });
  }

  if (!['whatsapp', 'facebook', 'instagram'].includes(platform)) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  console.log(`[broadcast] ${platform} | "${event?.title || 'unknown'}" | test:${process.env.TEST_MODE}`);

  try {
    let result;
    if (platform === 'whatsapp')        result = await broadcastWhatsApp({ imageBase64, caption });
    else if (platform === 'facebook')   result = await broadcastFacebook({ imageBase64, caption });
    else if (platform === 'instagram')  result = await broadcastInstagram({ imageBase64, caption });

    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    console.error(`[broadcast] ✗`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
