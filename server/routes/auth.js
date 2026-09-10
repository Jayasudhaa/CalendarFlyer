const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { requireRole } = require('../middleware/roles');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-2'
});

// Neither /login nor /signup had any rate limiting — /login is a
// straightforward password-brute-force target, and /signup now sends a
// real email to whatever address is submitted, which without a limit is
// an open invitation to spam an arbitrary inbox with "verify your
// account" emails (and to burn through SES sending limits doing it).
// Keyed by email rather than just IP so a distributed attempt against one
// account/address still gets throttled.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many login attempts — please wait a few minutes and try again.' },
});
// Google sign-in verifies a token instead of checking a password, so it
// isn't a brute-force target the same way /login is — but it's still an
// unauthenticated endpoint that does real work (DB writes for new
// accounts), so it gets its own generous per-IP limit rather than none.
const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts — please wait a few minutes and try again.' },
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many signup attempts — please wait a while and try again.' },
});
// POST /guest-sandbox (below) takes no email/password at all — one click,
// no form — so this can only be keyed by IP. Generous enough for a real
// visitor clicking "Try it free" a couple of times, tight enough that it
// can't be used to mint unlimited throwaway orgs (each one is a real
// DynamoDB write, and pro-tier limits/features until it expires).
const guestSandboxLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sandbox sessions started from this connection — please wait a while and try again.' },
});

// Every place that signs or verifies a JWT in this app must use the exact
// same secret, or tokens minted by one will silently fail verification by
// another. Centralized here (and re-exported) instead of each file having
// its own process.env.JWT_SECRET fallback — those had drifted to different
// literal strings in different files, which is harmless only as long as
// JWT_SECRET is always set in .env (it is, today) but is a footgun waiting
// for the day someone runs this without it.
const { JWT_SECRET } = require('../utils/jwtSecret');

// Google Sign-In (see POST /google below). Verifying the ID token needs
// only the OAuth client ID (it's the token's expected "audience") — no
// client secret required, since we're checking a token Google already
// signed, not performing a server-side OAuth code exchange.
// VITE_GOOGLE_CLIENT_ID is what's currently in .env (the frontend's
// build-time var name); GOOGLE_CLIENT_ID is the proper backend name —
// reading either means this works without touching .env, and a real
// GOOGLE_CLIENT_ID can be added later without changing this code.
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (!GOOGLE_CLIENT_ID) {
  console.warn('[AUTH] GOOGLE_CLIENT_ID not set — POST /api/auth/google will return 500 until it is.');
}

// Reservations table — see dynamodb-schema.js for why this exists and
// createReservation()/releaseReservation() below for how it's used.
const RESERVATIONS_TABLE = 'calendarfly_reservations';

// Atomically claims a unique key (e.g. "subdomain#foo" or "email#a@b.com")
// so two concurrent signups can never both succeed for the same subdomain
// or email — a plain "query, then check, then write" has a window where
// both requests pass the check before either has written. Returns true if
// this call won the reservation, false if it was already taken.
async function createReservation(key) {
  try {
    await dynamodb.put({
      TableName: RESERVATIONS_TABLE,
      Item: { reservation_key: key, reserved_at: Date.now() },
      ConditionExpression: 'attribute_not_exists(reservation_key)',
    }).promise();
    return true;
  } catch (e) {
    if (e.code === 'ConditionalCheckFailedException') return false;
    throw e;
  }
}

// Best-effort rollback if org/user creation fails after a reservation
// succeeded — without this, a failed signup would permanently burn that
// subdomain/email even though no org was actually created.
async function releaseReservation(key) {
  try {
    await dynamodb.delete({ TableName: RESERVATIONS_TABLE, Key: { reservation_key: key } }).promise();
  } catch (e) {
    console.error(`[AUTH] Failed to release reservation ${key}:`, e.message);
  }
}

