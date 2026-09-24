/**
 * server/routes/identity.js — the cross-org "Community Passport" identity
 * (see identity-auth.js for the OTP/token/follow logic this wraps).
 *
 * Deliberately NOT mounted behind tenantMiddleware -- unlike
 * routes/community.js (which requires req.org, resolved from a subdomain),
 * every route here works from the bare domain: the whole point of the
 * Radar passport is that it isn't scoped to one org's page.
 */

const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const {
  INTEREST_OPTIONS, LANGUAGE_OPTIONS, sendIdentityOtp, verifyIdentityOtp, getIdentity, updateIdentityProfile,
  listFollowedOrgsForEmail, followOrgAsIdentity, unfollowOrgAsIdentity,
  issueIdentityToken, authenticateIdentityToken,
} = require('../identity-auth');
const { CUISINE_KEYS } = require('../utils/cuisineTags');

const router = express.Router();

// Same reasoning/pattern as routes/community.js's own limiter.
const requestCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : ipKeyGenerator(req.ip)),
  message: { error: 'Too many codes requested for this email — please wait an hour and try again.' },
});

router.get('/interest-options', (req, res) => {
  res.json({ interests: INTEREST_OPTIONS, languages: LANGUAGE_OPTIONS, cuisines: CUISINE_KEYS });
});

router.post('/request-code', requestCodeLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Enter an email address.' });
    await sendIdentityOtp(email);
    res.json({ success: true });
  } catch (err) {
    console.error('[IDENTITY] Failed to send code:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Enter the email address and code.' });

    const identity = await verifyIdentityOtp(email, code);
    const token = issueIdentityToken(identity);
    res.json({
      success: true,
      token,
      identity: {
        identity_id: identity.identity_id,
        email: identity.email,
        display_name: identity.display_name || null,
        interests: identity.interests || [],
        languages: identity.languages || [],
        cuisines: identity.cuisines || [],
      },
    });
  } catch (err) {
    console.error('[IDENTITY] Verification failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/identity/me -- the passport itself: who you are, your
// interests, and every org you follow across the whole platform (derived
// live from community_members' email-index -- see identity-auth.js).
router.get('/me', authenticateIdentityToken, async (req, res) => {
  try {
    const identity = await getIdentity(req.identityUser.identity_id);
    if (!identity) return res.status(404).json({ error: 'Identity not found.' });

    const followedOrgs = await listFollowedOrgsForEmail(identity.email);

    res.json({
      identity_id: identity.identity_id,
      email: identity.email,
      display_name: identity.display_name || null,
      interests: identity.interests || [],
      languages: identity.languages || [],
      cuisines: identity.cuisines || [],
      followed_orgs: followedOrgs,
    });
  } catch (err) {
    console.error('[IDENTITY] Failed to load identity:', err.message);
    res.status(500).json({ error: 'Could not load your passport.' });
  }
});

router.patch('/me', authenticateIdentityToken, async (req, res) => {
  try {
    const { display_name, interests, languages, cuisines } = req.body || {};
    const updated = await updateIdentityProfile(req.identityUser.identity_id, { display_name, interests, languages, cuisines });
    res.json({
      success: true,
      display_name: updated.display_name || null,
      interests: updated.interests || [],
      languages: updated.languages || [],
      cuisines: updated.cuisines || [],
    });
  } catch (err) {
    console.error('[IDENTITY] Failed to update profile:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/follow/:org_id', authenticateIdentityToken, async (req, res) => {
  try {
    await followOrgAsIdentity(req.params.org_id, req.identityUser.email);
    res.json({ success: true, following: true });
  } catch (err) {
    console.error('[IDENTITY] Failed to follow:', err.message);
    res.status(500).json({ error: 'Could not follow right now -- try again.' });
  }
});

router.post('/unfollow/:org_id', authenticateIdentityToken, async (req, res) => {
  try {
    await unfollowOrgAsIdentity(req.params.org_id, req.identityUser.email);
    res.json({ success: true, following: false });
  } catch (err) {
    console.error('[IDENTITY] Failed to unfollow:', err.message);
    res.status(500).json({ error: 'Could not unfollow right now -- try again.' });
  }
});

module.exports = router;
