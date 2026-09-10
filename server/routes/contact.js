/**
 * Contact Form Route
 * Handles POST /api/contact — sends the submission straight to the site
 * owner's inbox via AWS SES rather than storing it in the database, per
 * how this was scoped. No auth required; this is a public marketing page.
 *
 * The '@aws-sdk/client-ses' require is done lazily inside the handler
 * (not at module load time) and wrapped in try/catch. That way, if
 * `npm install` hasn't been run yet in server/ and the package isn't in
 * node_modules, only a POST to /api/contact fails with a clear 500 —
 * it can no longer crash the whole server at startup and take down
 * every other route (including login) with it.
 */
const express = require('express');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const { name, email, topic, message } = req.body || {};

  if (!name || !name.trim() || !email || !email.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const toAddress = process.env.CONTACT_EMAIL;
  const fromAddress = process.env.SES_FROM_EMAIL || process.env.CONTACT_EMAIL;

  if (!toAddress || !fromAddress) {
    console.error('[CONTACT] Missing CONTACT_EMAIL / SES_FROM_EMAIL in server/.env — cannot send.');
    return res.status(500).json({
      error: 'The contact form is not fully configured yet. Set CONTACT_EMAIL and SES_FROM_EMAIL in server/.env.',
    });
  }

  let SESClient, SendEmailCommand;
  try {
    ({ SESClient, SendEmailCommand } = require('@aws-sdk/client-ses'));
  } catch (requireError) {
    console.error('[CONTACT] @aws-sdk/client-ses is not installed — run `npm install` in server/.', requireError.message);
    return res.status(500).json({
      error: 'The contact form is not fully set up yet on the server (missing dependency). Please try again later.',
    });
  }

  const safeTopic = (topic || 'General question').toString().slice(0, 120);
  const subject = `[CalendarFly Contact] ${safeTopic} — ${name.trim()}`;
  const textBody =
    `New message from the CalendarFly contact form\n\n` +
    `Name: ${name.trim()}\n` +
    `Email: ${email.trim()}\n` +
    `Topic: ${safeTopic}\n\n` +
    `Message:\n${message.trim()}\n`;

  try {
    // See server/utils/mailer.js — SES identity verification is
    // region-specific and can legitimately differ from AWS_REGION.
    const ses = new SESClient({ region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-2' });
    await ses.send(new SendEmailCommand({
      Source: fromAddress,
      Destination: { ToAddresses: [toAddress] },
      ReplyToAddresses: [email.trim()],
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: textBody, Charset: 'UTF-8' } },
      },
    }));

    console.log(`[CONTACT] Sent message from ${email.trim()} (${safeTopic})`);
    res.json({ success: true });
  } catch (error) {
    // Common cause during local/dev testing: the from/to address isn't a
    // verified SES identity yet (SES sandbox mode), or the IAM credentials
    // in .env don't have ses:SendEmail permission.
    console.error('[CONTACT] SES send failed:', error);
    res.status(500).json({ error: 'Failed to send your message. Please try again in a moment.' });
  }
});

module.exports = router;
