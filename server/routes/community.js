/**
 * server/routes/community.js — phone verification for devotees (see
 * community-auth.js for the actual OTP/token logic this wraps).
 *
 * Both routes below are public/unauthenticated on purpose — a devotee
 * hasn't proven who they are yet, that's the point of this flow. They rely
 * on req.org (tenantMiddleware, resolved from the subdomain the request
 * came in on), the same pattern routes/rsvp.js already uses for its own
 * public, no-login POST /rsvp.
 */

const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const {
  sendOtp, verifyOtp, issueCommunityToken, authenticateCommunityToken, getMember, updateMemberDisplayName,
  followOrg, unfollowOrg, countFollowersForOrg,
} = require('../community-auth');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Each SMS costs real money and a phone number is exactly the kind of thing
// worth throttling per-value, not just per-IP — same reasoning and pattern
// as routes/auth.js's loginLimiter (keyed by the submitted identifier, IP
// as the fallback for a request with no phone in the body yet).
const requestCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.phone ? String(req.body.phone).trim() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many codes requested for this number — please wait an hour and try again.' },
});

router.post('/request-code', requestCodeLimiter, async (req, res) => {
  try {
    if (!req.org) return res.status(404).json({ error: 'Organization not found' });
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Enter a phone number.' });

    await sendOtp(req.org, phone);
    res.json({ success: true });
  } catch (err) {
    console.error('[COMMUNITY] Failed to send code:', err.message);
    // Deliberate user-facing validation text from community-auth.js (e.g.
    // "That code expired — request a new one.") — shown as-is, unlike
    // utils/errors.js's sendServerError: this isn't an internal-error leak,
    // the devotee needs to read it, in every environment.
    res.status(400).json({ error: err.message });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    if (!req.org) return res.status(404).json({ error: 'Organization not found' });
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Enter the phone number and code.' });

    const member = await verifyOtp(req.org.org_id, phone, code);
    const token = issueCommunityToken(member);
    res.json({ success: true, token, member: { member_id: member.member_id, phone: member.phone } });
  } catch (err) {
    console.error('[COMMUNITY] Verification failed:', err.message);
    // Same reasoning as /request-code above — deliberate user-facing text.
    res.status(400).json({ error: err.message });
  }
});

// GET /api/community/me -- the verified devotee's own profile (currently
// just display_name). Used by the Sign-Up Sheets devotee page to check
// whether a name still needs to be collected before joining a slot.
router.get('/me', authenticateCommunityToken, async (req, res) => {
  try {
    const member = await getMember(req.communityUser.member_id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    res.json({
      member_id: member.member_id,
      phone: member.phone,
      display_name: member.display_name || null,
      following: !!member.following,
    });
  } catch (err) {
    console.error('[COMMUNITY] Failed to load member:', err.message);
    res.status(500).json({ error: 'Could not load your profile.' });
  }
});

// POST /api/community/follow -- no public count, no feed of other people's
// activity (see connect-follow-design mockup) -- just: get one weekly
// digest, plus first access to new sign-up sheets before everyone else
// (see routes/signups.js's early-access gating).
router.post('/follow', authenticateCommunityToken, async (req, res) => {
  try {
    await followOrg(req.communityUser.member_id);
    res.json({ success: true, following: true });
  } catch (err) {
    console.error('[COMMUNITY] Failed to follow:', err.message);
    res.status(500).json({ error: 'Could not follow right now -- try again.' });
  }
});

router.post('/unfollow', authenticateCommunityToken, async (req, res) => {
  try {
    await unfollowOrg(req.communityUser.member_id);
    res.json({ success: true, following: false });
  } catch (err) {
    console.error('[COMMUNITY] Failed to unfollow:', err.message);
    res.status(500).json({ error: 'Could not unfollow right now -- try again.' });
  }
});

// GET /api/community/followers -- admin-only. Just the count, deliberately
// -- no phone numbers or names go back to the dashboard, matching the "no
// public follower count" promise devotees see (private from other
// devotees, but also never surfaced as a name list to admins).
router.get('/followers', authenticateToken, async (req, res) => {
  try {
    const count = await countFollowersForOrg(req.user.org_id);
    res.json({ count });
  } catch (err) {
    console.error('[COMMUNITY] Failed to count followers:', err.message);
    res.status(500).json({ error: 'Could not load follower count.' });
  }
});

// PATCH /api/community/me -- set the devotee's display name, once, before
// their first Sign-Up Sheets join (routes/signups.js requires a name on
// every entry it creates).
router.patch('/me', authenticateCommunityToken, async (req, res) => {
  try {
    const name = await updateMemberDisplayName(req.communityUser.member_id, req.body && req.body.display_name);
    res.json({ success: true, display_name: name });
  } catch (err) {
    // Same reasoning as /request-code above — deliberate user-facing text
    // (e.g. "Enter a name.").
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