// Turns a Google display name / email local-part into a subdomain-safe
// slug (lowercase letters and digits only, same rule /signup applies to
// the user-typed subdomain). Falls back to 'workspace' if that leaves
// nothing usable (e.g. a name that's entirely emoji/CJK/etc.).
function slugify(base) {
  return String(base || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

// Google sign-in creates an organization without ever asking for a
// subdomain (unlike /signup's form), so one is generated instead: try the
// slugified name first, then the same slug with a random 4-digit suffix,
// reserving each candidate the same race-safe way /signup reserves a
// user-typed one. A handful of attempts is enough — collisions on a fresh
// random 4-digit suffix are rare enough not to worry about looping longer.
async function reserveUniqueSubdomain(base) {
  const cleanBase = slugify(base) || 'workspace';
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? cleanBase : `${cleanBase}${Math.floor(1000 + Math.random() * 9000)}`;
    const key = `subdomain#${candidate}`;
    if (await createReservation(key)) {
      return { subdomain: candidate, reservationKey: key };
    }
  }
  throw new Error('Could not allocate a workspace URL — please try again.');
}

// ── Email verification ──────────────────────────────────────────────────
// Signup used to hand back a login token immediately, with no check that
// the email address was even real — anyone could register with a typo'd
// or someone-else's address and get a working account. Now signup creates
// the account as unverified and emails a link; login refuses unverified
// accounts until that link is clicked.
//
// The verify link's token is a short-lived JWT (purpose: 'verify-email',
// signed with the same JWT_SECRET as login tokens) rather than a random
// value stored in the database — that avoids needing a new table/index
// just to look a token back up, at the cost of not being revocable before
// it expires. 48h is enough time for someone to get to their inbox without
// leaving a stale token usable for long. Verifying is idempotent: clicking
// an already-used link just reports "already verified" instead of erroring.
const EMAIL_VERIFY_EXPIRES_IN = '48h';

function makeEmailVerifyToken(user_id) {
  return jwt.sign({ user_id, purpose: 'verify-email' }, JWT_SECRET, { expiresIn: EMAIL_VERIFY_EXPIRES_IN });
}

// Best-effort — a failed send shouldn't necessarily fail the whole signup
// (the account still exists and can request a resend), so callers decide
// how to surface a failure here rather than this function throwing past them.
async function sendVerificationEmail(user, orgName) {
  const { sendEmail } = require('../utils/mailer');
  const token = makeEmailVerifyToken(user.user_id);
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: `Verify your email for ${orgName || 'CalendarFly'}`,
    text:
      `Welcome to CalendarFly!\n\n` +
      `Click the link below to verify your email and activate your account:\n${link}\n\n` +
      `This link expires in 48 hours. If you didn't sign up for CalendarFly, you can ignore this email.`,
    html:
      `<p>Welcome to CalendarFly!</p>` +
      `<p><a href="${link}">Click here to verify your email</a> and activate your account.</p>` +
      `<p>This link expires in 48 hours. If you didn't sign up for CalendarFly, you can ignore this email.</p>`,
  });
}

// 5 resend attempts per email per 15 minutes — generous for a real user
// who lost the email or fat-fingered a click, tight enough that it can't
// be used to spam an inbox or hammer SES.
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many verification emails requested — please wait a few minutes and try again.' },
});

// ── Forgot / reset password ─────────────────────────────────────────────
// Same shape as email verification (see EMAIL_VERIFY_EXPIRES_IN above): a
// short-lived signed JWT emailed as a link, no separate token table. The
// crypto (mint + verify + single-use trick) lives entirely in
// utils/resetToken.js so it can be unit tested without Express/DynamoDB —
// these routes just do the DB lookup/update and email around it.
const { createResetToken, verifyResetToken } = require('../utils/resetToken');

// Keyed by email, same rate as resend-verification — this endpoint sends a
// real email per request, so it needs the same protection against being
// used to spam an arbitrary inbox or burn through SES sending limits.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many password reset requests — please wait a few minutes and try again.' },
});
// The submission endpoint has no email in its body (just a token + new
// password), so it's keyed by IP instead. A bit more generous than the
// request endpoint since a legitimate user can plausibly mistype their new
// password and need a couple of retries with the same valid token.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts — please wait a few minutes and try again.' },
});

async function sendPasswordResetEmail(user) {
  const { sendEmail } = require('../utils/mailer');
  const token = createResetToken(user);
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your CalendarFly password',
    text:
      `We received a request to reset your CalendarFly password.\n\n` +
      `Click the link below to choose a new password:\n${link}\n\n` +
      `This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password won't be changed.`,
    html:
      `<p>We received a request to reset your CalendarFly password.</p>` +
      `<p><a href="${link}">Click here to choose a new password</a>.</p>` +
      `<p>This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>`,
  });
}

