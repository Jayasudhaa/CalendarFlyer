/**
 * server/routes/chat.js
 * Conversational AI chat routes — CalendarFly admin assistant + public
 * temple/org chatbot. Mounted at /api/chat in server.js.
 *
 * POST /admin-assistant  — logged-in org admin chat helper (voice/intent
 *                           actions inside the admin dashboard)
 * POST /welcome-intent    — classifies a first-time admin's typed intent
 *                           into a dashboard action
 * POST /temple-bot        — public-facing visitor chatbot on an org's
 *                           calendar page
 *
 * All three vary their persona/tone by org.category (temple / nonprofit /
 * community / other) — see ADMIN_PERSONA / BOT_PERSONA below.
 *
 * NOTE: the DynamoDB/S3 data-sync routes that used to live in this file
 * (/sync-dynamo, /sync-panchang, /sync-s3 — the WhatsApp-Lambda event sync
 * feature) have been moved to server/routes/eventSync.js and are NOT
 * mounted here or anywhere in server.js. That file wipes an entire
 * DynamoDB table before every sync with no per-org scoping, which needs a
 * fix before it's safe to expose — see the comment at the top of that file.
 * Splitting them out means turning on this chatbot doesn't also turn on
 * that route.
 */

const express = require('express');
const router  = express.Router();
const Anthropic  = require('@anthropic-ai/sdk');
const rateLimit = require('express-rate-limit');
const { getOrganization, checkLimit, recordChatbotMessageUsage } = require('../organizations');
const { authenticateToken } = require('./auth');

// Both /admin-assistant and /temple-bot gate on the chatbot_messages plan
// limit inline (each already has its own resolved `org` variable by the
// time the gate runs, so a shared helper would just mean a second,
// redundant getOrganization() call). /welcome-intent deliberately isn't
// gated: it's a one-off onboarding helper a brand-new Free-plan org needs
// to get through signup, not the "chatbot" feature being sold on Starter+;
// the rate limiter above still bounds its cost regardless of plan.
//
// Free plan orgs have chatbot_messages_per_month = 0, so checkLimit()
// blocks them immediately — matches PLAN_FEATURES.chatbot being false on
// Free. Any paid plan keeps working past its limit and accrues overage via
// recordChatbotMessageUsage(), same "bill instead of block" pattern as AI
// images, rather than cutting off a paying customer mid-month.

// /welcome-intent and /temple-bot are intentionally unauthenticated (a
// first-run admin widget and the public visitor chatbot, respectively) —
// with no login to gate them, they're the two routes in this file that
// call a paid API (Anthropic) with nothing but a per-IP rate limit
// standing between them and unlimited scripted requests.
const publicChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { reply: 'This chat is getting a lot of requests right now — please try again in a few minutes.', action: null },
});

// ── Org-type persona tailoring ──────────────────────────────────────────────
// Category is unset ('other'/null) for orgs that haven't picked one yet.
const ADMIN_PERSONA = {
  temple:    { audience: 'temple admins',                 tone: 'Use 🙏 occasionally.' },
  nonprofit: { audience: 'nonprofit staff and volunteers', tone: 'Use a warm, encouraging tone.' },
  community: { audience: 'community organizers',           tone: 'Use a friendly, neighborly tone.' },
  other:     { audience: 'organization admins',            tone: 'Keep the tone friendly and professional.' },
};
const BOT_PERSONA = {
  temple:    { description: 'a Hindu temple',        emoji: '🙏' },
  nonprofit: { description: 'a nonprofit organization', emoji: '' },
  community: { description: 'a community organization', emoji: '' },
  other:     { description: 'an organization',         emoji: '' },
};

// Lazy-initialized (like getOpenAI() in routes/admin.js and getStripe() in
// utils/stripeClient.js) instead of constructed here at module load time —
// the Anthropic SDK throws synchronously if ANTHROPIC_API_KEY is missing,
// and this file is required at server boot (server.js mounts /api/chat),
// so an unguarded `new Anthropic(...)` here would crash the ENTIRE server
// before it ever starts listening, not just this route.
let anthropic = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

