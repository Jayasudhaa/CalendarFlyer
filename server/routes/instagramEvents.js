/**
 * server/routes/instagramEvents.js — turning Instagram posts into event
 * candidates for a human to review and approve, two ways:
 *
 *  - POST /sync: for an org that's already done "Continue with Instagram"
 *    (routes/instagramAuth.js) -- pulls that account's own recent posts
 *    via lib/instagramClient.getRecentMedia and runs each caption through
 *    utils/captionEventParser.js.
 *  - POST /from-link: works for ANY org, connected or not -- paste a
 *    single public post's URL, no OAuth needed (utils/instagramOembed.js).
 *    This is the bridge for orgs that haven't connected (or won't) yet.
 *
 * Either way, nothing is ever published automatically -- both just add
 * rows to utils/instagramCandidates.js's review queue. GET /candidates
 * lists them; POST /candidates/:id/approve is the only path to a real
 * event (via events.js's createEvent, same as manual add); POST
 * /candidates/:id/reject just dismisses it.
 *
 * Mounted at /api/organizations/instagram in server.js.
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getOrganization } = require('../organizations');
const { createEvent } = require('../events');
const { getRecentMedia } = require('../lib/instagramClient');
const { fetchInstagramOembed } = require('../utils/instagramOembed');
const { extractEventFromCaption } = require('../utils/captionEventParser');
const {
  upsertCandidate, listCandidatesForOrg, getCandidate, updateCandidateStatus,
} = require('../utils/instagramCandidates');
const { sendServerError } = require('../utils/errors');

function isoDateOf(timestamp) {
  try { return new Date(timestamp).toISOString().slice(0, 10); } catch { return null; }
}

// ── Sync a connected account's own recent posts ─────────────────────────
router.post('/sync', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const org = await getOrganization(req.user.org_id);
    const ig = org && org.social_accounts && org.social_accounts.instagram;
    if (!ig || !ig.access_token) {
      return res.status(400).json({ error: 'Connect Instagram first (Settings > Social Media).' });
    }

    const media = await getRecentMedia(ig.access_token, 25);
    let added = 0;
    const results = [];
    for (const post of media) {
      if (!post.caption) continue; // nothing to parse
      const postDateIso = isoDateOf(post.timestamp);
      const parsed = await extractEventFromCaption(post.caption, postDateIso);
      const { item, created } = await upsertCandidate(req.user.org_id, {
        source: 'connected_account',
        source_id: post.id,
        source_url: post.permalink,
        caption: post.caption,
        media_url: post.media_url,
        posted_at: post.timestamp,
        parsed,
      });
      if (created) added += 1;
      results.push(item);
    }
    return res.json({ success: true, checked: media.length, added, candidates: results });
  } catch (err) {
    const message = err.response && err.response.data && err.response.data.error
      ? err.response.data.error.message
      : err.message;
    return sendServerError(res, err, message || 'Failed to sync Instagram posts');
  }
});

// ── Paste a single public post link -- no connection required ──────────
router.post('/from-link', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  const { url } = req.body || {};
  if (!url || !url.trim()) return res.status(400).json({ error: 'Paste an Instagram post link.' });
  try {
    const { caption, permalink } = await fetchInstagramOembed(url.trim());
    if (!caption) {
      return res.status(422).json({ error: "Couldn't read a caption from that post — it may not have one, or Instagram changed its embed format." });
    }
    const parsed = await extractEventFromCaption(caption, isoDateOf(Date.now()));
    const { item } = await upsertCandidate(req.user.org_id, {
      source: 'pasted_link',
      source_id: url.trim(),
      source_url: permalink,
      caption,
      posted_at: null,
      parsed,
    });
    return res.status(201).json({ success: true, candidate: item });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to read that Instagram post' });
  }
});

// ── Review queue ─────────────────────────────────────────────────────────
router.get('/candidates', authenticateToken, async (req, res) => {
  try {
    const candidates = await listCandidatesForOrg(req.user.org_id);
    return res.json({ candidates });
  } catch (err) {
    return sendServerError(res, err, 'Failed to load the Instagram review queue');
  }
});

router.post('/candidates/:id/approve', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const candidate = await getCandidate(req.params.id);
    if (!candidate || candidate.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (candidate.status !== 'pending') {
      return res.status(400).json({ error: `Already ${candidate.status}.` });
    }
    const edits = req.body || {};
    const title = (edits.title !== undefined ? edits.title : (candidate.parsed && candidate.parsed.title)) || '';
    const date = (edits.date !== undefined ? edits.date : (candidate.parsed && candidate.parsed.date)) || '';
    if (!title.trim() || !date.trim()) {
      return res.status(400).json({ error: 'A title and date are required — fill in what the caption left out before approving.' });
    }
    const event = await createEvent(req.user.org_id, {
      title: title.trim(),
      date: date.trim(),
      time: edits.time !== undefined ? edits.time : (candidate.parsed && candidate.parsed.time),
      location: edits.location !== undefined ? edits.location : (candidate.parsed && candidate.parsed.location),
      description: candidate.caption,
      image_url: candidate.media_url,
      discoverability: 'radar',
    });
    await updateCandidateStatus(candidate.candidate_id, 'approved', event.event_id);
    return res.json({ success: true, event });
  } catch (err) {
    return sendServerError(res, err, 'Failed to approve this event');
  }
});

router.post('/candidates/:id/reject', authenticateToken, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const candidate = await getCandidate(req.params.id);
    if (!candidate || candidate.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Not found' });
    }
    await updateCandidateStatus(candidate.candidate_id, 'rejected');
    return res.json({ success: true });
  } catch (err) {
    return sendServerError(res, err, 'Failed to dismiss this candidate');
  }
});

module.exports = router;