// Always responds with the same generic message regardless of whether the
// account exists — same anti-enumeration pattern as /resend-verification.
// Never lets a send failure change the response either; the failure is
// only logged server-side.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { success: true, message: "If an account exists for that email, we've sent a password reset link." };
  if (!email) return res.json(generic);

  try {
    const result = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': String(email).trim().toLowerCase() }
    }).promise();
    const user = result.Items && result.Items[0];
    if (user) {
      try {
        await sendPasswordResetEmail(user);
      } catch (sendError) {
        console.error('[AUTH] Password reset email send failed:', sendError.message);
      }
    }
  } catch (error) {
    console.error('[AUTH] Forgot-password error:', error);
    // Still return the generic success message — don't leak internal
    // errors, and don't give a way to distinguish failure modes.
  }
  res.json(generic);
});

router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  const genericInvalid = { error: 'This reset link is invalid or has expired. Please request a new one.' };

  if (!token) return res.status(400).json(genericInvalid);
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // The token's fingerprint can only be checked against the user's
    // CURRENT password_hash, so user_id has to come from the token itself
    // before we know who to look up. This is an UNVERIFIED decode (no
    // signature/expiry check) purely to read the claim — actual
    // verification (signature, expiry, purpose, and the single-use
    // fingerprint) happens entirely inside verifyResetToken() below, which
    // is what a tampered/expired/reused token actually gets rejected by.
    const unverifiedUserId = jwt.decode(token)?.user_id;
    if (!unverifiedUserId) return res.status(400).json(genericInvalid);

    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: unverifiedUserId }
    }).promise();
    if (!result.Item) return res.status(400).json(genericInvalid);
    const user = result.Item;

    const verification = verifyResetToken(token, user.password_hash);
    if (!verification.valid) {
      console.warn(`[AUTH] Reset token rejected for ${user.user_id}: ${verification.reason}`);
      return res.status(400).json(genericInvalid);
    }

    const newHash = await bcrypt.hash(password, 10);
    await dynamodb.update({
      TableName: 'calendarfly_users',
      Key: { user_id: user.user_id },
      UpdateExpression: 'SET password_hash = :h, updated_at = :u',
      ExpressionAttributeValues: { ':h': newHash, ':u': new Date().toISOString() }
    }).promise();

    res.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Reset-password error:', error);
    res.status(400).json(genericInvalid);
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};
const requireNonGuest = (req, res, next) => {
  if (req.user && req.user.role === 'guest') {
    return res.status(403).json({
      error: 'This action is not available for this account',
    });
  }
  next();
};
// Invites a new team member into the caller's own org, as either 'admin' or
// 'viewer' — never 'owner' (an org only ever gets an Owner at signup, or via
// a future transfer-ownership action). This used to always create a
// 'guest' account; 'guest' still works as the DB value for any pre-existing
// row (see server/middleware/roles.js — it's treated identically to
// 'viewer'), but nothing new is minted with it going forward.
router.post('/create-guest', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const { password, displayName } = req.body;
  // Lowercased for the same reason as POST /signup — this record has to
  // match the login route's lowercased lookup, or the invited teammate
  // can't sign in with the email exactly as this admin typed it.
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role === 'admin' ? 'admin' : 'viewer';
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { getOrganization, checkUserLimit } = require('../organizations');
    const org = await getOrganization(req.user.org_id);
    if (org && !(await checkUserLimit(req.user.org_id, org))) {
      return res.status(429).json({
        error: `You've reached your plan's team member limit (${org.limits.users}). Upgrade to add more.`,
        upgrade_url: '/pricing',
      });
    }
    const existingUser = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();
    if (existingUser.Items && existingUser.Items.length > 0) {
      return res.status(400).json({ error: 'A user with that email already exists' });
    }
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const newUserId = `user-${uuidv4()}`;
    const newUser = {
      user_id: newUserId,
      org_id: req.user.org_id,       // same org as whoever invited them
      email,
      password_hash: passwordHash,
      display_name: displayName || (role === 'admin' ? 'Admin' : 'Viewer'),
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await dynamodb.put({
      TableName: 'calendarfly_users',
      Item: newUser
    }).promise();
    res.json({
      success: true,
      member: {
        email,
        displayName: newUser.display_name,
        role,
        org_id: req.user.org_id
      }
    });
  } catch (error) {
    console.error('Create team member error:', error);
    res.status(500).json({ error: 'Failed to create team member credentials' });
  }
});
// Self-serve guest sandbox: one click, no form, no email — creates a
// brand-new isolated org + owner account and hands back a working session
// immediately. Distinct from /create-guest above (which invites a teammate
// into an EXISTING org) and from the hardcoded-shared-account idea this
// replaced: nothing here is a fixed credential anyone could reuse or share.
// Expiry is entirely the signed JWT's own `expiresIn` claim — the same
// mechanism every other token in this file uses (see EMAIL_VERIFY_EXPIRES_IN
// above) — so authenticateToken's jwt.verify() rejects it on its own once
// SANDBOX_DURATION_MS has passed; sandbox_expires_at stored on the org
// (organizations.js) is only there so server/scheduler.js's sweep can
// actually delete the org afterward, not what enforces the expiry itself.
const SANDBOX_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours
const SANDBOX_CATEGORIES = ['temple', 'nonprofit', 'community', 'other'];

