/**
 * server/community-auth.js — email-verified "Community Member" identity for
 * devotees (as opposed to calendarfly_users, which is temple staff/admin
 * accounts — see utils/communityJwtSecret.js for why these are kept
 * structurally separate, right down to the signing secret).
 *
 * No password, ever — just an email address and a 6-digit code, valid for
 * 90 days once verified. Built for the live event photo album (routes/
 * photos.js) but deliberately not coupled to photos specifically, so it's
 * there if community RSVPs/features want real identity later.
 *
 * Switched from phone/SMS to email per product decision -- org-phone-index
 * and any already-verified phone rows are left in place (harmless, just
 * unused going forward) rather than migrated/deleted, so nothing existing
 * breaks. New verifications go through org-email-index (see
 * migrate-add-community-email-index.js) and server/utils/mailer.js (the
 * same SES wrapper routes/auth.js already uses for signup email), not SNS.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { COMMUNITY_JWT_SECRET } = require('./utils/communityJwtSecret');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const MEMBERS_TABLE = 'calendarfly_community_members';
const OTP_TABLE = 'calendarfly_otp_codes';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const COMMUNITY_TOKEN_EXPIRY = '90d';

function otpKey(org_id, email) {
  return `${org_id}#${email}`;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Lowercased + trimmed so "Person@Example.com " and "person@example.com"
// resolve to the same member row. Deliberately simple validation (not a
// full RFC 5322 parser) -- same reasoning as the old normalizePhone: good
// enough to catch a typo, an SES send failure catches anything this misses.
function normalizeEmail(raw) {
  const trimmed = (raw || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Generates and emails a 6-digit code for (org, email), overwriting any
 * still-pending code for that same email. Throws on an invalid email or an
 * SES failure — the route layer turns that into a clean 400/500.
 */
