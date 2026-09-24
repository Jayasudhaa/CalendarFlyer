/**
 * server/routes/rsvp.js
 * RSVP system using AWS DynamoDB
 *
 * Table: temple_rsvp
 * PK: eventId (string)  SK: rsvpId (string, uuid)
 */

const express   = require('express');
const router    = express.Router();
const { DynamoDBClient }             = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { requireOrganization } = require('../middleware/tenant');
const { incrementUsage } = require('../organizations');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { sendServerError } = require('../utils/errors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const EVENTS_TABLE = 'calendarfly_events';
const RSVP_TABLE = process.env.RSVP_TABLE || 'temple_rsvp';

// POST /rsvp is public and unauthenticated on purpose (any devotee can RSVP
// without an account) — so a per-IP rate limit is what stands between this
// and a scripted DynamoDB-write spam flood, same rateLimit pattern/library
// as routes/remove-bg.js / routes/translate.js.
const rsvpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { error: 'Too many RSVP submissions from this network — please wait a few minutes and try again.' },
});

let dynamo = null;
function getDynamo() {
  if (!dynamo) {
    dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB,
      region: process.env.AWS_REGION || 'us-east-2',
  // Credentials auto-loaded from env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
}));
  }
  return dynamo;
}

// ── POST /api/rsvp  — submit an RSVP ─────────────────────────────────────────
router.post('/rsvp', rsvpLimiter, async (req, res) => {
  const { eventId, name, count, meal } = req.body;

  if (!eventId || !name || count === undefined || count === null) {
    return res.status(400).json({ error: 'eventId, name and count are required' });
  }
  if (isNaN(count) || +count < 0 || +count > 20) {
    return res.status(400).json({ error: 'count must be between 0 and 20' });
  }

  const item = {
    eventId,
    rsvpId:    uuidv4(),
    name:      name.trim().slice(0, 80),
    count:     +count,
    meal:      meal || 'not specified',
    createdAt: new Date().toISOString(),
  };

  try {
    await getDynamo().send(new PutCommand({ TableName: RSVP_TABLE, Item: item }));
    if (req.org) {
      await incrementUsage(req.org.org_id, 'rsvp_responses').catch(err => 
        console.error('[RSVP] Failed to increment usage:', err)
      );
    }
  return res.status(201).json({ success: true, rsvpId: item.rsvpId });
  } catch (err) {
    console.error('[RSVP] Error saving RSVP:', err);
    return sendServerError(res, err, 'Failed to save RSVP');
  }
});

// Shared by the single-event GET below and the /rsvp/batch route, so both
// stay in sync on exactly what a "fetch this event's RSVPs" result looks
// like (items + totalCount + mealBreakdown + timeline).
async function queryEventRSVPs(eventId) {
  const result = await getDynamo().send(new QueryCommand({
    TableName: RSVP_TABLE,
    KeyConditionExpression:   'eventId = :eid',
    ExpressionAttributeValues: { ':eid': eventId },
  }));

  const items = result.Items || [];
  const totalCount = items.reduce((s, i) => s + i.count, 0);

  // Meal breakdown
  const mealBreakdown = items.reduce((acc, i) => {
    const m = i.meal || 'not specified';
    acc[m] = (acc[m] || 0) + i.count;
    return acc;
  }, {});

  // Timeline: group by date (YYYY-MM-DD)
  const timeline = items.reduce((acc, i) => {
    const day = i.createdAt?.slice(0, 10) || 'unknown';
    acc[day] = (acc[day] || 0) + i.count;
    return acc;
  }, {});

  return { items, totalCount, mealBreakdown, timeline };
}

// ── GET /api/rsvp/:eventId  — fetch all RSVPs for an event (view access) ────
router.get('/rsvp/:eventId', viewGuard, async (req, res) => {
  const { eventId } = req.params;
  console.log('[RSVP] Fetching RSVPs for eventId:', eventId);

  try {
    const data = await queryEventRSVPs(eventId);
    console.log('[RSVP] Found', data.items.length, 'RSVPs,', data.totalCount, 'guests');
    return res.json(data);
  } catch (err) {
    console.error('[RSVP] Error fetching RSVPs:', err);
    return sendServerError(res, err, 'Failed to fetch RSVPs');
  }
});

// ── POST /api/rsvp/batch — fetch RSVPs for many events in one round trip ───
// The Analytics Overview page used to fire one GET /api/rsvp/:eventId per
// event in the visible month (15-20+ separate browser requests). Browsers
// cap concurrent connections per host at ~6, so most of those just queued
// in waves instead of actually running in parallel — a multi-second load
// for a month with a lot of events. This does the same DynamoDB Query per
// event, but fans them out concurrently on the server behind a single HTTP
// request, cutting it down to one round trip from the browser's side.
router.post('/rsvp/batch', viewGuard, async (req, res) => {
  const { eventIds } = req.body || {};
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return res.status(400).json({ error: 'eventIds must be a non-empty array' });
  }
  if (eventIds.length > 200) {
    return res.status(400).json({ error: 'Too many eventIds in one batch request (max 200)' });
  }

  const results = {};
  await Promise.all(eventIds.map(async (eventId) => {
    try {
      results[eventId] = await queryEventRSVPs(eventId);
    } catch (err) {
      console.error('[RSVP] Batch fetch failed for', eventId, err);
      results[eventId] = { items: [], totalCount: 0, mealBreakdown: {}, timeline: {}, error: err?.message || 'Failed to fetch' };
    }
  }));

  return res.json({ results });
});

// ── DELETE /api/rsvp/:eventId/:rsvpId  — remove one RSVP (Owner/Admin only) ──
router.delete('/rsvp/:eventId/:rsvpId', manageGuard, async (req, res) => {
  const { eventId, rsvpId } = req.params;
  try {
    await getDynamo().send(new DeleteCommand({ 
      TableName: RSVP_TABLE, 
      Key: { eventId, rsvpId } 
    }));
    console.log('[RSVP] Deleted RSVP:', rsvpId);
  return res.json({ success: true });
  } catch (err) {
    console.error('[RSVP] Error deleting RSVP:', err);
    return sendServerError(res, err, 'Failed to delete RSVP');
  }
});

// ── Guards ────────────────────────────────────────────────────────────────
// Previously a single adminGuard let any non-guest org login see AND delete
// RSVPs — an all-or-nothing split that had no room for a read-only Viewer.
// Now: viewGuard (GET) accepts any signed-in member of the org — Owner,
// Admin, or Viewer, since seeing RSVP numbers is meant to be read access for
// everyone. manageGuard (DELETE) additionally requires Owner or Admin. Both
// still accept a valid site-admin session unchanged, and both keep the
// ADMIN_SECRET header as a server-side-only fallback (e.g. scripts/support)
// — never referenced by any client code.
function viewGuard(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  if (req.headers['authorization']) {
    return authenticateToken(req, res, next);
  }
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const provided = req.headers['x-admin-secret'] || req.query.secret;
    if (provided === secret) {
      return next();
    }
  }
  return res.status(401).json({ error: 'Unauthorized - Admin login required' });
}
function manageGuard(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  if (req.headers['authorization']) {
    return authenticateToken(req, res, () => requireRole('owner', 'admin')(req, res, next));
  }
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const provided = req.headers['x-admin-secret'] || req.query.secret;
    if (provided === secret) {
      return next();
    }
  }
  return res.status(401).json({ error: 'Unauthorized - Admin login required' });
}

module.exports = router;