router.post('/guest-sandbox', guestSandboxLimiter, async (req, res) => {
  try {
    const category = SANDBOX_CATEGORIES.includes(req.body && req.body.category) ? req.body.category : 'temple';
    const subdomain = `sandbox-${uuidv4().slice(0, 8)}`;
    const sandbox_expires_at = Date.now() + SANDBOX_DURATION_MS;

    // 'pro' rather than 'free' — a guest kicking the tires should see what
    // the product can actually do (flyer editor, chatbot, analytics, no
    // event-count ceiling) rather than bumping into Free-plan walls during
    // a 48h trial. trial_ends_at is set to line up with the sandbox's own
    // expiry so settleTrial()'s existing downgrade-with-no-card logic is a
    // harmless no-op here — the sandbox is deleted outright before that
    // would ever matter (see scheduler.js).
    const { createOrganization } = require('../organizations');
    const organization = await createOrganization({
      name: 'Guest Sandbox',
      subdomain,
      category,
      plan: 'pro',
      trial_ends_at: sandbox_expires_at,
      is_sandbox: true,
      sandbox_expires_at,
    });

    const userId = `user-${uuidv4()}`;
    // A real (never shown, never emailed) password hash, same reasoning as
    // /google's randomly-generated one — this account only ever signs in
    // via the token this endpoint returns, never through the /login form,
    // but bcrypt.compare() still needs a valid hash to compare against if
    // this address is ever typed into that form.
    const randomPassword = require('crypto').randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const sandboxEmail = `${subdomain}@sandbox.calendarflyapp.com`;
    const user = {
      user_id: userId,
      org_id: organization.org_id,
      email: sandboxEmail,
      password_hash: passwordHash,
      display_name: 'Guest',
      role: 'owner',
      email_verified: true,
      is_sandbox: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: 'calendarfly_users', Item: user }).promise();

    // Same as /signup and /google — this account is its org's Owner from
    // the start. Onboarding is marked done (not false) since a guest
    // clicking "Try it free" should land straight in a populated dashboard,
    // not be walked through the setup wizard for an org that expires in 48h.
    await dynamodb.update({
      TableName: 'calendarfly_organizations',
      Key: { org_id: organization.org_id },
      UpdateExpression: 'SET onboarding_completed = :t, owner_user_id = :o',
      ExpressionAttributeValues: { ':t': true, ':o': userId },
    }).promise();
    organization.onboarding_completed = true;
    organization.owner_user_id = userId;

    const token = jwt.sign(
      { user_id: userId, org_id: organization.org_id, email: sandboxEmail, role: 'owner', sandbox: true },
      JWT_SECRET,
      { expiresIn: '48h' }
    );

    const { redactSocialAccounts } = require('../organizations');
    res.json({
      success: true,
      token,
      category,
      sandbox_expires_at,
      user: { user_id: userId, email: sandboxEmail, displayName: user.display_name, role: 'owner' },
      organization: {
        org_id: organization.org_id,
        name: organization.name,
        subdomain: organization.subdomain,
        category: organization.category,
        primary_color: organization.primary_color,
        secondary_color: organization.secondary_color,
        onboarding_completed: true,
        is_sandbox: true,
        sandbox_expires_at,
        social_accounts: redactSocialAccounts(organization),
      },
    });
  } catch (error) {
    console.error('[AUTH] Guest sandbox creation error:', error);
    res.status(500).json({ error: 'Could not start a sandbox session — please try again.' });
  }
});

