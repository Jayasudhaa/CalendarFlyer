/**
 * broadcast.js — POST /api/broadcast
 *
 * Sends the flyer image + caption to WhatsApp, Facebook, and/or Instagram.
 *
 * ── Dev mode / Prod mode ─────────────────────────────────────────────────
 * Every platform below now has TWO separate credential sets — a "dev" one
 * for testing (point this at a WhatsApp test number, a test/unpublished
 * Facebook Page, a test Instagram account) and a "prod" one for real
 * broadcasts to the temple's actual community. Which set is used is
 * controlled by SOCIAL_MODE ('dev' | 'prod'); if SOCIAL_MODE isn't set it
 * falls back to 'prod' when NODE_ENV=production and 'dev' otherwise, so a
 * local checkout defaults to dev-safe behavior without any extra config.
 * This replaces the old single TEST_MODE flag, which only ever redirected
 * WHERE a WhatsApp message went (and whether a Facebook post stayed a
 * draft) while still using the exact same production tokens for
 * everything — meaning a "test" send was still billed against, and
 * visible to, the real WhatsApp Business number / Facebook Page / IG
 * account. TEST_MODE=true still works as an extra manual override (forces
 * dev-mode credentials regardless of SOCIAL_MODE) for anyone already
 * relying on it.
 *
 * Required .env — each platform reads "<NAME>_DEV" / "<NAME>_PROD" first
 * and falls back to the old unsuffixed "<NAME>" if neither is set, so
 * existing deployments keep working untouched until you add the suffixed
 * pair:
 *   WHATSAPP_TOKEN_DEV / _PROD       — Meta Cloud API permanent token
 *   WHATSAPP_PHONE_ID_DEV / _PROD    — Phone Number ID from Meta Business dashboard
 *   WHATSAPP_GROUP_ID_DEV / _PROD    — WhatsApp recipient ID (group or individual)
 *   FB_PAGE_TOKEN_DEV / _PROD        — Facebook Page access token (also used for Instagram)
 *   FB_PAGE_ID_DEV / _PROD           — Facebook Page ID
 *   IG_ACCOUNT_ID_DEV / _PROD        — Instagram Business Account ID (Graph API)
 *   SOCIAL_MODE                      — 'dev' | 'prod', see above
 *
 * ── Per-platform test mode ───────────────────────────────────────────────
 * WHATSAPP_TEST_MODE / FACEBOOK_TEST_MODE / INSTAGRAM_TEST_MODE — 'true' |
 * 'false', one per platform, checked by platformTestMode() below. Each
 * platform's flag is independent: you can leave WhatsApp on test mode while
 * Facebook posts for real, for example. Any platform whose own variable
 * isn't set falls back to the old shared TEST_MODE, so this is additive —
 * nothing breaks if only TEST_MODE is configured.
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
const { incrementUsage, getOrganization, canUseFeature, checkLimit } = require('../organizations');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const {
  createBroadcast, recordPlatformResult, cancelScheduledBroadcast, listBroadcastsForOrg,
} = require('../broadcasts');
const { sendServerError } = require('../utils/errors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid'); // for broadcast_group_id on reminder series (see POST /schedule)

// A broadcast send fans out to real email/WhatsApp/Facebook/Instagram
// channels — actual devotees' inboxes and social accounts — so this caps
// how many sends one org can fire off in a window, on top of the per-org
// monthly plan limit (organizations.js incrementUsage) that already exists.
// Same rateLimit pattern/library as routes/remove-bg.js / routes/rsvp.js.
// Keyed by org (falls back to IP for the rare case authenticateToken
// didn't attach req.user).
const broadcastSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.org_id) || ipKeyGenerator(req.ip),
  message: { error: 'Too many broadcast sends — please wait a few minutes and try again.' },
});

const router = express.Router();

// Every route below is already behind authenticateToken, so who's asking is
// never in question — req.user.org_id comes straight from their JWT. `req.org`
// (set by tenantMiddleware in server/middleware/tenant.js) is a DIFFERENT
// thing: it's resolved from the request's hostname/subdomain, for the public
// (unauthenticated) calendar pages. Broadcast used to read req.org directly,
// which meant "which org's Facebook/WhatsApp credentials do I use" secretly
// depended on what hostname the request came in on — an App Runner default
// URL, localhost, or any host without a matching subdomain resolves req.org
// to null, silently falling back to the shared .env credentials no matter
// what the logged-in admin saved in Settings. Resolving the org from the
// JWT here instead makes Broadcast use the same "current org" as Settings.
async function resolveOrg(req) {
  if (!req.user || !req.user.org_id) return null;
  try {
    return await getOrganization(req.user.org_id);
  } catch (err) {
    console.error('[BROADCAST] Failed to resolve org from JWT:', err.message);
    return null;
  }
}

function base64ToBuffer(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

// ── Dev mode / Prod mode ─────────────────────────────────────────────────
// See the file header above. `pick()` is the one place that resolves a
// suffixed var with a graceful fallback to the old unsuffixed name.
function socialMode() {
  const explicit = (process.env.SOCIAL_MODE || '').toLowerCase();
  if (explicit === 'dev' || explicit === 'prod') return explicit;
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}
function pick(base, mode) {
  const suffixed = process.env[`${base}_${mode.toUpperCase()}`];
  if (suffixed) return suffixed;
  return process.env[base]; // backward-compat: old unsuffixed var, same for both modes
}

// Per-platform test-mode flag — see file header. Checks that platform's own
// WHATSAPP_TEST_MODE / FACEBOOK_TEST_MODE / INSTAGRAM_TEST_MODE first; if
// that variable isn't set at all, falls back to the old shared TEST_MODE so
// existing setups (a single global flag) keep working unchanged.
const PLATFORM_TEST_VAR = {
  whatsapp:  'WHATSAPP_TEST_MODE',
  facebook:  'FACEBOOK_TEST_MODE',
  instagram: 'INSTAGRAM_TEST_MODE',
};
function platformTestMode(platform) {
  const raw = process.env[PLATFORM_TEST_VAR[platform]];
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  return process.env.TEST_MODE === 'true'; // legacy shared fallback
}

// Meta's WhatsApp errors are raw Graph API codes ("(#100) Invalid
// parameter") that don't say what to actually do. This maps the codes we've
// hit in practice to a plain-language hint appended to the message the
// Broadcast page shows, instead of leaving someone to go look up what
// "(#100)" means. None of these are dev/prod issues — they're Meta's own
// WhatsApp Business Platform rules and apply the same in both modes.
function explainWhatsAppError(error) {
  if (!error) return null;
  switch (error.code) {
    case 131047:
      return "The recipient hasn't messaged your WhatsApp number in the last 24 hours — WhatsApp only lets a business start a free-form message within that window. Send a message from their phone to your WhatsApp number first, or use the Template option instead (templates aren't limited by the 24-hour window).";
    case 100:
      return "This usually means either the recipient hasn't messaged your WhatsApp number in the last 24 hours (only an approved template can start a new conversation), or — if you're still on Meta's free test number — the recipient isn't on your test recipient list yet (Meta Business dashboard → WhatsApp → API Setup).";
    case 131030:
      return "This phone number isn't on your WhatsApp test recipient list yet. Add it in Meta Business dashboard → WhatsApp → API Setup, then try again.";
    case 132000:
      return "The approved template needs a value for every placeholder — double check none of the fields were left blank.";
    default:
      return null;
  }
}

// Just the Facebook Page access token — org's own if connected, else the
// shared .env one — without requiring a (possibly wrong) Page ID alongside
// it. Used by /facebook-page-lookup below, which exists precisely to find
// out what Page ID actually goes with this token, so it can't assume the
// ID is already correct.
function getFacebookToken(org) {
  const orgSocial = (org && org.social_accounts) || {};
  if (orgSocial.facebook && orgSocial.facebook.page_token) {
    return { token: orgSocial.facebook.page_token, source: 'org' };
  }
  return { token: pick('FB_PAGE_TOKEN', socialMode()), source: 'env' };
}

function getOrgCredentials(org, platform) {
  const mode = socialMode();
  const orgSocial = (org && org.social_accounts) || {};
  if (platform === 'whatsapp') {
    // Prefer the org's own connected WhatsApp number (Organization Settings
    // → Connect with WhatsApp, saved via the Embedded Signup flow in
    // routes/social-connect.js) over the shared .env credentials — same
    // "org's own connection wins" pattern as Facebook/Instagram below.
    // groupId/testRecipient still come from .env either way — those pick
    // WHERE a message is sent in dev mode (see getWhatsAppRecipient below),
    // not which WhatsApp Business number sends it.
    const wa = orgSocial.whatsapp;
    if (wa && wa.token && wa.phone_id) {
      return {
        token: wa.token,
        phoneId: wa.phone_id,
        groupId: pick('WHATSAPP_GROUP_ID', mode),
        testRecipient: process.env.TEST_RECIPIENT_NUMBER,
        mode,
        source: 'org',
      };
    }
    // No org-owned WhatsApp connection. In prod, don't silently fall back to
    // the shared .env number for every tenant that hasn't connected their
    // own -- that's a real multi-tenant leak (a broadcast "succeeding" onto
    // whichever number happens to be configured server-wide, or against a
    // stale/expired shared token, instead of telling the admin to connect
    // their own account). Dev mode keeps the fallback so local testing
    // still works without a real Meta connection.
    if (mode === 'prod') {
      return { mode, source: 'unconnected' };
    }
    return {
      token: pick('WHATSAPP_TOKEN', mode),
      phoneId: pick('WHATSAPP_PHONE_ID', mode),
      groupId: pick('WHATSAPP_GROUP_ID', mode),
      testRecipient: process.env.TEST_RECIPIENT_NUMBER,
      mode,
      source: 'env',
    };
  } else if (platform === 'facebook') {
    // Prefer the organization's own connected Facebook Page (saved in
    // Organization Settings) over the shared global .env credentials — this
    // is what lets each tenant broadcast to its own Page instead of every
    // org sharing one. Falls back to .env when the org hasn't connected its
    // own Page yet.
    const fb = orgSocial.facebook;
    if (fb && fb.page_token && fb.page_id) {
      return { token: fb.page_token, pageId: fb.page_id, mode, source: 'org' };
    }
    // Same reasoning as WhatsApp above -- require the org's own connection
    // in prod rather than silently posting to the shared demo Page.
    if (mode === 'prod') {
      return { mode, source: 'unconnected' };
    }
    return {
      token: pick('FB_PAGE_TOKEN', mode),
      pageId: pick('FB_PAGE_ID', mode),
      mode,
      source: 'env',
    };
  } else if (platform === 'instagram') {
    // Instagram Business accounts are always linked through a Facebook
    // Page, and publishing uses that Page's access token — so an org's own
    // Instagram connection reuses its own Facebook page_token above rather
    // than needing a separate token stored per platform.
    const ig = orgSocial.instagram;
    const fb = orgSocial.facebook;
    if (ig && ig.account_id && fb && fb.page_token) {
      return { token: fb.page_token, accountId: ig.account_id, mode, source: 'org' };
    }
    // Same reasoning as WhatsApp/Facebook above.
    if (mode === 'prod') {
      return { mode, source: 'unconnected' };
    }
    return {
      token: pick('FB_PAGE_TOKEN', mode),
      accountId: pick('IG_ACCOUNT_ID', mode),
      mode,
      source: 'env',
    };
  }
  return {};
}
function getWhatsAppRecipient(org) {
  const mode = socialMode();
  const forceTest = platformTestMode('whatsapp'); // manual override, independent of SOCIAL_MODE
  if (mode === 'dev' || forceTest) {
    const num = pick('WHATSAPP_GROUP_ID', 'dev') || process.env.TEST_RECIPIENT_NUMBER;
    if (!num) throw new Error(`Dev mode is on (SOCIAL_MODE=${mode}${forceTest ? ', WHATSAPP_TEST_MODE=true' : ''}) but neither WHATSAPP_GROUP_ID_DEV nor TEST_RECIPIENT_NUMBER is set`);
    console.log(`[BROADCAST] 🧪 DEV MODE — sending to ${num}`);
    return num;
  }
  const groupId = pick('WHATSAPP_GROUP_ID', 'prod');
  if (!groupId) throw new Error('WHATSAPP_GROUP_ID_PROD (or WHATSAPP_GROUP_ID) not set');
  console.log(`[BROADCAST] 🚀 PROD MODE — sending to group`);
  return groupId;
}
// ── Helpers ───────────────────────────────────────────────────────────────────

// Convert data:image/png;base64,... → Buffer

// ── WhatsApp ──────────────────────────────────────────────────────────────────

async function broadcastWhatsApp({ imageBase64, caption, org }) {
  const creds = getOrgCredentials(org, 'whatsapp');
  const { token, phoneId } = creds;

  if (creds.source === 'unconnected') throw new Error('Connect your WhatsApp Business number under Settings \u2192 Social Media Connections before broadcasting.');
  if (!token) throw new Error('WHATSAPP_TOKEN not set');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID not set');

  const recipient = getWhatsAppRecipient(org);

  // The flyer image is optional on the Broadcast page ("Media: None
  // (optional)" in the checklist) — a caption-only broadcast is a normal
  // WhatsApp text message, not an error. Only go through the media-upload +
  // image-message path when an image was actually attached.
  let msgRes;
  if (imageBase64) {
    const imgBuffer = base64ToBuffer(imageBase64);
    // WhatsApp's Cloud API caps images at 5MB and rejects anything larger —
    // usually surfaced as a bare, unhelpful "(#100) Invalid parameter" on
    // the upload step. Catch it here with the actual size instead.
    const MAX_WHATSAPP_IMAGE_BYTES = 5 * 1024 * 1024;
    if (imgBuffer.length > MAX_WHATSAPP_IMAGE_BYTES) {
      const mb = (imgBuffer.length / (1024 * 1024)).toFixed(1);
      throw new Error(`Image is ${mb}MB — WhatsApp only accepts images up to 5MB. Use a smaller or more compressed image.`);
    }

    // Step 1: Upload image to WhatsApp media
    console.log(`[BROADCAST] ${org?.name || 'Unknown'} - Uploading image to WhatsApp...`);
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
      const base = uploadData.error?.message || 'WhatsApp media upload failed';
      const hint = explainWhatsAppError(uploadData.error);
      throw new Error(hint ? `${base} — ${hint}` : base);
    }
    const mediaId = uploadData.id;
    console.log(`[BROADCAST] ✓ MediaId: ${mediaId}`);

    // Step 2: Send image message with caption
    msgRes = await fetch(
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
  } else {
    // No image attached — send a plain text message instead.
    msgRes = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:   recipient,
          type: 'text',
          text: { body: caption.substring(0, 4096) },
        }),
      }
    );
  }
  const msgData = await msgRes.json();
  if (!msgRes.ok || msgData.error) {
    const base = msgData.error?.message || 'WhatsApp send failed';
    const hint = explainWhatsAppError(msgData.error);
    throw new Error(hint ? `${base} — ${hint}` : base);
  }

  const messageId = msgData.messages?.[0]?.id;
  console.log(`[BROADCAST] ✓ Sent to ${recipient}`);
  return { messageId, recipient, testMode: socialMode() === 'dev' || platformTestMode('whatsapp') };
}

// Sends a pre-approved Meta message template (required for messaging a
// recipient outside the 24-hour customer-service window). Unlike
// broadcastWhatsApp above, there's no media upload step — the template name
// must already be approved in Meta Business Manager, and `variables` fill in
// the template's {{1}}, {{2}}, ... placeholders in order.
async function broadcastWhatsAppTemplate({ template_name, variables, org }) {
  const creds = getOrgCredentials(org, 'whatsapp');
  const { token, phoneId } = creds;

  if (creds.source === 'unconnected') throw new Error('Connect your WhatsApp Business number under Settings \u2192 Social Media Connections before broadcasting.');
  if (!token) throw new Error('WHATSAPP_TOKEN not set');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_ID not set');
  if (!template_name) throw new Error('template_name is required');

  const recipient = getWhatsAppRecipient(org);

  const parameters = (variables || [])
    .filter(v => v !== undefined && v !== null && v !== '')
    .map(v => ({ type: 'text', text: String(v) }));

  console.log(`[BROADCAST] ${org?.name || 'Unknown'} - Sending WhatsApp template "${template_name}"...`);
  const msgRes = await fetch(
    `https://graph.facebook.com/v20.0/${phoneId}/messages`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:   recipient,
        type: 'template',
        template: {
          name: template_name,
          // Default is 'en' (not 'en_US') to match how "temple_event_announcement"
          // is actually registered in WhatsApp Manager — confirmed by checking
          // the template's Language column there. Meta treats 'en' and 'en_US'
          // as distinct template variants, so this must match exactly or Meta
          // returns "(#132001) Template name does not exist in the translation".
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: parameters.length ? [{ type: 'body', parameters }] : [],
        },
      }),
    }
  );
  const msgData = await msgRes.json();
  if (!msgRes.ok || msgData.error) {
    const base = msgData.error?.message || 'WhatsApp template send failed';
    const hint = explainWhatsAppError(msgData.error);
    throw new Error(hint ? `${base} — ${hint}` : base);
  }

  const messageId = msgData.messages?.[0]?.id;
  console.log(`[BROADCAST] ✓ Template sent to ${recipient}`);
  return { messageId, recipient, testMode: socialMode() === 'dev' || platformTestMode('whatsapp') };
}

// ── Email ─────────────────────────────────────────────────────────────────
// Sends ONE email to the org's own mailing-list address (Settings ->
// Broadcast -> Email List) -- same shape as the WhatsApp group / Facebook
// Page it already broadcasts to: one destination, your existing list
// handles fan-out to individual subscribers, so there's no per-recipient
// send loop here and no new devotee data collected. Reuses the existing
// SES wrapper (utils/mailer.js), previously only used for account-
// verification email and the contact form. Text-only for now -- SES's
// simple SendEmailCommand (what mailer.js uses) doesn't attach files, so
// the flyer image itself isn't included, just the caption.
async function broadcastEmail({ caption, event, org }) {
  const to = org && org.broadcast_email;
  if (!to) {
    throw new Error('No email list address is set -- add one under Settings → Broadcast → Email List.');
  }

  const { sendEmail } = require('../utils/mailer');
  const orgName = (org && org.name) || 'Temple';
  const subject = event && event.title ? `${event.title} — ${orgName} Update` : `${orgName} Update`;
  const html = `<div style="font-family:-apple-system,sans-serif;white-space:pre-wrap;line-height:1.6;color:#1a1a1a;">${String(caption).replace(/</g, '&lt;')}</div>`;

  await sendEmail({ to, subject, text: caption, html });
  console.log(`[BROADCAST] ✓ Email sent to ${to}`);
  return { recipient: to };
}

// ── Facebook ──────────────────────────────────────────────────────────────────

async function broadcastFacebook({ imageBase64, caption, org }) {
  const creds = getOrgCredentials(org, 'facebook');
  const { token, pageId } = creds;

  if (creds.source === 'unconnected') throw new Error('Connect your Facebook Page under Settings \u2192 Social Media Connections before broadcasting.');
  if (!token) throw new Error('FB_PAGE_TOKEN not set');
  if (!pageId) throw new Error('FB_PAGE_ID not set');
  // Draft-vs-published is controlled purely by FACEBOOK_TEST_MODE now, not
  // by SOCIAL_MODE — SOCIAL_MODE has no _DEV/_PROD-suffixed Facebook
  // credentials to switch between anyway, so tying isTest to
  // socialMode()==='dev' only meant every local/dev-server run got silently
  // forced into draft posts regardless of FACEBOOK_TEST_MODE, which defeats
  // the whole point of having a separate per-platform flag.
  const isTest = platformTestMode('facebook');

  // Media is optional on the Broadcast page — with an image, post through
  // /photos (multipart upload + caption); without one, a plain text post to
  // the Page's feed is just as valid a Facebook post.
  let res;
  if (imageBase64) {
    const imgBuffer = base64ToBuffer(imageBase64);
    const form = new FormData();
    form.append('source',    imgBuffer, { filename: 'flyer.png', contentType: 'image/png' });
    form.append('caption',   caption);
    form.append('access_token', token);
    if (isTest) form.append('published', 'false'); // draft — only you see it

    res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/photos`,
      { method: 'POST', headers: form.getHeaders(), body: form }
    );
  } else {
    res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: caption,
          access_token: token,
          ...(isTest ? { published: false } : {}), // draft — only you see it
        }),
      }
    );
  }
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
  if (creds.source === 'unconnected') throw new Error('Connect your Instagram Business account under Settings \u2192 Social Media Connections before broadcasting.');
  if (!token) throw new Error('FB_PAGE_TOKEN not set');
  if (!accountId) throw new Error('IG_ACCOUNT_ID not set');
  // Unlike WhatsApp/Facebook, Instagram's API has no text-only post — every
  // post needs an image or video, so this one genuinely can't be optional.
  if (!imageBase64) throw new Error('Instagram requires an image or video — add one under "Add Creative" first.');
  // Same fix as broadcastFacebook above — governed by INSTAGRAM_TEST_MODE
  // alone, not by SOCIAL_MODE.
  const isTest = platformTestMode('instagram');
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ 
    region: process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2' 
  });
  const imgBuffer = base64ToBuffer(imageBase64);
  const org_prefix = org ? `orgs/${org.org_id}/broadcast-temp/` : 'broadcast-temp/';
  const key = `${org_prefix}flyer-${Date.now()}.png`;
  // No ACL here — buckets created since April 2023 default to "Bucket
  // owner enforced" Object Ownership, which rejects any object-level ACL
  // outright ("The bucket does not allow ACLs"). Public access has to come
  // from the bucket's own policy instead; this app's logo/banner uploads
  // already rely on that same bucket policy for public URLs, so this image
  // needs no ACL of its own either.
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        imgBuffer,
    ContentType: 'image/png',
  }));
  // Bug fix: this used to read process.env.S3_BUCKET here while the upload
  // above uses S3_BUCKET_NAME — two different env var names, so with only
  // S3_BUCKET_NAME set (which is what's actually in .env), this built a URL
  // like "https://undefined.s3....amazonaws.com/..." even after a successful
  // upload. Now both use the same S3_BUCKET_NAME, and the region matches
  // what the S3Client above actually connected with.
  const region = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
  const imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
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

  // Instagram needs a moment to fetch and process the image from imageUrl
  // before media_publish will accept the container — publishing right after
  // creation often fails with "Media ID is not available" even though the
  // container itself was created successfully. Poll status_code
  // (IN_PROGRESS → FINISHED) instead of guessing a fixed delay.
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  let status = 'IN_PROGRESS';
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts && status === 'IN_PROGRESS'; attempt++) {
    await sleep(1500);
    const statusRes = await fetch(
      `https://graph.facebook.com/v20.0/${containerId}?fields=status_code&access_token=${token}`
    );
    const statusData = await statusRes.json();
    status = statusData.status_code || 'IN_PROGRESS';
    console.log(`[BROADCAST] Instagram container ${containerId} status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);
  }
  if (status === 'ERROR') {
    throw new Error('Instagram failed to process the uploaded image — try a different image or a smaller file size.');
  }
  if (status !== 'FINISHED') {
    throw new Error('Instagram is still processing the image after 15 seconds — wait a moment and try publishing again.');
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

// POST /api/broadcast/start — creates the one history row a multi-platform
// send groups under (see broadcasts.js's file header: one row per "batch",
// whatever platforms were checked). The Broadcast page calls this once
// before firing its per-platform POST / calls in parallel (see
// BroadcastPage.jsx's handleBroadcast), then passes the returned
// broadcast_id on each of those so they all record into the same row
// instead of each platform silently going unlogged. `broadcast_id` is
// optional on POST / below precisely so nothing breaks if this ever isn't
// called first — that send still goes through, it just isn't in history.
router.post('/start', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { platforms, caption } = req.body;
    if (!Array.isArray(platforms) || !platforms.length) {
      return res.status(400).json({ error: 'platforms must be a non-empty array' });
    }
    const org = await resolveOrg(req);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const row = await createBroadcast({
      org_id: org.org_id,
      created_by: req.user.user_id,
      kind: 'immediate',
      platforms,
      caption: caption || '',
    });
    res.json({ broadcast_id: row.broadcast_id });
  } catch (err) {
    console.error('[BROADCAST] Failed to start batch:', err.message);
    sendServerError(res, err);
  }
});

router.post('/', authenticateToken, requireRole('owner', 'admin'), broadcastSendLimiter, async (req, res) => {
  const { platform, imageBase64, caption, event, broadcast_id } = req.body;

  // imageBase64 is intentionally optional here — the flyer image is an
  // optional step on the Broadcast page, and WhatsApp/Facebook both support
  // a caption-only send. Instagram is the one platform that truly requires
  // an image, and broadcastInstagram() below throws its own clear error for
  // that instead of this route rejecting the request up front.
  if (!platform || !caption) {
    return res.status(400).json({ error: 'Missing platform or caption' });
  }

  if (!['whatsapp', 'facebook', 'instagram', 'email'].includes(platform)) {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  const org = await resolveOrg(req);
  const orgName = org ? org.name : 'Unknown';
  console.log(`[BROADCAST] ${orgName} | ${platform} | "${event?.title || 'unknown'}"`);

  // WhatsApp is Enterprise-only (needs the org's own WhatsApp Business
  // number) -- Free/Starter/Pro stay on Instagram/Facebook/Email. Only
  // gate when we actually resolved an org; an unresolved org already falls
  // back to shared .env credentials below, unchanged from before.
  if (platform === 'whatsapp' && org && !canUseFeature(org, 'whatsapp_broadcast')) {
    return res.status(403).json({
      error: 'WhatsApp broadcast is available on the Enterprise plan — upgrade to unlock it.',
    });
  }

  // Enforce the plan's monthly broadcast-send cap (mirrors events_per_month
  // -- see organizations.js PLAN_LIMITS). This was previously never
  // checked: incrementUsage(org_id, 'flyers') ran after every successful
  // send, but nothing ever compared that counter to the limit.
  if (org && !checkLimit(org, 'flyers', req.user && req.user.email)) {
    return res.status(403).json({
      error: `You've reached your plan's ${org.limits.flyers_per_month}-broadcast monthly limit. Upgrade your plan to send more.`,
    });
  }

  try {
    let result;
    if (platform === 'whatsapp') result = await broadcastWhatsApp({ imageBase64, caption, org });
    else if (platform === 'facebook') result = await broadcastFacebook({ imageBase64, caption, org });
    else if (platform === 'instagram') result = await broadcastInstagram({ imageBase64, caption, org });
    else if (platform === 'email') result = await broadcastEmail({ caption, event, org });

    if (org) {
      await incrementUsage(org.org_id, 'flyers').catch(err =>
        console.error('[BROADCAST] Failed to increment usage:', err)
      );
    }
    if (broadcast_id) {
      await recordPlatformResult(broadcast_id, platform, { success: true, ...result })
        .catch(err => console.error('[BROADCAST] Failed to record history:', err.message));
    }
    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    console.error(`[BROADCAST] ✗`, err.message);
    if (broadcast_id) {
      await recordPlatformResult(broadcast_id, platform, { success: false, error: err.message })
        .catch(e => console.error('[BROADCAST] Failed to record history:', e.message));
    }
    // Deliberate user-facing text from broadcastWhatsApp/Facebook/Instagram/
    // Email above (e.g. "WHATSAPP_TOKEN not set", "Image is 7MB — WhatsApp
    // only accepts up to 5MB", a Meta API rejection reason) — the Broadcast
    // page's whole point is showing the admin why a send failed, so this is
    // never gated behind NODE_ENV like utils/errors.js's sendServerError.
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/broadcast/whatsapp-template — send a pre-approved Meta template
// message (used by the "WhatsApp API Template" card on the Broadcast page).
// This was previously missing entirely, so the frontend's call to it fell
// through to Express's default HTML 404 page and broke JSON parsing on the
// client ("Unexpected token '<', <!DOCTYPE ...").
router.post('/whatsapp-template', authenticateToken, requireRole('owner', 'admin'), broadcastSendLimiter, async (req, res) => {
  const { template_name, variables } = req.body;

  if (!template_name) {
    return res.status(400).json({ error: 'template_name is required' });
  }

  const org = await resolveOrg(req);
  const orgName = org ? org.name : 'Unknown';
  console.log(`[BROADCAST] ${orgName} | whatsapp-template | "${template_name}"`);

  try {
    const result = await broadcastWhatsAppTemplate({ template_name, variables, org });

    if (org) {
      await incrementUsage(org.org_id, 'flyers').catch(err =>
        console.error('[BROADCAST] Failed to increment usage:', err)
      );
    }
    return res.status(200).json({ success: true, sent: 1, ...result });

  } catch (err) {
    console.error(`[BROADCAST] ✗`, err.message);
    // Deliberate user-facing text from broadcastWhatsAppTemplate above —
    // same reasoning as the main POST / handler further up this file.
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/broadcast/facebook-page-lookup — asks Meta "what Page does this
// access token actually belong to?" A Page access token's own /me call
// resolves to that Page's real id + name — which is the one reliable way to
// get the correct Page ID, instead of guessing from a facebook.com URL
// (personal profile URLs and Page URLs look identical, and Meta rejects a
// personal profile ID wherever a Page ID is expected with a bare
// "(#100) The global id ... is not allowed for this call").
router.get('/facebook-page-lookup', authenticateToken, async (req, res) => {
  try {
    const org = await resolveOrg(req);
    const { token } = getFacebookToken(org);
    if (!token) {
      return res.status(400).json({ error: 'No Facebook Page access token saved yet — paste one first.' });
    }
    const url = `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${token}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok || data.error) {
      const base = data.error?.message || 'Facebook Page lookup failed';
      const hint = data.error?.code === 190
        ? ' This usually means the token has expired or was revoked — generate a fresh one and save it again.'
        : '';
      return res.status(400).json({ error: base + hint });
    }
    res.json({ page_id: data.id, page_name: data.name || null });
  } catch (err) {
    console.error('[BROADCAST] Facebook Page lookup error:', err.message);
    sendServerError(res, err);
  }
});

// GET /api/broadcast/instagram-account-lookup — looks up the Instagram
// Business Account ID linked to this org's Facebook Page (the org's own
// connected Page if set in Settings, else the shared .env one), via Graph
// API's instagram_business_account field. Saves an admin from having to dig
// the numeric ID out of Meta Business Suite by hand — the Facebook Page has
// to be connected first anyway, and Instagram is always linked through it.
router.get('/instagram-account-lookup', authenticateToken, async (req, res) => {
  try {
    const org = await resolveOrg(req);
    const creds = getOrgCredentials(org, 'facebook');
    if (!creds.token || !creds.pageId) {
      return res.status(400).json({ error: 'Connect a Facebook Page first — Instagram lookup needs its Page ID and access token.' });
    }
    const url = `https://graph.facebook.com/v20.0/${creds.pageId}?fields=name,instagram_business_account&access_token=${creds.token}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok || data.error) {
      return res.status(400).json({ error: data.error?.message || 'Instagram lookup failed' });
    }
    if (!data.instagram_business_account) {
      return res.status(404).json({
        error: `No Instagram Business account is linked to the Facebook Page "${data.name || creds.pageId}" yet. In Meta Business Suite, link an Instagram account to this Page, then try again.`
      });
    }
    res.json({ instagram_account_id: data.instagram_business_account.id, page_name: data.name || null });
  } catch (err) {
    console.error('[BROADCAST] Instagram lookup error:', err.message);
    sendServerError(res, err);
  }
});

// GET /api/broadcast/mode — which credential set (dev/prod) each platform is
// currently using, and whether it's actually configured. Lets the client
// show a "🧪 DEV MODE" badge in the Broadcast modal instead of someone
// finding out only after a send fails (or worse, after a "test" post lands
// on the real Facebook Page because they assumed dev mode was on).
router.get('/mode', authenticateToken, async (req, res) => {
  const mode = socialMode();
  const org = await resolveOrg(req);
  const configured = (platform) => {
    const c = getOrgCredentials(org, platform);
    if (platform === 'whatsapp') return !!(c.token && c.phoneId);
    if (platform === 'facebook') return !!(c.token && c.pageId);
    if (platform === 'instagram') return !!(c.token && c.accountId);
    if (platform === 'email') return !!(org && org.broadcast_email);
    return false;
  };
  res.json({
    mode,
    forcedTest: {
      whatsapp: platformTestMode('whatsapp'),
      facebook: platformTestMode('facebook'),
      instagram: platformTestMode('instagram'),
    },
    configured: {
      whatsapp: configured('whatsapp'),
      facebook: configured('facebook'),
      instagram: configured('instagram'),
      email: configured('email'),
    },
  });
});

// ── Schedule / History ───────────────────────────────────────────────────────
// See broadcasts.js's file header and scheduler.js for the rest of this
// feature. Media for a scheduled send has to be persisted somewhere that
// outlives this request (DynamoDB items cap at 400KB, far too small for a
// flyer image as base64) — uploaded to S3 here, same bucket/pattern
// broadcastInstagram() already uses for its own image_url requirement,
// kept as a separate small helper rather than refactoring that working
// code to share it.
async function uploadScheduledImageToS3(imageBase64, org) {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({ region: process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2' });
  const imgBuffer = base64ToBuffer(imageBase64);
  const org_prefix = org ? `orgs/${org.org_id}/scheduled-broadcasts/` : 'scheduled-broadcasts/';
  const key = `${org_prefix}flyer-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: imgBuffer,
    ContentType: 'image/png',
  }));
  const region = process.env.AWS_REGION_S3 || process.env.AWS_REGION || 'us-east-2';
  return `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
}

// Minimum lead time enforced on a new schedule — not a technical
// requirement (the poller would fire a 5-second-out schedule correctly on
// its next tick), just enough of a buffer that "Scheduled!" doesn't flash
// past before the admin can even see it in History, and so there's a real
// window to cancel by mistake-proofing rather than by luck.
const MIN_SCHEDULE_LEAD_MS = 60 * 1000;

router.post('/schedule', authenticateToken, requireRole('owner', 'admin'), broadcastSendLimiter, async (req, res) => {
  try {
    const { platforms, caption, imageBase64, auto_rsvp, rsvp_url, wa_template, scheduled_for, event_at, reminders } = req.body;

    if (!Array.isArray(platforms) || !platforms.length) {
      return res.status(400).json({ error: 'Select at least one platform to schedule.' });
    }
    if (!caption || !caption.trim()) {
      return res.status(400).json({ error: 'Write a message before scheduling.' });
    }
    if (platforms.includes('instagram') && !imageBase64) {
      return res.status(400).json({ error: 'Instagram requires an image — add one under "Add Creative" before scheduling.' });
    }

    const org = await resolveOrg(req);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    let media_url = null;
    if (imageBase64) {
      media_url = await uploadScheduledImageToS3(imageBase64, org);
    }

    // ── Reminder series ──────────────────────────────────────────────────
    // "Event reminders" mode from the Broadcast page: one anchor date/time
    // (event_at) plus a set of lead times (reminders[].minutes_before,
    // e.g. 7 days / 1 day / 3 hours before — see BroadcastPage.jsx), fired
    // as several independent scheduled broadcasts sharing one
    // broadcast_group_id so History can show/cancel them as a set. Each row
    // is a completely ordinary row to scheduler.js — no changes needed
    // there. A lead time that's already in the past for this event_at is
    // skipped rather than failing the whole request (e.g. a "7 days
    // before" reminder for an event only 2 days out just doesn't get
    // created; the 1-day and day-of ones still do).
    if (Array.isArray(reminders) && reminders.length) {
      const when = Number(event_at);
      if (!when || !Number.isFinite(when)) {
        return res.status(400).json({ error: 'Pick the date and time of the event these reminders count down to.' });
      }
      // Capped the same defensive way as /schedule/cancel-batch's ids list
      // below -- the UI only ever offers up to 4, but nothing server-side
      // enforced that on this authenticated endpoint, so a raw API call
      // could otherwise request an unbounded number of DynamoDB writes in
      // one request.
      const cappedReminders = reminders.slice(0, 10);
      const broadcast_group_id = `bg-${uuidv4()}`;
      const created = [];
      const skipped = [];
      for (const r of cappedReminders) {
        const minutesBefore = Number(r && r.minutes_before);
        if (!Number.isFinite(minutesBefore) || minutesBefore < 0) continue;
        const fireAt = when - minutesBefore * 60 * 1000;
        const label = (r.label || `${minutesBefore} min before`).toString().slice(0, 60);
        if (fireAt < Date.now() + MIN_SCHEDULE_LEAD_MS) { skipped.push(label); continue; }
        const row = await createBroadcast({
          org_id: org.org_id,
          created_by: req.user.user_id,
          kind: 'scheduled',
          platforms,
          caption,
          media_url,
          auto_rsvp,
          rsvp_url,
          wa_template: wa_template || null,
          scheduled_for: fireAt,
          broadcast_group_id,
          reminder_label: label,
        });
        created.push({ broadcast_id: row.broadcast_id, scheduled_for: fireAt, label });
      }
      if (!created.length) {
        return res.status(400).json({ error: 'Every reminder in this series falls in the past for that event date — pick a later event date or shorter lead times.' });
      }
      console.log(`[BROADCAST] ${org.name} | ${created.length}-reminder series for event ${new Date(when).toISOString()} | ${platforms.join(', ')}`);
      return res.json({ success: true, broadcast_group_id, created, skipped });
    }

    // ── Plain one-off schedule (unchanged behavior) ─────────────────────
    const when = Number(scheduled_for);
    if (!when || !Number.isFinite(when) || when < Date.now() + MIN_SCHEDULE_LEAD_MS) {
      return res.status(400).json({ error: `Pick a time at least ${MIN_SCHEDULE_LEAD_MS / 1000} seconds from now.` });
    }

    const row = await createBroadcast({
      org_id: org.org_id,
      created_by: req.user.user_id,
      kind: 'scheduled',
      platforms,
      caption,
      media_url,
      auto_rsvp,
      rsvp_url,
      wa_template: wa_template || null,
      scheduled_for: when,
    });

    console.log(`[BROADCAST] ${org.name} | scheduled for ${new Date(when).toISOString()} | ${platforms.join(', ')}`);
    res.json({ success: true, broadcast_id: row.broadcast_id, scheduled_for: when });
  } catch (err) {
    console.error('[BROADCAST] Failed to schedule:', err.message);
    sendServerError(res, err);
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'Organization not found' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { items, cursor } = await listBroadcastsForOrg(org_id, { limit, cursor: req.query.cursor });
    res.json({ items, cursor });
  } catch (err) {
    console.error('[BROADCAST] Failed to load history:', err.message);
    sendServerError(res, err);
  }
});

router.delete('/schedule/:id', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await cancelScheduledBroadcast(req.params.id, req.user.org_id);
    if (result.error === 'not_found') return res.status(404).json({ error: 'Scheduled broadcast not found.' });
    if (result.error === 'already_sent') return res.status(400).json({ error: 'This broadcast already went out and can no longer be cancelled.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[BROADCAST] Failed to cancel schedule:', err.message);
    sendServerError(res, err);
  }
});

// Cancel every still-pending row of a reminder series in one call (History
// page's "Cancel remaining reminders"). There's no DynamoDB index on
// broadcast_group_id — the client already has every id in the group from
// its own history list, so it just posts them here rather than us adding a
// new GSI for what's a rare, small (≤4 rows), client-known batch.
router.post('/schedule/cancel-batch', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 20) : [];
    if (!ids.length) return res.status(400).json({ error: 'No broadcast ids given.' });
    const results = await Promise.all(ids.map(async (id) => {
      const result = await cancelScheduledBroadcast(id, req.user.org_id);
      return { broadcast_id: id, success: !result.error, error: result.error || null };
    }));
    res.json({ results });
  } catch (err) {
    console.error('[BROADCAST] Failed to cancel batch:', err.message);
    sendServerError(res, err);
  }
});

module.exports = router;
// Reused by scheduler.js, which fires due scheduled broadcasts outside any
// request — same pattern routes/auth.js uses to share authenticateToken.
module.exports.broadcastWhatsApp = broadcastWhatsApp;
module.exports.broadcastWhatsAppTemplate = broadcastWhatsAppTemplate;
module.exports.broadcastFacebook = broadcastFacebook;
module.exports.broadcastInstagram = broadcastInstagram;
module.exports.resolveOrgById = async (org_id) => {
  try {
    return await getOrganization(org_id);
  } catch (err) {
    console.error('[BROADCAST] Failed to resolve org for scheduled send:', err.message);
    return null;
  }
};
