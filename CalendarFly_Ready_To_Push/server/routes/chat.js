/**
 * server/routes/chat.js
 * Chat proxy route — forwards queries from CalendarFly UI to WhatsApp Lambda
 *
 * POST /api/chat
 * Body: { message: string }
 * Returns: { reply: string }
 *
 * The Lambda at API Gateway expects the same format as WhatsApp webhook messages.
 * We wrap the user's message in a WhatsApp-style payload so the Lambda
 * can process it identically to a real WhatsApp message.
 */

const express = require('express');
const router  = express.Router();
const Anthropic  = require('@anthropic-ai/sdk');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, DeleteItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const REGION         = process.env.AWS_REGION            || 'us-east-2';
const EVENTS_TABLE   = process.env.DYNAMO_EVENTS_TABLE   || 'temple-events';
const PANCHANG_TABLE = process.env.DYNAMO_PANCHANG_TABLE || 'temple-panchang';
const S3_BUCKET    = process.env.S3_BUCKET            || 'svtemple-events';

const LAMBDA_REGION = process.env.LAMDA_AWS_REGION            || 'us-east-1';
const LAMBDA_CREDS  = {
  accessKeyId:     process.env.LAMBDA_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.LAMBDA_AWS_SECRET_ACCESS_KEY,
};
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const dynamo    = new DynamoDBClient({ region: REGION });
const s3        = new S3Client({ region: LAMBDA_REGION, credentials: LAMBDA_CREDS });

// ── POST /api/chat ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });


  // Wrap in WhatsApp webhook payload format so Lambda processes it normally
    // Flag so Lambda knows to return JSON response instead of sending WhatsApp message




    // Lambda returns { statusCode, body } or plain JSON
    try {
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET);
    next();
    } catch {
    return res.status(401).json({ error: 'Invalid token' });
    }
}

async function callClaude(system, userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5', max_tokens: 300, system,
    messages: [{ role: 'user', content: userMessage }],
  });
  // Find the actual text block — don't assume it's content[0].
  // Some responses include a 'thinking' block before the 'text' block.
  const textBlock = response.content?.find(b => b.type === 'text');
  const raw   = textBlock?.text || '{}';
  const clean = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try   { parsed = JSON.parse(clean); }
  catch { parsed = { reply: raw, action: null }; }
  return { reply: parsed.reply || parsed.text || 'I can help with that!', action: parsed.action || null };
}
async function wipeTable(tableName, pkField, skField) {
  let lastKey, totalDeleted = 0;
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: '#pk, #sk',
      ExpressionAttributeNames: { '#pk': pkField, '#sk': skField },
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

// ─────────────────────────────────────────────────────────────────────────────
router.post('/admin-assistant', async (req, res) => {
  const { message, upcomingEvents } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  const system = `You are the CalendarFly admin assistant for Sample Temple Name.
You help temple admins manage their calendar, events, RSVPs, flyers, and broadcasts.
UPCOMING EVENTS:
${upcomingEvents || 'No upcoming events loaded yet.'}
You can trigger these app actions:
- openAddEvent, openBroadcast, openFlyer, openAnalytics, openImport, openSettings, openHelp
Always respond ONLY with valid JSON: {"reply": "<response>", "action": "<actionId or null>"}
Keep replies concise and warm. Use 🙏 occasionally.`;
  try {
    return res.json(await callClaude(system, message));
  } catch (err) {
    console.error('[admin-assistant]', err.message);
    return res.status(500).json({ reply: 'Sorry, having trouble right now 🙏', action: null });
  }
});
router.post('/welcome-intent', async (req, res) => {
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

    // Also write a single combined JSON file Lambda can read for quick lookup
router.post('/temple-bot', async (req, res) => {
  const { message, upcomingEvents } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const system = `You are the friendly AI assistant for Sample Temple Name.
Today's date is ${today} (Mountain Time). Always use this as reference for 'next', 'upcoming', 'this week' etc.
Answer devotees questions warmly in 2-4 sentences max.
TEMPLE INFO:
Name: Sample Temple Name
Address: 123 Main Street, Your City, ST 00000
Phone: 555-555-5555 | Website: www.example.org | WhatsApp: +1 720-331-3601
HOURS: Weekdays 9AM-12PM and 6PM-8PM | Weekends 9AM-8PM continuous
KEY SERVICES: Daily Suprabhata 9AM, Kalyanam every 2nd Saturday 11AM, Satyanarayana Pooja 1st Saturday 10AM, Annadanam on weekends
UPCOMING EVENTS:
${upcomingEvents || 'No upcoming events available.'}
Rules: Be warm, use 🙏, never make up dates or prices, keep to 2-4 sentences.`;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5', max_tokens: 250, system,
      messages: [{ role: 'user', content: message }],
    });
    // Find the actual text block — don't assume it's content[0]; a
    // 'thinking' block can precede it in the content array.
    const textBlock = response.content?.find(b => b.type === 'text');
    if (!textBlock) console.error('[temple-bot] no text block in response:', JSON.stringify(response.content));
    return res.json({ reply: textBlock?.text || 'Please contact the temple office 🙏' });
  } catch (err) {
    console.error('[temple-bot]', err.message);
    return res.status(500).json({ reply: 'Having trouble right now. Please contact the temple office 🙏' });
  }
      });