router.post('/signup', signupLimiter, async (req, res) => {
  const { email, password, name, subdomain, displayName } = req.body;
  // Reservations actually claimed this request, so a failure partway
  // through can release only those (not ones we never got, and not ones
  // someone else holds).
  const claimed = [];
  try {
    if (!email || !password || !name || !subdomain) {
      return res.status(400).json({ error: 'name, subdomain, email, and password are required' });
    }
    // Basic shape check before an SES send is even attempted — catches the
    // obviously-fake "asdf" or "a@b" typos immediately with a clear error
    // instead of silently creating an account that can never receive its
    // verification email. Not a substitute for the verification link
    // itself (which is what actually proves the address is real/owned).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanSubdomain) {
      return res.status(400).json({ error: 'Workspace URL must contain letters or numbers' });
    }
    // Lowercased so the stored record matches how every lookup (login,
    // forgot-password, resend-verification) queries by email — storing the
    // as-typed case here while querying lowercased elsewhere meant an
    // account signed up as "Jane.Doe@..." could never log in as
    // "jane.doe@..." (or vice versa), silently failing with the generic
    // "Invalid credentials" and no console error.
    const cleanEmail = email.trim().toLowerCase();
    const subdomainKey = `subdomain#${cleanSubdomain}`;
    const emailKey = `email#${cleanEmail}`;

    // Atomically claim both the subdomain and the email before creating
    // anything. This replaces a "query for an existing match, then write"
    // check — that had a race window where two concurrent signups for the
    // same subdomain could both pass the check and both succeed, leaving
    // two orgs sharing one subdomain (tenant lookup then arbitrarily picks
    // one of them). A conditional put can only ever succeed once per key,
    // so only one of two racing requests wins here.
    if (!(await createReservation(subdomainKey))) {
      return res.status(400).json({ error: 'That workspace URL is already taken — try a different one' });
    }
    claimed.push(subdomainKey);

    if (!(await createReservation(emailKey))) {
      return res.status(400).json({ error: 'User already exists' });
    }
    claimed.push(emailKey);

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const userId = `user-${uuidv4()}`;

    // Delegate org creation to organizations.js's createOrganization() —
    // the same function the /api/organizations/signup path uses — instead
    // of building a bare-bones org object inline here. That inline version
    // was missing trial_ends_at/features/limits/billing entirely, which
    // silently broke plan-limit enforcement and the Stripe trial flow for
    // every org created through this signup path.
    const { createOrganization } = require('../organizations');
    const organization = await createOrganization({
      name,
      subdomain: cleanSubdomain,
      category: req.body.category || null,
      plan: req.body.plan || 'free',
    });
    // createOrganization() doesn't know about onboarding_completed or
    // owner_user_id — set both here so new signups still go through the
    // wizard as before, and so this account (the org's creator) is on
    // record as its Owner from the start (see server/middleware/roles.js
    // and organizations.js's ensureOwnerAssigned for why that matters).
    await dynamodb.update({
      TableName: 'calendarfly_organizations',
      Key: { org_id: organization.org_id },
      UpdateExpression: 'SET onboarding_completed = :f, owner_user_id = :o',
      ExpressionAttributeValues: { ':f': false, ':o': userId },
    }).promise();
    organization.onboarding_completed = false;
    organization.owner_user_id = userId;

    const user = {
      user_id: userId,
      org_id: organization.org_id,
      email: cleanEmail,
      password_hash: passwordHash,
      display_name: displayName || name,
      role: 'owner',
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await dynamodb.put({
      TableName: 'calendarfly_users',
      Item: user
    }).promise();

    // No login token here — the account exists but can't sign in until the
    // email link is clicked (see login handler below). A send failure
    // still leaves a real, resendable account, so it's reported back to
    // the client rather than failing the whole signup.
    let emailSendFailed = false;
    try {
      await sendVerificationEmail(user, organization.name);
    } catch (sendError) {
      console.error('[AUTH] Failed to send verification email:', sendError.message);
      emailSendFailed = true;
    }

    res.json({
      success: true,
      needsVerification: true,
      emailSendFailed,
      email: cleanEmail,
      message: emailSendFailed
        ? 'Account created, but we could not send the verification email. Use "Resend verification email" on the sign-in page.'
        : 'Account created — check your email to verify before signing in.',
    });
  } catch (error) {
    console.error('Signup error:', error);
    // Don't leave a claimed subdomain/email permanently unusable just
    // because org/user creation failed after we reserved it.
    await Promise.all(claimed.map(releaseReservation));
    res.status(500).json({ error: 'Signup failed' });
  }
});
router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  // Normalized the same way signup stores it — see the comment on
  // cleanEmail in POST /signup for why this has to match exactly.
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    const result = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();
    if (!result.Items || result.Items.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.Items[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Guest accounts (created by an already-logged-in admin, not via public
    // signup) and every account created before this field existed have no
    // email_verified value at all — only block the explicit `false` that
    // signup now sets, so this doesn't lock out any existing account.
    if (user.email_verified === false) {
      return res.status(403).json({
        error: 'Please verify your email before signing in — check your inbox for the verification link.',
        needsVerification: true,
        email: user.email,
      });
    }
    const orgResult = await dynamodb.get({
      TableName: 'calendarfly_organizations',
      Key: { org_id: user.org_id }
    }).promise();
    const organization = orgResult.Item;

    // Suspended by the platform owner (see POST /api/admin/organizations/
    // :org_id/suspend) — blocks new sign-ins. Doesn't revoke tokens already
    // issued (no session-revocation list in this app), so this stops new
    // access rather than cutting off an already-logged-in session instantly.
    if (organization && organization.suspended) {
      return res.status(403).json({
        error: 'This organization has been suspended. Contact support for help.',
      });
    }

    // One-time self-heal for orgs that predate the Owner/Admin/Viewer role
    // system — see organizations.js's ensureOwnerAssigned(). No-ops once
    // owner_user_id is set. Reconcile this login's in-memory `user.role` so
    // the token and response reflect it immediately, without a second read.
    if (organization) {
      const { ensureOwnerAssigned } = require('../organizations');
      await ensureOwnerAssigned(organization).catch(err =>
        console.error('[AUTH] ensureOwnerAssigned failed:', err.message)
      );
      if (organization.owner_user_id === user.user_id && user.role === 'admin') {
        user.role = 'owner';
      }
    }

    // Best-effort activity tracking for the platform stats page — a failure
    // here should never block the actual login.
    try {
      await dynamodb.update({
        TableName: 'calendarfly_users',
        Key: { user_id: user.user_id },
        UpdateExpression: 'SET last_login_at = :now',
        ExpressionAttributeValues: { ':now': Date.now() }
      }).promise();
    } catch (trackingError) {
      console.error('[AUTH] Failed to record last_login_at:', trackingError);
    }

    const token = jwt.sign(
      { user_id: user.user_id, org_id: user.org_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: (user.role === 'guest' || user.role === 'viewer') ? '2d' : '7d' }
    );
    const { redactSocialAccounts } = require('../organizations');
    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      organization: organization ? {
        org_id: organization.org_id,
        name: organization.name,
        subdomain: organization.subdomain,
        category: organization.category,
        primary_color: organization.primary_color,
        secondary_color: organization.secondary_color,
        // Orgs created before the onboarding wizard existed have no such field —
        // treat that as "already done" so existing users go straight to the
        // dashboard instead of being forced through onboarding retroactively.
        onboarding_completed: organization.onboarding_completed !== false,
        // Redacted Facebook/Instagram connection status (Organization
        // Settings → Social Media Connections) — never the raw Page token,
        // see redactSocialAccounts() in organizations.js.
        social_accounts: redactSocialAccounts(organization)
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Signs in with a Google ID token from the frontend's GoogleLogin button
// (credential = the raw JWT Google issued, verified here — never trusted
// as-is). An email that already has an account signs straight in and gets
// linked to the Google id; an email seen for the first time gets a new
// organization created on the spot (same shape /signup creates, minus the
// subdomain the signup form normally asks for — see reserveUniqueSubdomain
// above) so "sign in with Google" doubles as "create an account".
router.post('/google', googleLoginLimiter, async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ error: 'Google sign-in is not configured on this server.' });
  }
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('[AUTH] Google token verification failed:', err.message);
    return res.status(401).json({ error: 'Could not verify Google sign-in — please try again.' });
  }
  if (!payload || !payload.email) {
    return res.status(401).json({ error: 'Google did not return an email address.' });
  }
  if (payload.email_verified === false) {
    return res.status(401).json({ error: 'Your Google account email is not verified.' });
  }
  const email = payload.email.toLowerCase().trim();

  // Only ever released on a failure that happens AFTER something in here
  // was actually claimed — mirrors /signup's claimed/release pattern so a
  // failed new-account creation doesn't permanently burn the email or
  // subdomain it reserved.
  const claimed = [];

  try {
    const existing = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email }
    }).promise();

    let user;

    if (existing.Items && existing.Items.length > 0) {
      // ── Existing account: this is a sign-in ─────────────────────────
      user = existing.Items[0];

      // Google has already proven this address is real and owned by
      // whoever's signing in — that's strictly more assurance than our own
      // click-the-link verification, so an unverified password account
      // (or one from before email_verified existed) is fine to unblock
      // here rather than leaving it stuck behind a link it may never click.
      if (user.email_verified === false || !user.google_id) {
        await dynamodb.update({
          TableName: 'calendarfly_users',
          Key: { user_id: user.user_id },
          UpdateExpression: 'SET email_verified = :v, google_id = :gid, updated_at = :u',
          ExpressionAttributeValues: { ':v': true, ':gid': payload.sub, ':u': new Date().toISOString() }
        }).promise();
        user.email_verified = true;
        user.google_id = payload.sub;
      }
    } else {
      // ── No account for this email yet: create one ───────────────────
      const emailKey = `email#${email}`;
      if (!(await createReservation(emailKey))) {
        // Lost a race with a concurrent signup/Google sign-in for the same
        // address between the query above and this reservation attempt.
        return res.status(409).json({ error: 'An account for this email was just created — please try signing in again.' });
      }
      claimed.push(emailKey);

      const { subdomain, reservationKey } = await reserveUniqueSubdomain(payload.given_name || payload.name || email.split('@')[0]);
      claimed.push(reservationKey);

      const { createOrganization } = require('../organizations');
      const organization = await createOrganization({
        name: payload.name ? `${payload.name}'s Workspace` : 'My Workspace',
        subdomain,
      });
      const newUserId = `user-${uuidv4()}`;
      // Same as /signup — new orgs still go through the onboarding wizard,
      // and this account (the org's creator) is its Owner from the start.
      await dynamodb.update({
        TableName: 'calendarfly_organizations',
        Key: { org_id: organization.org_id },
        UpdateExpression: 'SET onboarding_completed = :f, owner_user_id = :o',
        ExpressionAttributeValues: { ':f': false, ':o': newUserId },
      }).promise();

      // A random, never-shown, never-emailed password. This account only
      // ever signs in via Google — password_hash exists purely so /login's
      // bcrypt.compare() has something valid to compare against if this
      // email is ever typed into the password form (it will just fail,
      // rather than bcrypt throwing on a missing hash).
      const randomPassword = require('crypto').randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = {
        user_id: newUserId,
        org_id: organization.org_id,
        email,
        password_hash: passwordHash,
        display_name: payload.name || email.split('@')[0],
        role: 'owner',
        email_verified: true,
        google_id: payload.sub,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await dynamodb.put({ TableName: 'calendarfly_users', Item: user }).promise();
    }

    const orgResult = await dynamodb.get({
      TableName: 'calendarfly_organizations',
      Key: { org_id: user.org_id }
    }).promise();
    const organization = orgResult.Item;

    if (organization && organization.suspended) {
      return res.status(403).json({ error: 'This organization has been suspended. Contact support for help.' });
    }

    // Same one-time self-heal as /login — see organizations.js's
    // ensureOwnerAssigned().
    if (organization) {
      const { ensureOwnerAssigned } = require('../organizations');
      await ensureOwnerAssigned(organization).catch(err =>
        console.error('[AUTH] ensureOwnerAssigned failed:', err.message)
      );
      if (organization.owner_user_id === user.user_id && user.role === 'admin') {
        user.role = 'owner';
      }
    }

    try {
      await dynamodb.update({
        TableName: 'calendarfly_users',
        Key: { user_id: user.user_id },
        UpdateExpression: 'SET last_login_at = :now',
        ExpressionAttributeValues: { ':now': Date.now() }
      }).promise();
    } catch (trackingError) {
      console.error('[AUTH] Failed to record last_login_at:', trackingError);
    }

    const token = jwt.sign(
      { user_id: user.user_id, org_id: user.org_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: (user.role === 'guest' || user.role === 'viewer') ? '2d' : '7d' }
    );
    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      organization: organization ? {
        org_id: organization.org_id,
        name: organization.name,
        subdomain: organization.subdomain,
        category: organization.category,
        primary_color: organization.primary_color,
        secondary_color: organization.secondary_color,
        onboarding_completed: organization.onboarding_completed !== false,
        social_accounts: require('../organizations').redactSocialAccounts(organization)
      } : null
    });
  } catch (error) {
    console.error('[AUTH] Google sign-in error:', error);
    await Promise.all(claimed.map(releaseReservation));
    res.status(500).json({ error: 'Google sign-in failed — please try again.' });
  }
});

