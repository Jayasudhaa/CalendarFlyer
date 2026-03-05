/**
 * server/routes/rsvp.js
 * RSVP system using AWS DynamoDB
 *
 * Table: temple_rsvp
 * PK: eventId (string)  SK: rsvpId (string, uuid)
 *
 * Setup (one-time):
 *   aws dynamodb create-table \
 *     --table-name temple_rsvp \
 *     --attribute-definitions AttributeName=eventId,AttributeType=S AttributeName=rsvpId,AttributeType=S \
 *     --key-schema AttributeName=eventId,KeyType=HASH AttributeName=rsvpId,KeyType=RANGE \
 *     --billing-mode PAY_PER_REQUEST \
 *     --region us-east-1
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
  region: process.env.AWS_REGION || 'us-east-1',
  // Credentials auto-loaded from env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
}));
  }
  return dynamo;
}

// ── POST /api/rsvp  — submit an RSVP ─────────────────────────────────────────
router.post('/rsvp', async (req, res) => {
  const { eventId, name, count, meal } = req.body;

  if (!eventId || !name || !count) {
    return res.status(400).json({ error: 'eventId, name and count are required' });
  }
  if (isNaN(count) || +count < 1 || +count > 20) {
    return res.status(400).json({ error: 'count must be between 1 and 20' });
  }

  const item = {
    eventId,
    rsvpId:    uuidv4(),
    name:      name.trim().slice(0, 80),
    count:     +count,
    meal:      meal || 'not specified',
    createdAt: new Date().toISOString(),
  };

  await getDynamo().send(new PutCommand({ TableName: TABLE, Item: item }));
  return res.status(201).json({ success: true, rsvpId: item.rsvpId });
});

// ── GET /api/rsvp/:eventId  — fetch all RSVPs for an event (admin) ───────────
router.get('/rsvp/:eventId', adminGuard, async (req, res) => {
  const { eventId } = req.params;

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

  return res.json({ items, totalCount, mealBreakdown, timeline });
});

// ── DELETE /api/rsvp/:eventId/:rsvpId  — remove one RSVP (admin) ─────────────
router.delete('/rsvp/:eventId/:rsvpId', adminGuard, async (req, res) => {
  const { eventId, rsvpId } = req.params;
  await getDynamo().send(new DeleteCommand({ TableName: TABLE, Key: { eventId, rsvpId } }));
  return res.json({ success: true });
});

// ── Simple admin guard ────────────────────────────────────────────────────────
function adminGuard(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return next(); // no secret set → open (dev mode)
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

module.exports = router;
