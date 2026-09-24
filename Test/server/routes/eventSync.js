/**
 * server/routes/eventSync.js
 * WhatsApp-Lambda event sync routes (DynamoDB + S3) — split out of
 * chat.js on 2026-08-18 when the conversational chatbot routes were
 * activated for the first time.
 *
 * ⚠ STILL NOT MOUNTED in server.js — left dormant on purpose. Mounting it
 * is a separate decision (it needs a real requireAuth flow decision too —
 * see below); this file just needed to stop being unsafe-by-default.
 *
 * Previously wipeTable() deleted EVERY item in the events/panchang table
 * before writing a new batch, with no org/tenant scoping — one org's sync
 * would wipe every other org's events too. Fixed by requiring an org_id on
 * every write and scoping both the wipe's scan and its deletes to that
 * org_id via a FilterExpression. That's a full-table Scan with a filter
 * (temple-events/temple-panchang have no GSI on org_id), so it still reads
 * every item in the table on each sync — fine at this app's current scale,
 * but add a GSI on org_id and query that instead of scanning if this table
 * grows into many orgs' worth of events.
 *
 * requireAuth() below only checks that the bearer token is a *valid* JWT —
 * it doesn't check who it belongs to, which is fine for extracting org_id
 * from an admin's own token but would need a real API-key/service-auth
 * scheme (not a repurposed login token) before trusting an external Lambda
 * to call this over the network. Worth a proper look before mounting.
 *
 * To re-enable once you're ready: add
 *   app.use('/api/chat', require('./routes/eventSync'));
 * to server.js (or merge these routes back under a scoped path).
 */

const express = require('express');
const router  = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, DeleteItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { JWT_SECRET } = require('../utils/jwtSecret');
const { sendServerError } = require('../utils/errors');

const REGION         = process.env.AWS_REGION            || 'us-east-2';
const EVENTS_TABLE   = process.env.DYNAMO_EVENTS_TABLE   || 'temple-events';
const PANCHANG_TABLE = process.env.DYNAMO_PANCHANG_TABLE || 'temple-panchang';
const S3_BUCKET      = process.env.S3_BUCKET             || 'svtemple-events';

const LAMBDA_REGION = process.env.LAMDA_AWS_REGION || 'us-east-1';
const LAMBDA_CREDS  = {
  accessKeyId:     process.env.LAMBDA_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.LAMBDA_AWS_SECRET_ACCESS_KEY,
};
const dynamo = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: REGION });
const s3     = new S3Client({ region: LAMBDA_REGION, credentials: LAMBDA_CREDS });

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.org_id) return res.status(401).json({ error: 'Token has no org_id — cannot scope this sync to a tenant' });
    req.org_id = decoded.org_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Deletes only items belonging to org_id, scanning with a FilterExpression
// rather than the old unconditional full-table wipe. See the file header
// for the GSI caveat if this table grows large.
async function wipeTable(tableName, pkField, skField, org_id) {
  let lastKey, totalDeleted = 0;
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: '#pk, #sk, #org',
      FilterExpression: '#org = :org_id',
      ExpressionAttributeNames: { '#pk': pkField, '#sk': skField, '#org': 'org_id' },
      ExpressionAttributeValues: { ':org_id': { S: org_id } },
      ExclusiveStartKey: lastKey,
    }));
    for (const item of (res.Items || [])) {
      if (!item[pkField] || !item[skField]) continue;
      await dynamo.send(new DeleteItemCommand({
        TableName: tableName,
        Key: { [pkField]: item[pkField], [skField]: item[skField] },
      }));
      totalDeleted++;
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return totalDeleted;
}