router.post('/sync-dynamo', requireAuth, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0)
      return res.status(400).json({ error: 'No events array provided' });

    const synced_at = new Date().toISOString();
    const deleted   = await wipeTable(EVENTS_TABLE, 'event_date', 'event_id');
    console.log(`[sync-dynamo] Wiped ${deleted} events`);
    const results   = { written: 0, failed: 0, errors: [] };

    for (const ev of events) {
      if (!ev.date || !ev.title) continue;
      try {
        const slug = (ev.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const eventId = `${ev.date}-${slug}`;
        await dynamo.send(new PutItemCommand({
          TableName: EVENTS_TABLE,
          Item: marshall({
        event_date:  ev.date,                                   // PK "2026-04-14"
            event_id:    eventId,      // SK e.g. "2026-04-18-sri-venkateswara-kalyanam"
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
    return res.status(500).json({ error: err.message });
  }
});
router.post('/sync-panchang', requireAuth, async (req, res) => {
  try {
    const { events } = req.body;
    const panchang = (Array.isArray(events) ? events : []).filter(e => e.type === 'panchang');
    if (panchang.length === 0)
      return res.status(400).json({ error: 'No panchang events found in payload' });
    const synced_at = new Date().toISOString();
    const deleted   = await wipeTable(PANCHANG_TABLE, 'pdate', 'pid');
    console.log(`[sync-panchang] Wiped ${deleted} panchang entries`);
    const results = { written: 0, failed: 0, errors: [] };
    for (const ev of panchang) {
      if (!ev.date) continue;
      try {
        const slug = (ev.title || ev.date).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await dynamo.send(new PutItemCommand({
          TableName: PANCHANG_TABLE,
          Item: marshall({
            pdate:     ev.date,
            pid:       `${ev.date}-${slug}`,
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
    return res.status(500).json({ error: err.message });
  }
});

router.post('/sync-s3', requireAuth, async (req, res) => {
  try {
    const { events_txt, event_count, events } = req.body;
    if (!events_txt) return res.status(400).json({ error: 'No events_txt provided' });

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: 'calendarfly-sync/current_events.txt',
      Body: events_txt, ContentType: 'text/plain',
      Metadata: { 'synced-at': new Date().toISOString(), 'event-count': String(event_count || 0), 'source': 'calendarfly' },
    }));

    const index = {};
    (events || []).forEach(ev => {
      if (!ev.date) return;
      if (!index[ev.date]) index[ev.date] = [];
      index[ev.date].push({ title: ev.title, type: ev.type || 'festival', time: ev.time || null, desc: ev.description || null });
    });

    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: 'calendarfly-sync/events_index.json',
      Body: JSON.stringify(index, null, 2), ContentType: 'application/json',
      Metadata: { 'synced-at': new Date().toISOString(), 'source': 'calendarfly' },
    }));
    console.log(`[sync-s3] ${event_count} events uploaded`);
    return res.json({ success: true, message: `${event_count} events uploaded to S3`, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error('[sync-s3]', err.message);
    return res.status(500).json({ error: err.message });
  }
});
module.exports = router;
