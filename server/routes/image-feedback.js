/**
 * server/routes/image-feedback.js
 * Handles POST /api/image-feedback — a 👍/👎 rating (with an optional
 * comment) on an AI-generated poster/background image, sent straight to
 * the site owner's inbox via AWS SES. Mirrors routes/contact.js's
 * lazy-require + try/catch SES pattern exactly, so a missing
 * @aws-sdk/client-ses install or missing env vars fails just this one
 * request, never the whole server at startup.
 *
 * Unlike /api/contact (public, no auth), this fires from inside the
 * editor right after a generation, so it requires a valid session token —
 * that's what lets the email identify who sent it (email/org) without the
 * client having to supply it by hand.
 *
 * Not stored in the database — same "straight to inbox" scoping as
 * contact.js. If this needs to become queryable/aggregatable later, add a
 * DynamoDB write here alongside the email.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

const MAX_COMMENT_LEN = 2000;
const MAX_PROMPT_LEN = 4000;

router.post('/', authenticateToken, async (req, res) => {
  const { rating, comment, prompt, category, mode } = req.body || {};

  if (rating !== 'up' && rating !== 'down') {
    return res.status(400).json({ error: "rating must be 'up' or 'down'." });
  }

  const toAddress = process.env.CONTACT_EMAIL;
  const fromAddress = process.env.SES_FROM_EMAIL || process.env.CONTACT_EMAIL;

  if (!toAddress || !fromAddress) {
    console.error('[IMAGE-FEEDBACK] Missing CONTACT_EMAIL / SES_FROM_EMAIL in server/.env — cannot send.');
    return res.status(500).json({ error: 'Feedback isn\'t fully configured on the server yet.' });
  }

  let SESClient, SendEmailCommand;
  try {
    ({ SESClient, SendEmailCommand } = require('@aws-sdk/client-ses'));
  } catch (requireError) {
    console.error('[IMAGE-FEEDBACK] @aws-sdk/client-ses is not installed — run `npm install` in server/.', requireError.message);
    return res.status(500).json({ error: 'Feedback isn\'t fully set up on the server yet. Please try again later.' });
  }

  const safeComment = (comment || '').toString().slice(0, MAX_COMMENT_LEN).trim();
  const safePrompt = (prompt || '').toString().slice(0, MAX_PROMPT_LEN).trim();
  const emoji = rating === 'up' ? '👍' : '👎';
  const who = req.user?.email || req.user?.displayName || 'Unknown user';
  const orgName = req.org?.name || req.user?.orgId || 'Unknown org';

  const subject = `[CalendarFly Image Feedback] ${emoji} ${rating.toUpperCase()} — ${orgName}`;
  const textBody =
    `AI image feedback from the flyer editor\n\n` +
    `Rating: ${emoji} ${rating.toUpperCase()}\n` +
    `From: ${who}\n` +
    `Organization: ${orgName}\n` +
    `Mode: ${mode || 'unknown'}${category ? ` (${category})` : ''}\n\n` +
    (safeComment ? `Comment:\n${safeComment}\n\n` : '') +
    `Prompt used:\n${safePrompt || '(none captured)'}\n`;

  try {
    const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-2' });
    await ses.send(new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [toAddress] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: textBody, Charset: 'UTF-8' } },
      },
    }));

    console.log(`[IMAGE-FEEDBACK] Sent ${rating} feedback from ${who} (${orgName})`);
    res.json({ success: true });
  } catch (error) {
    console.error('[IMAGE-FEEDBACK] SES send failed:', error);
    res.status(500).json({ error: 'Failed to send your feedback. Please try again in a moment.' });
  }
});

module.exports = router;
