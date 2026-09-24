/**
 * server/identity-auth.js — the cross-org "Community Passport" identity
 * (Phase 1 of the Community Radar personalization plan -- see
 * routes/identity.js for the HTTP layer this wraps).
 *
 * Deliberately separate from community-auth.js's per-org community
 * members: a community_members row is scoped to (org_id, email) and is
 * what Follow/RSVP-adjacent features on a single org's own page use. An
 * "identity" row here is scoped to email ALONE, globally -- it's what the
 * cross-org Radar passport (greeting, interests, "orgs you follow" list)
 * needs and community_members structurally can't give it.
 *
 * "Which orgs does this identity follow" is intentionally NOT stored here
 * -- see listFollowedOrgsForEmail below, which reads community_members'
 * email-index instead. That keeps exactly one follow relationship in the
 * system: a follow made from an org's own page (community-auth.js) and a
 * follow made from the Radar passport (followOrgAsIdentity below) are the
 * same row, just two entry points into the same storage.
 *
 * No password, ever -- same email + 6-digit code pattern as
 * community-auth.js, reusing its OTP table, mailer and JWT secret (a
 * different `role` claim, 'identity' vs 'community', keeps the two token
 * kinds from being interchangeable -- see issueIdentityToken below).
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { COMMUNITY_JWT_SECRET } = require('./utils/communityJwtSecret');
const { normalizeEmail, getOrCreateMember: getOrCreateOrgMember, followOrg, unfollowOrg } = require('./community-auth');
const { getOrganization } = require('./organizations');

const client = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const IDENTITIES_TABLE = 'calendarfly_identities';
const MEMBERS_TABLE = 'calendarfly_community_members';
const OTP_TABLE = 'calendarfly_otp_codes';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const IDENTITY_TOKEN_EXPIRY = '90d';

// Fixed taxonomy for Phase 1 -- a short curated list beats an open text
// field or a dynamically-mined one: there's no interaction history yet to
// mine, and a handful of clear chips is what the passport's onboarding
// mockup showed. Revisit once there's usage data to justify expanding it.
const INTEREST_OPTIONS = [
  'music', 'dance', 'yoga', 'kids-family', 'food', 'volunteering',
  'spiritual', 'youth', 'seniors', 'arts-culture', 'sports', 'language',
];

function otpKey(email) {
  return `identity#${email}`;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Generates and emails a 6-digit code for this email (no org involved). */
async function sendIdentityOtp(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('Enter a valid email address.');

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  await dynamodb.send(new PutCommand({
    TableName: OTP_TABLE,
    Item: {
      otp_key: otpKey(email),
      code_hash: hashCode(code),
      expires_at: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    },
  }));

  const { sendEmail } = require('./utils/mailer');
  await sendEmail({
    to: email,
    subject: `${code} is your CalendarFly code`,
    text: `${code} is your CalendarFly verification code. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p><strong>${code}</strong> is your CalendarFly verification code.</p><p>It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`,
  });

  return { email };
}

async function verifyIdentityOtp(rawEmail, submittedCode) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error('Enter a valid email address.');

  const key = otpKey(email);
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
  return getOrCreateIdentity(email);
}

async function getOrCreateIdentity(email) {
  const existing = await dynamodb.send(new QueryCommand({
    TableName: IDENTITIES_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email },
    Limit: 1,
  }));
  if (existing.Items && existing.Items.length) return existing.Items[0];

  const identity = {
    identity_id: `id-${uuidv4()}`,
    email,
    display_name: null,
    interests: [],
    created_at: Date.now(),
    last_seen_at: Date.now(),
  };
  await dynamodb.send(new PutCommand({ TableName: IDENTITIES_TABLE, Item: identity }));
  return identity;
}

async function getIdentity(identity_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: IDENTITIES_TABLE, Key: { identity_id } }));
  return result.Item || null;
}

/**
 * Sets display name and/or interests. interests is filtered against
 * INTEREST_OPTIONS rather than trusted as-is -- same reasoning as
 * events.js's normalizeDiscoverability, a client sending an unknown value
 * shouldn't get to store it.
 */
async function updateIdentityProfile(identity_id, { display_name, interests } = {}) {
  const sets = [];
  const values = {};
  const names = {};

  if (display_name !== undefined) {
    const name = (display_name || '').toString().trim().slice(0, 60);
    sets.push('display_name = :name');
    values[':name'] = name || null;
  }
  if (interests !== undefined) {
    const clean = Array.isArray(interests)
      ? [...new Set(interests.filter((i) => INTEREST_OPTIONS.includes(i)))]
      : [];
    sets.push('#interests = :interests');
    names['#interests'] = 'interests';
    values[':interests'] = clean;
  }

  if (!sets.length) return getIdentity(identity_id);

  const result = await dynamodb.send(new UpdateCommand({
    TableName: IDENTITIES_TABLE,
    Key: { identity_id },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

/**
 * Every org this email has a following=true community_members row for,
 * across all orgs -- the reverse direction from community-auth.js's own
 * getOrCreateMember (org_id + email -> member). Joins each with its org's
 * public-safe fields, same shape/reasoning as routes/radar.js's own org
 * join (skip -- don't crash the whole passport -- if an org fails to
 * resolve).
 */
async function listFollowedOrgsForEmail(email) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: MEMBERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    FilterExpression: 'following = :t',
    ExpressionAttributeValues: { ':email': email, ':t': true },
  }));
  const rows = result.Items || [];

  const orgs = [];
  for (const row of rows) {
    try {
      const org = await getOrganization(row.org_id);
      if (!org) continue;
      orgs.push({
        org_id: org.org_id,
        name: org.name,
        subdomain: org.subdomain,
        category: org.category,
        logo_url: org.logo_url || null,
        primary_color: org.primary_color || null,
      });
    } catch (err) {
      console.error('[IDENTITY] Failed to resolve followed org', row.org_id, err.message);
    }
  }
  return orgs;
}

/** Follow/unfollow an org as this identity -- reuses community-auth.js's
 * existing per-org member row and followOrg/unfollowOrg exactly as a
 * verification on that org's own page would, just triggered from the
 * Radar passport instead. */
async function followOrgAsIdentity(org_id, email) {
  const member = await getOrCreateOrgMember(org_id, email);
  await followOrg(member.member_id);
  return true;
}

async function unfollowOrgAsIdentity(org_id, email) {
  const member = await getOrCreateOrgMember(org_id, email);
  await unfollowOrg(member.member_id);
  return true;
}

function issueIdentityToken(identity) {
  return jwt.sign(
    { identity_id: identity.identity_id, email: identity.email, role: 'identity' },
    COMMUNITY_JWT_SECRET,
    { expiresIn: IDENTITY_TOKEN_EXPIRY }
  );
}

/** Express middleware — verifies an identity token, sets req.identityUser. */
function authenticateIdentityToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Verify your email first.' });

  jwt.verify(token, COMMUNITY_JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== 'identity') {
      return res.status(403).json({ error: 'Your session expired — verify your email again.' });
    }
    req.identityUser = decoded;
    next();
  });
}

module.exports = {
  INTEREST_OPTIONS,
  sendIdentityOtp,
  verifyIdentityOtp,
  getIdentity,
  updateIdentityProfile,
  listFollowedOrgsForEmail,
  followOrgAsIdentity,
  unfollowOrgAsIdentity,
  issueIdentityToken,
  authenticateIdentityToken,
};