// GET (not POST) because this is what the link in the verification email
// navigates to — the frontend's /verify-email page reads `token` from the
// URL and calls this itself via fetch, rather than the email link pointing
// straight at the API, so the user lands on a real page with a clear
// success/error state instead of raw JSON.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(400).json({ error: 'This verification link is invalid or has expired. Request a new one from the sign-in page.' });
  }
  if (decoded.purpose !== 'verify-email' || !decoded.user_id) {
    return res.status(400).json({ error: 'Invalid verification token' });
  }

  try {
    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: decoded.user_id }
    }).promise();
    if (!result.Item) {
      return res.status(400).json({ error: 'Account not found — it may have been deleted.' });
    }
    if (result.Item.email_verified === true) {
      // Link clicked twice (or after already verifying another way) —
      // treat as success rather than an error.
      return res.json({ success: true, alreadyVerified: true });
    }
    await dynamodb.update({
      TableName: 'calendarfly_users',
      Key: { user_id: decoded.user_id },
      UpdateExpression: 'SET email_verified = :v, email_verified_at = :t, updated_at = :u',
      ExpressionAttributeValues: { ':v': true, ':t': Date.now(), ':u': new Date().toISOString() }
    }).promise();
    res.json({ success: true, alreadyVerified: false });
  } catch (error) {
    console.error('[AUTH] Verify email error:', error);
    res.status(500).json({ error: 'Verification failed — please try again.' });
  }
});

