/**
 * server/utils/mailer.js
 * Thin wrapper around AWS SES for transactional emails (currently: signup
 * email verification). Mirrors the lazy-require + try/catch pattern
 * already used in routes/contact.js, so a missing @aws-sdk/client-ses
 * install or missing env vars fails just the one request that needed to
 * send mail, not the whole server at startup.
 *
 * Requires in server/.env:
 *   SES_FROM_EMAIL   — a verified SES sender identity (falls back to
 *                       CONTACT_EMAIL if unset, same as contact.js)
 *   SES_REGION       — region SES is set up in (defaults to AWS_REGION, then us-east-2) —
 *                      SES identity verification is region-specific, so this can
 *                      legitimately differ from AWS_REGION (used by DynamoDB etc.)
 * SES starts every new AWS account in "sandbox" mode, where it can only
 * send to addresses you've individually verified in the SES console —
 * see the setup checklist delivered alongside this for how to request
 * production access before real users need to receive mail.
 */

async function sendEmail({ to, subject, text, html }) {
  const fromAddress = process.env.SES_FROM_EMAIL || process.env.CONTACT_EMAIL;
  if (!fromAddress) {
    throw new Error('SES_FROM_EMAIL (or CONTACT_EMAIL) is not set in server/.env — cannot send mail.');
  }

  let SESClient, SendEmailCommand;
  try {
    ({ SESClient, SendEmailCommand } = require('@aws-sdk/client-ses'));
  } catch (requireError) {
    throw new Error('@aws-sdk/client-ses is not installed — run `npm install` in server/.');
  }

  // SES identities (domain/email verification) are region-specific in AWS —
  // this app's DynamoDB tables live in AWS_REGION (us-east-2), but SES
  // verification was done in us-east-1 (N. Virginia), a separate region. A
  // dedicated SES_REGION lets the two differ instead of silently failing
  // every send because the 'from' identity isn't verified in AWS_REGION.
  const ses = new SESClient({ region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-2' });
  const Body = { Text: { Data: text, Charset: 'UTF-8' } };
  if (html) Body.Html = { Data: html, Charset: 'UTF-8' };

  await ses.send(new SendEmailCommand({
    Source: fromAddress,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body,
    },
  }));
}

module.exports = { sendEmail };
