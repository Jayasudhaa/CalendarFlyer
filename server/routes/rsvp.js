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
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE = process.env.RSVP_TABLE || 'temple_rsvp';

let dynamo = null;
function getDynamo() {
  if (!dynamo) {
    dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION || process.env.AWS_REGION_S3 || 'us-east-2',
  // Credentials auto-loaded from env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
}));
  }
  return dynamo;
}

// ── POST /api/rsvp  — submit an RSVP ─────────────────────────────────────────
router.post('/rsvp', async (req, res) => {
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
  await getDynamo().send(new PutCommand({ TableName: TABLE, Item: item }));
  return res.status(201).json({ success: true, rsvpId: item.rsvpId });
  } catch (err) {
    console.error('[RSVP] DynamoDB PutCommand error:', err);
    return res.status(500).json({ error: 'Failed to save RSVP', details: err.message });
  }
});

// ── GET /api/rsvp/:eventId  — fetch all RSVPs for an event (admin) ───────────
router.get('/rsvp/:eventId', adminGuard, async (req, res) => {
  const { eventId } = req.params;
  console.log('[RSVP] Fetching RSVPs for eventId:', eventId);

  try {
  const result = await getDynamo().send(new QueryCommand({
    TableName:                TABLE,
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

    console.log('[RSVP] Found', items.length, 'RSVPs,', totalCount, 'guests');
  return res.json({ items, totalCount, mealBreakdown, timeline });
  } catch (err) {
    console.error('[RSVP] DynamoDB QueryCommand error:', err);
    return res.status(500).json({ error: 'Failed to fetch RSVPs', details: err.message });
  }
});

// ── DELETE /api/rsvp/:eventId/:rsvpId  — remove one RSVP (admin) ─────────────
router.delete('/rsvp/:eventId/:rsvpId', adminGuard, async (req, res) => {
  const { eventId, rsvpId } = req.params;
  try {
  await getDynamo().send(new DeleteCommand({ TableName: TABLE, Key: { eventId, rsvpId } }));
    console.log('[RSVP] Deleted RSVP:', rsvpId);
  return res.json({ success: true });
  } catch (err) {
    console.error('[RSVP] DynamoDB DeleteCommand error:', err);
    return res.status(500).json({ error: 'Failed to delete RSVP', details: err.message });
  }
});

// ── Simple admin guard ────────────────────────────────────────────────────────
function adminGuard(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
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
