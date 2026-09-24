/**
 * server/routes/analyticsInsights.js
 * AI-powered analytics: turns the RSVP/attendance numbers the Analytics
 * page already computes client-side (components/RSVPAnalyticsPage.jsx)
 * into a short, plain-English insights summary via Claude -- same
 * never-invent-a-number discipline as routes/documents.js's /search and
 * utils/captionEventParser.js. This endpoint does NOT recompute anything
 * from RSVP data itself; the frontend sends its own already-correct
 * aggregates (overview totals, weekly trend, per-event breakdown) and this
 * route only asks Claude to comment on them in words. A malformed or
 * inconsistent payload isn't independently verified against real RSVP
 * rows here -- garbage in, garbage out is an accepted tradeoff for not
 * duplicating the aggregation logic server-side.
 *
 * Gated to Organization Pro and up (see PLAN_FEATURES.analytics in
 * organizations.js) -- Free/Plus orgs still see the real charts on the
 * Analytics page, just not this generated summary.
 *
 * Mounted at /api/organizations/analytics in server.js.
 */

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const { authenticateToken } = require('./auth');
const { getOrganization, canUseFeature } = require('../organizations');
const { sendServerError } = require('../utils/errors');

const router = express.Router();

// Lazy-initialized -- same reasoning as routes/documents.js's
// getAnthropic(): the SDK throws synchronously if ANTHROPIC_API_KEY is
// missing, and this module is required at server boot, so an unguarded
// `new Anthropic(...)` here would take the whole app down rather than
// just this one feature.
let anthropic = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

const SYSTEM_PROMPT = `You are an analytics assistant for a community organization's event platform. You'll be given real, already-computed RSVP and attendance statistics for one month, plus a weekly registration trend and (sometimes) a per-event breakdown.

Rules:
- Use ONLY the numbers given to you. Never invent, estimate, or round in a way that implies precision the data doesn't have.
- Write a short summary: 3-5 sentences of plain English prose (no bullet points, no headers) covering the overall picture -- attendance level, response rate, and any notable pattern in the weekly trend or per-event breakdown.
- End with exactly one concrete, actionable suggestion, only if the data actually supports it (e.g. a low response rate, a steep decline mid-month, one event far outperforming others). If nothing in the data suggests a specific action, say plainly that there's nothing actionable yet instead of inventing generic advice.
- If the data given is too sparse (e.g. zero events or zero RSVPs) to say anything meaningful, say so plainly in one sentence instead of guessing.`;

router.post('/insights', authenticateToken, async (req, res) => {
  const { overview, weeklyRegistrations, eventBreakdown, monthLabel } = req.body || {};
  if (!overview || typeof overview !== 'object') {
    return res.status(400).json({ error: 'Missing analytics data to summarize.' });
  }

  try {
    const org = await getOrganization(req.user.org_id);
    if (!org || !canUseFeature(org, 'analytics')) {
      return res.status(403).json({ error: 'AI-powered analytics is available on the Organization Pro plan — upgrade to unlock it.' });
    }

    const client = getAnthropic();
    if (!client) {
      return res.status(501).json({ error: 'AI insights need ANTHROPIC_API_KEY set on the server.' });
    }

    // Nothing meaningful to say about zero events/RSVPs -- skip the API
    // call entirely rather than let Claude pad out a non-answer.
    if (!overview.eventsCount || !overview.rsvpsCount) {
      return res.json({
        insights: "There isn't enough RSVP data yet this month to generate a meaningful summary — check back once a few events have some responses.",
        disclaimer: 'This summary is AI-generated from your own RSVP data. It may be incomplete — double-check anything important.',
      });
    }

    const payload = [
      `MONTH: ${monthLabel || 'unspecified'}`,
      `OVERVIEW: ${JSON.stringify(overview)}`,
      `WEEKLY REGISTRATION TREND: ${JSON.stringify(weeklyRegistrations || [])}`,
      `PER-EVENT BREAKDOWN: ${JSON.stringify((eventBreakdown || []).slice(0, 20))}`,
    ].join('\n\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payload }],
    });
    const block = (response.content || []).find((b) => b.type === 'text');

    return res.json({
      insights: (block && block.text) || 'No insights generated.',
      disclaimer: 'This summary is AI-generated from your own RSVP data. It may be incomplete — double-check anything important.',
    });
  } catch (err) {
    return sendServerError(res, err, 'Failed to generate AI insights');
  }
});

module.exports = router;