router.post('/sync-dynamo', requireAuth, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ error: 'No events array provided' });

    const synced_at = new Date().toISOString();
    const deleted   = await wipeTable(EVENTS_TABLE, 'event_date', 'event_id', req.org_id);
    console.log(`[sync-dynamo] Wiped ${deleted} events for org ${req.org_id}`);
    const results   = { written: 0, failed: 0, errors: [] };

    for (const ev of events) {
      if (!ev.date || !ev.title) continue;
      try {
        const slug = (ev.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        // Namespaced with org_id — without it, two orgs syncing an event
        // with the same date+title would generate the same event_id (the
        // table's sort key) and silently overwrite each other's item.
        const eventId = `${req.org_id}-${ev.date}-${slug}`;
        await dynamo.send(new PutItemCommand({
          TableName: EVENTS_TABLE,
          Item: marshall({
            event_date:  ev.date,                                   // PK "2026-04-14"
            event_id:    eventId,      // SK e.g. "org-abc-2026-04-18-sri-venkateswara-kalyanam"
            org_id:      req.org_id,
            title:       ev.title       || '',
            type:        ev.type        || 'event',
            time:        ev.time || '',
            description: ev.description || '',
            tithi:       ev.tithi       || '',
            nakshatra:   ev.nakshatra   || '',
            source:      'calendarfly',
            synced_at,
          }),
        }));
        results.written++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${ev.date} ${ev.title}: ${err.message}`);
      }
    }
    console.log(`[sync-dynamo] ${results.written} written, ${results.failed} failed`);
    return res.json({ success: results.failed === 0, ...results, synced_at, table: EVENTS_TABLE });
  } catch (err) {
    console.error('[sync-dynamo]', err.message);
    return sendServerError(res, err);
  }
});

router.post('/sync-panchang', requireAuth, async (req, res) => {
  try {
    const { events } = req.body;
    const panchang = (Array.isArray(events) ? events : []).filter(e => e.type === 'panchang');
    if (panchang.length === 0)
      return res.status(400).json({ error: 'No panchang events found in payload' });
    const synced_at = new Date().toISOString();
    const deleted   = await wipeTable(PANCHANG_TABLE, 'pdate', 'pid', req.org_id);
    console.log(`[sync-panchang] Wiped ${deleted} panchang entries for org ${req.org_id}`);
    const results = { written: 0, failed: 0, errors: [] };
    for (const ev of panchang) {
      if (!ev.date) continue;
      try {
        const slug = (ev.title || ev.date).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await dynamo.send(new PutItemCommand({
          TableName: PANCHANG_TABLE,
          Item: marshall({
            pdate:     ev.date,
            pid:       `${req.org_id}-${ev.date}-${slug}`, // namespaced — see sync-dynamo above
            org_id:    req.org_id,
            title:     ev.title     || '',
            tithi:     ev.tithi     || '',
            nakshatra: ev.nakshatra || '',
            moonPhase: ev.moonPhase || '',
            source:    'calendarfly',
            synced_at,
          }),
        }));
        results.written++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${ev.date}: ${err.message}`);
      }
    }
    console.log(`[sync-panchang] ${results.written} written, ${results.failed} failed`);
    return res.json({ success: results.failed === 0, ...results, synced_at, table: PANCHANG_TABLE });
  } catch (err) {
    console.error('[sync-panchang]', err.message);
    return sendServerError(res, err);
  }
});

router.post('/sync-s3', requireAuth, async (req, res) => {
  try {
    const { events_txt, event_count, events } = req.body;
    if (!events_txt) return res.status(400).json({ error: 'No events_txt provided' });

    // Namespaced under the org's own prefix — the fixed keys this used to
    // write to ('calendarfly-sync/...') meant every org's sync overwrote
    // the same two S3 objects, the same cross-tenant clobber as the
    // DynamoDB wipe above just via a different mechanism.
    const orgPrefix = `calendarfly-sync/${req.org_id}`;

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: `${orgPrefix}/current_events.txt`,
      Body: events_txt, ContentType: 'text/plain',
      Metadata: { 'synced-at': new Date().toISOString(), 'event-count': String(event_count || 0), 'source': 'calendarfly', 'org-id': req.org_id },
    }));

    const index = {};
    (events || []).forEach(ev => {
      if (!ev.date) return;
      if (!index[ev.date]) index[ev.date] = [];
      index[ev.date].push({ title: ev.title, type: ev.type || 'festival', time: ev.time || null, desc: ev.description || null });
    });

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: `${orgPrefix}/events_index.json`,
      Body: JSON.stringify(index, null, 2), ContentType: 'application/json',
      Metadata: { 'synced-at': new Date().toISOString(), 'source': 'calendarfly', 'org-id': req.org_id },
    }));
    console.log(`[sync-s3] ${event_count} events uploaded`);
    return res.json({ success: true, message: `${event_count} events uploaded to S3`, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error('[sync-s3]', err.message);
    return sendServerError(res, err);
  }
});

module.exports = router;
