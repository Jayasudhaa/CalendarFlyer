/**
 * server/routes/events.js
 * Events API — uses existing calendarfly_events DynamoDB table
 *
 * Table schema:
 *   PK: event_id (String)
 *   GSI: org-index → org_id (String)
 *
 * Routes:
 *   GET  /api/events/upcoming   — PUBLIC, used by chatbot Lambda
 *   POST /api/events/sync       — bulk sync from frontend → DynamoDB (admin)
 *   POST /api/events            — add single event (admin)
 *   DELETE /api/events/:eventId — delete event (admin)
 */

const express = require('express');
const router  = express.Router();

const { DynamoDBClient }   = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION         = process.env.AWS_REGION            || 'us-east-2';
const EVENTS_TABLE   = process.env.DYNAMO_EVENTS_TABLE   || 'temple-events';
const PANCHANG_TABLE = process.env.DYNAMO_PANCHANG_TABLE || 'temple-panchang';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function scanAll(table, filter) {
  let items = [], lastKey;
  do {
    const params = { TableName: table, ExclusiveStartKey: lastKey };
    if (filter) Object.assign(params, filter);
    const result = await dynamo.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

router.get('/', async (req, res) => {
  try {
    const items  = await scanAll(EVENTS_TABLE);
    const events = items
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
      .map(e => ({
        id: e.event_id, title: e.title || '', date: e.event_date || '',
        time: e.time || '', type: e.type || 'event',
        description: e.description || '',
        tithi: e.tithi || null, nakshatra: e.nakshatra || null, moonPhase: e.moonPhase || null,
      }));
    return res.json(events);
  } catch (err) {
    console.error('[EVENTS] GET / error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/events/upcoming — next 30 days for chatbot
router.get('/upcoming', async (req, res) => {
  try {
    const today   = new Date().toISOString().slice(0, 10);
    const future = new Date(); future.setDate(future.getDate() + 30);
    const futureStr = future.toISOString().slice(0, 10);

    // Query using GSI org-index to get events for this org
    const items = await scanAll(EVENTS_TABLE, {
      FilterExpression:          '#dt >= :today AND #dt <= :future AND #tp <> :panchang',
      ExpressionAttributeNames:  { '#dt': 'event_date', '#tp': 'type' },
      ExpressionAttributeValues: { ':today': today, ':future': futureStr, ':panchang': 'panchang' },
    });

    const events = items
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
      .map(e => ({ id: e.event_id, title: e.title || '', date: e.event_date || '', time: e.time || '', description: e.description || '' }));

    return res.json({ events, count: events.length, asOf: today });

  } catch (err) {
    console.error('[EVENTS] /upcoming error:', err.message);
    // Return empty — chatbot still works with FAISS knowledge base only
    return res.json({ events: [], count: 0, error: err.message });
  }
});

// ── POST /api/events/sync ────────────────────────────────────────────────────
// Bulk push all events from frontend localStorage → DynamoDB
// Run once from browser console after deploy
router.get('/panchang', async (req, res) => {




    try {
    const items    = await scanAll(PANCHANG_TABLE);
    const panchang = items
      .sort((a, b) => (a.pdate || '').localeCompare(b.pdate || ''))
      .map(e => ({
        id: e.pid, date: e.pdate || '', title: e.title || '',
        tithi: e.tithi || '', nakshatra: e.nakshatra || '',
        moonPhase: e.moonPhase || '', type: 'panchang',
      }));


// ── POST /api/events ─────────────────────────────────────────────────────────
// Add single event (admin)





// ── DELETE /api/events/:eventId ──────────────────────────────────────────────
    return res.json(panchang);
  } catch (err) {
    console.error('[PANCHANG] GET error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Admin guard ───────────────────────────────────────────────────────────────

module.exports = router;