// Best-effort recovery for a reply that got cut off mid-JSON (see the
// max_tokens comment below): pulls the "action" and "reply" values out with
// regex even when the surrounding object never closed. This still can't
// recover text that was truncated mid-sentence, but it means the user sees
// whatever real words the model wrote instead of a raw, dangling
// `{"action":"openBroadcast","reply":"To broadcast, go to` fragment.
function extractPartialJson(raw) {
  const actionMatch = raw.match(/"action"\s*:\s*"([^"]*)"/);
  const replyMatch = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  const action = actionMatch ? actionMatch[1] : null;
  const reply = replyMatch
    ? replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
    : null;
  return { action, reply };
}

async function callClaude(system, userMessage) {
  const response = await getAnthropic().messages.create({
    // 300 tokens was tight enough that a reply needing more than a couple
    // of short sentences would get cut off mid-word before the closing
    // brace — JSON.parse then throws, and the old fallback showed the
    // truncated raw JSON text verbatim (e.g. a dangling
    // `{"reply": "To import panchang, go to` with no closing quote), which
    // is exactly the "incomplete answer" behavior reported. 600 gives normal
    // multi-step how-to answers room to finish.
    model: 'claude-sonnet-5', max_tokens: 600, system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const stoppedEarly = response.stop_reason === 'max_tokens';
  const textBlock = response.content?.find(b => b.type === 'text');
  // A missing/empty text block used to fall straight through to the '{}'
  // default below with nothing logged anywhere — every such failure looked
  // identical to the user (always the same generic reply), with no way to
  // tell "the model didn't answer" apart from "something's actually broken"
  // from the server console. /temple-bot already logs this case; this
  // helper (used by /admin-assistant and /welcome-intent) didn't, which is
  // why the cause was invisible. Logging it now — check the server console
  // after the next message to see the real stop_reason/content.
  if (!textBlock || !textBlock.text) {
    console.error('[chat] empty/missing text block from Claude — stop_reason:', response.stop_reason, 'content:', JSON.stringify(response.content));
  }
  const raw   = textBlock?.text || '{}';
  const clean = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Truncated even at 600 tokens (a genuinely long answer) — recover what
    // we can instead of leaking raw JSON syntax to the chat window.
    const partial = extractPartialJson(clean);
    parsed = {
      action: partial.action,
      reply: partial.reply
        ? partial.reply + (stoppedEarly ? '…' : '')
        : "Sorry, that answer got cut off — could you ask again, maybe more specifically?",
    };
  }
  // Was a cheerful but content-free "I can help with that!" — indistinguishable
  // from a real answer, so a broken response (see the log above) looked like
  // the assistant working normally instead of like a failure worth reporting.
  return {
    reply: parsed.reply || parsed.text || "Sorry, I didn't get a clear answer for that — please try asking again.",
    action: parsed.action || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin-assistant', authenticateToken, async (req, res) => {
  const { message, upcomingEvents } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  let org = null;
  try { org = await getOrganization(req.user.org_id); } catch (e) { /* fall back to generic persona below */ }

  if (org && org.plan === 'free' && !checkLimit(org, 'chatbot_messages', req.user && req.user.email)) {
    return res.status(429).json({
      reply: 'Chatbot isn’t available on the Free plan yet — upgrade to Starter or above to enable it.',
      action: null,
      upgrade_url: '/pricing',
    });
  }

  const orgName = org?.name || 'your organization';
  const p = ADMIN_PERSONA[org?.category] || ADMIN_PERSONA.other;

  const system = `You are the CalendarFly admin assistant for ${orgName}.
You help ${p.audience} manage their calendar, events, RSVPs, flyers, and broadcasts.
UPCOMING EVENTS:
${upcomingEvents || 'No upcoming events loaded yet.'}
You can trigger these app actions:
- openAddEvent, openBroadcast, openFlyer, openAnalytics, openImport, openSettings, openSocialSettings, openHelp
Use openSocialSettings (not openSettings) whenever the admin wants to connect, link, or set up a
Facebook Page, Instagram account, or WhatsApp number — it opens Settings directly on the Social
Media tab where those connections live, instead of making them hunt for it themselves.
Always respond ONLY with valid JSON, with "action" as the FIRST key so it's never lost if your reply
runs long: {"action": "<actionId or null>", "reply": "<response>"}
Keep replies concise and warm, but complete — finish the thought rather than trailing off. ${p.tone}`;
  try {
    const result = await callClaude(system, message);
    if (org) {
      recordChatbotMessageUsage(org.org_id).catch(err => console.error('[admin-assistant] Failed to record usage:', err.message));
    }
    return res.json(result);
  } catch (err) {
    console.error('[admin-assistant]', err.message);
    return res.status(500).json({ reply: 'Sorry, having trouble right now 🙏', action: null });
  }
});

router.post('/welcome-intent', publicChatLimiter, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const system = `You are an assistant for CalendarFly. Classify the admin message into ONE action:
addEvent, broadcast, flyer, analytics, import, settings, answerQuestion
Reply ONLY with JSON: {"action":"<actionId>","reply":"<one friendly sentence>"}`;
  try {
    return res.json(await callClaude(system, message));
  } catch (err) {
    console.error('[welcome-intent]', err.message);
    return res.status(500).json({ reply: 'Sorry, could not process that.', action: 'answerQuestion' });
  }
});