async function sendOtp(org, rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('Enter a valid email address.');

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  await dynamodb.send(new PutCommand({
    TableName: OTP_TABLE,
    Item: {
      otp_key: otpKey(org.org_id, email),
      code_hash: hashCode(code),
      expires_at: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    },
  }));

  const { sendEmail } = require('./utils/mailer');
  const orgName = org.name || 'CalendarFly';
  await sendEmail({
    to: email,
    subject: `${code} is your ${orgName} verification code`,
    text: `${code} is your ${orgName} verification code. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p><strong>${code}</strong> is your ${orgName} verification code.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
  });

  return { email };
}

/**
 * Checks a submitted code against the pending OTP for (org, phone). On
 * success, deletes the used code (single-use) and returns the verified
 * community member (created on first verification, reused after).
 * Throws with a message safe to show the person directly (wrong/expired
 * code, too many attempts).
 */
async function verifyOtp(org_id, rawEmail, submittedCode) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('Enter a valid email address.');

  const key = otpKey(org_id, email);
  const result = await dynamodb.send(new GetCommand({ TableName: OTP_TABLE, Key: { otp_key: key } }));
  const pending = result.Item;

  if (!pending) throw new Error('Request a new code — none is pending for this email.');
  if (pending.expires_at < Date.now()) {
    await dynamodb.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { otp_key: key } }));
    throw new Error('That code expired — request a new one.');
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    await dynamodb.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { otp_key: key } }));
    throw new Error('Too many wrong attempts — request a new code.');
  }
  if (hashCode(String(submittedCode || '').trim()) !== pending.code_hash) {
    await dynamodb.send(new PutCommand({ TableName: OTP_TABLE, Item: { ...pending, attempts: pending.attempts + 1 } }));
    throw new Error('That code is incorrect — check it and try again.');
  }

  await dynamodb.send(new DeleteCommand({ TableName: OTP_TABLE, Key: { otp_key: key } }));
  return getOrCreateMember(org_id, email);
}

async function getOrCreateMember(org_id, email) {
  const existing = await dynamodb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    IndexName: 'org-email-index',
    KeyConditionExpression: 'org_id = :org_id AND email = :email',
    ExpressionAttributeValues: { ':org_id': org_id, ':email': email },
    Limit: 1,
  }));
  if (existing.Items && existing.Items.length) return existing.Items[0];

  const member = {
    member_id: `cm-${uuidv4()}`,
    org_id,
    email,
    display_name: null,
    verified_at: Date.now(),
    created_at: Date.now(),
  };
  await dynamodb.send(new PutCommand({ TableName: MEMBERS_TABLE, Item: member }));
  return member;
}

async function getMember(member_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: MEMBERS_TABLE, Key: { member_id } }));
  return result.Item || null;
}

/**
 * Sets a member's display name -- collected once on the Sign-Up Sheets
 * devotee page (server/routes/signups.js needs a real name for the
 * volunteer/potluck roster; photo sharing never needed one, so this was
 * never collected before). 1-60 chars, trimmed; rejects blank.
 */
async function updateMemberDisplayName(member_id, display_name) {
  const name = (display_name || '').toString().trim().slice(0, 60);
  if (!name) throw new Error('Enter a name.');
  await dynamodb.send(new UpdateCommand({
    TableName: MEMBERS_TABLE,
    Key: { member_id },
    UpdateExpression: 'SET display_name = :name',
    ExpressionAttributeValues: { ':name': name },
  }));
  return name;
}

/**
 * Follow / unfollow -- "following"/"followed_at" live directly on the
 * community_members row (not a separate join table) because a phone
 * number already gets a distinct member_id per org (getOrCreateMember
 * above), so the relationship is inherently 1:1 with member_id already.
 * No public follower count anywhere -- see routes/community.js.
 */
async function followOrg(member_id) {
  await dynamodb.send(new UpdateCommand({
    TableName: MEMBERS_TABLE,
    Key: { member_id },
    UpdateExpression: 'SET following = :t, followed_at = :now',
    ExpressionAttributeValues: { ':t': true, ':now': Date.now() },
  }));
  return true;
}

async function unfollowOrg(member_id) {
  await dynamodb.send(new UpdateCommand({
    TableName: MEMBERS_TABLE,
    Key: { member_id },
    UpdateExpression: 'REMOVE following, followed_at',
  }));
  return true;
}

/**
 * Every follower of an org -- org-phone-index queried on just its hash key
 * (org_id), filtered to following = true. Same shape as photos.js's admin
 * queue queries and signups.js's listActiveEntriesForOrg. Used for the
 * admin follower count and, later, for fanning out the weekly digest.
 */
async function listFollowersForOrg(org_id, { limit = 2000 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    IndexName: 'org-phone-index',
    KeyConditionExpression: 'org_id = :org_id',
    FilterExpression: 'following = :t',
    ExpressionAttributeValues: { ':org_id': org_id, ':t': true },
    Limit: limit,
  }));
  return result.Items || [];
}

async function countFollowersForOrg(org_id) {
  return (await listFollowersForOrg(org_id)).length;
}

function issueCommunityToken(member) {
  return jwt.sign(
    { member_id: member.member_id, org_id: member.org_id, email: member.email, role: 'community' },
    COMMUNITY_JWT_SECRET,
    { expiresIn: COMMUNITY_TOKEN_EXPIRY }
  );
}

/** Express middleware — verifies a community token, sets req.communityUser. */
function authenticateCommunityToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Verify your email first.' });

  jwt.verify(token, COMMUNITY_JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== 'community') {
      return res.status(403).json({ error: 'Your session expired — verify your email again.' });
    }
    req.communityUser = decoded;
    next();
  });
}

/**
 * Same as authenticateCommunityToken, but never rejects the request --
 * a missing or invalid token just leaves req.communityUser unset instead
 * of a 401/403. For public routes (see routes/publicMedia.js) that show
 * MORE to a verified community member (verified_attendees/members_only
 * visibility) but still work for a fully anonymous visitor otherwise --
 * the same "public event page open to anyone" shape as routes/events.js's
 * own optionalAuth for req.user.
 */
function optionalCommunityAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, COMMUNITY_JWT_SECRET, (err, decoded) => {
    if (!err && decoded && decoded.role === 'community') {
      req.communityUser = decoded;
    }
    next();
  });
}

module.exports = {
  sendOtp,
  verifyOtp,
  getOrCreateMember,
  getMember,
  updateMemberDisplayName,
  followOrg,
  unfollowOrg,
  listFollowersForOrg,
  optionalCommunityAuth,
  countFollowersForOrg,
  issueCommunityToken,
  authenticateCommunityToken,
  normalizeEmail,
};