// Re-sends the verification email. Always responds with the same generic
// message regardless of whether the address exists, is already verified,
// or the send actually happened — signup already reveals whether an email
// is registered ("User already exists"), but there's no reason for this
// endpoint to additionally reveal verification status to whoever's asking.
router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
  const { email } = req.body || {};
  const generic = { success: true, message: 'If that account exists and needs verification, a new email is on its way.' };
  if (!email) return res.json(generic);

  try {
    const result = await dynamodb.query({
      TableName: 'calendarfly_users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': String(email).trim().toLowerCase() }
    }).promise();
    const user = result.Items && result.Items[0];
    if (user && user.email_verified === false) {
      const orgResult = await dynamodb.get({
        TableName: 'calendarfly_organizations',
        Key: { org_id: user.org_id }
      }).promise();
      await sendVerificationEmail(user, orgResult.Item && orgResult.Item.name).catch(err =>
        console.error('[AUTH] Resend verification send failed:', err.message)
      );
    }
  } catch (error) {
    console.error('[AUTH] Resend verification error:', error);
    // Still return the generic success message — don't leak internal
    // errors, and don't give a way to distinguish failure modes.
  }
  res.json(generic);
});

router.post('/verify-admin', authenticateToken, async (req, res) => {
  const { password } = req.body;








  const userId = req.user.user_id;



  try {
    // Get user from database


    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: userId }
    }).promise();

    if (!result.Item) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.Item;

    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (isValid) {
      res.json({ verified: true });
    } else {
      res.status(401).json({ verified: false, error: 'Invalid password' });
    }




  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: req.user.user_id }
    }).promise();
    if (!result.Item) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.Item;
    const orgResult = await dynamodb.get({
      TableName: 'calendarfly_organizations',
      Key: { org_id: user.org_id }
    }).promise();
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      organization: orgResult.Item || null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});
// Update the logged-in user's own profile fields (currently just display name —
// email changes aren't supported here since that would need re-verification).
router.put('/profile', authenticateToken, async (req, res) => {
  const { displayName } = req.body;
  try {
    if (displayName !== undefined && !displayName.trim()) {
      return res.status(400).json({ error: 'Display name cannot be empty' });
    }
    const updates = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) updates.display_name = displayName.trim();

    const exprNames = {};
    const exprValues = {};
    const setParts = Object.keys(updates).map(key => {
      exprNames[`#${key}`] = key;
      exprValues[`:${key}`] = updates[key];
      return `#${key} = :${key}`;
    });

    await dynamodb.update({
      TableName: 'calendarfly_users',
      Key: { user_id: req.user.user_id },
      UpdateExpression: `SET ${setParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues
    }).promise();

    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: req.user.user_id }
    }).promise();
    const u = result.Item;
    res.json({
      success: true,
      user: { user_id: u.user_id, email: u.email, displayName: u.display_name, role: u.role }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change the logged-in user's own password.
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const result = await dynamodb.get({
      TableName: 'calendarfly_users',
      Key: { user_id: req.user.user_id }
    }).promise();
    if (!result.Item) return res.status(404).json({ error: 'User not found' });
    const user = result.Item;

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await dynamodb.update({
      TableName: 'calendarfly_users',
      Key: { user_id: user.user_id },
      UpdateExpression: 'SET password_hash = :h, updated_at = :u',
      ExpressionAttributeValues: { ':h': newHash, ':u': new Date().toISOString() }
    }).promise();

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireNonGuest = requireNonGuest;