router.post('/temple-bot', publicChatLimiter, async (req, res) => {
  const { message, upcomingEvents, org_id } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  // Prefer the org resolved by tenantMiddleware (real subdomain/custom domain
  // requests); fall back to an org_id the frontend supplied explicitly, which
  // is how the public calendar page passes it through the local dev proxy.
  let org = req.org || null;
  if (!org && org_id) {
    try { org = await getOrganization(org_id); } catch (e) { /* fall through to generic persona */ }
  }

  if (org && org.plan === 'free' && !checkLimit(org, 'chatbot_messages')) {
    return res.status(429).json({
      reply: 'Chatbot isn’t available on the Free plan yet — upgrade to Starter or above to enable it.',
      action: null,
      upgrade_url: '/pricing',
    });
  }

  const orgName = org?.name || 'Sample Temple Name';
  const p = BOT_PERSONA[org?.category] || BOT_PERSONA.other;
  const contactLines = [
    org?.address ? `Address: ${org.address}` : null,
    org?.phone ? `Phone: ${org.phone}` : null,
  ].filter(Boolean).join('\n') || 'Contact information has not been set up yet — suggest visitors check the website or reach out via the public calendar page.';

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const system = `You are the friendly AI assistant for ${orgName}, ${p.description}.
Today's date is ${today} (Mountain Time). Always use this as reference for 'next', 'upcoming', 'this week' etc.
Answer visitors' questions warmly in 2-4 sentences max.
ORGANIZATION INFO:
Name: ${orgName}
${contactLines}
UPCOMING EVENTS:
${upcomingEvents || 'No upcoming events available.'}
Rules: Be warm${p.emoji ? `, use ${p.emoji} occasionally` : ''}, never make up dates, hours, prices, or services that weren't given to you above, keep to 2-4 sentences.`;
  try {
    const response = await getAnthropic().messages.create({
      // Was 250 — tight enough to cut off a 4-sentence answer mid-word for
      // any question with a longer address/hours/event list to relay.
      model: 'claude-sonnet-5', max_tokens: 400, system,
      messages: [{ role: 'user', content: message }],
    });
    // 'thinking' block can precede it in the content array.
    const textBlock = response.content?.find(b => b.type === 'text');
    if (!textBlock) console.error('[temple-bot] no text block in response:', JSON.stringify(response.content));
    if (org) {
      recordChatbotMessageUsage(org.org_id).catch(err => console.error('[temple-bot] Failed to record usage:', err.message));
    }
    return res.json({ reply: textBlock?.text || 'Please contact us directly 🙏' });
  } catch (err) {
    console.error('[temple-bot]', err.message);
    return res.status(500).json({ reply: 'Having trouble right now. Please contact us directly 🙏' });
  }
});

module.exports = router;
