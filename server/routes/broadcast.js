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
const { incrementUsage } = require('../organizations');

const router = express.Router();

function base64ToBuffer(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}
function getOrgCredentials(org, platform) {
  if (platform === 'whatsapp') {
    return {
      token: process.env.WHATSAPP_TOKEN,
      phoneId: process.env.WHATSAPP_PHONE_ID,
      groupId: process.env.WHATSAPP_GROUP_ID,
      testRecipient: process.env.TEST_RECIPIENT_NUMBER
    };
  } else if (platform === 'facebook') {
    return {
      token: process.env.FB_PAGE_TOKEN,
      pageId: process.env.FB_PAGE_ID
    };
  } else if (platform === 'instagram') {
    return {
      token: process.env.FB_PAGE_TOKEN,
      accountId: process.env.IG_ACCOUNT_ID
    };
  }
  return {};
}
function getWhatsAppRecipient(org) {
  const isTest = process.env.TEST_MODE === 'true';
  if (isTest) {
    const num = process.env.TEST_RECIPIENT_NUMBER;
    if (!num) throw new Error('TEST_MODE=true but TEST_RECIPIENT_NUMBER not set');
    console.log(`[BROADCAST] 🧪 TEST MODE — sending to ${num}`);
    return num;
  }
  const groupId = process.env.WHATSAPP_GROUP_ID;
  if (!groupId) throw new Error('WHATSAPP_GROUP_ID not set');
  console.log(`[BROADCAST] 🚀 PROD MODE — sending to group`);
  return groupId;
}
// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert data:image/png;base64,... → Buffer

// ── WhatsApp ──────────────────────────────────────────────────────────────────

async function broadcastWhatsApp({ imageBase64, caption, org }) {
  const creds = getOrgCredentials(org, 'whatsapp');
  const { token, phoneId } = creds;

  if (!token) throw new Error('WHATSAPP_TOKEN not set');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID not set');

  const recipient = getWhatsAppRecipient(org);

  // Step 1: Upload image to WhatsApp media
  console.log(`[BROADCAST] ${org?.name || 'Unknown'} - Uploading image to WhatsApp...`);
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
  console.log(`[BROADCAST] ✓ MediaId: ${mediaId}`);

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
  console.log(`[BROADCAST] ✓ Sent to ${recipient}`);
  return { messageId, recipient, testMode: process.env.TEST_MODE === 'true' };
}

// ── Facebook ──────────────────────────────────────────────────────────────────

async function broadcastFacebook({ imageBase64, caption, org }) {
  const creds = getOrgCredentials(org, 'facebook');
  const { token, pageId } = creds;

  if (!token) throw new Error('FB_PAGE_TOKEN not set');
  if (!pageId) throw new Error('FB_PAGE_ID not set');
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

  console.log(`[BROADCAST] ✓ Facebook ${isTest ? 'draft' : 'post'} id: ${data.id}`);
  return { postId: data.id, testMode: isTest };
}

async function broadcastInstagram({ imageBase64, caption, org }) {
  const creds = getOrgCredentials(org, 'instagram');
  const { token, accountId } = creds;
  if (!token) throw new Error('FB_PAGE_TOKEN not set');
  if (!accountId) throw new Error('IG_ACCOUNT_ID not set');
  const isTest = process.env.TEST_MODE === 'true';
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ 
    region: process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2' 
  });
  const imgBuffer = base64ToBuffer(imageBase64);
  const org_prefix = org ? `orgs/${org.org_id}/broadcast-temp/` : 'broadcast-temp/';
  const key = `${org_prefix}flyer-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        imgBuffer,
    ContentType: 'image/png',
    ACL: 'public-read',
  }));
  const region = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
  const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  console.log(`[BROADCAST] Instagram image URL: ${imageUrl}`);
  const containerRes = await fetch(
    `https://graph.facebook.com/v20.0/${accountId}/media`,
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
  console.log(`[BROADCAST] ✓ Instagram container: ${containerId}`);
  if (isTest) {
    console.log('[BROADCAST] 🧪 TEST MODE — Container created but not published');
    return { containerId, testMode: true, published: false };
  }
  const publishRes = await fetch(
    `https://graph.facebook.com/v20.0/${accountId}/media_publish`,
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
  console.log(`[BROADCAST] ✓ Instagram published: ${publishData.id}`);
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

  const org = req.org;
  const orgName = org ? org.name : 'Unknown';
  console.log(`[BROADCAST] ${orgName} | ${platform} | "${event?.title || 'unknown'}"`);

  try {
    let result;
    if (platform === 'whatsapp') result = await broadcastWhatsApp({ imageBase64, caption, org });
    else if (platform === 'facebook') result = await broadcastFacebook({ imageBase64, caption, org });
    else if (platform === 'instagram') result = await broadcastInstagram({ imageBase64, caption, org });

    if (org) {
      await incrementUsage(org.org_id, 'flyers').catch(err =>
        console.error('[BROADCAST] Failed to increment usage:', err)
      );
    }
    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    console.error(`[BROADCAST] ✗`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
