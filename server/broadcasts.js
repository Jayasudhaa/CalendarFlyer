/**
 * Broadcast History + Scheduling Module
 *
 * Data access for the `calendarfly_broadcasts` table (see
 * dynamodb-schema.js for the table/index definitions and the reasoning
 * behind the two GSIs). One row per broadcast "batch" — whatever set of
 * platforms was checked on the Broadcast page when it was sent (or
 * scheduled). Used by:
 *   - routes/broadcast.js  — writes a row for every immediate send, and
 *     the POST /schedule / GET /history / DELETE /schedule/:id routes.
 *   - scheduler.js — polls for due scheduled rows and fires them.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const BROADCASTS_TABLE = 'calendarfly_broadcasts';

/**
 * Create a new broadcast row — either 'sending' (an immediate send, about
 * to be attempted platform-by-platform) or 'scheduled' (fire later).
 * `scheduled_for` must be omitted (not just falsy — DynamoDB rejects
 * `undefined` attribute values, and an immediate row must have no
 * scheduled_for at all so it stays out of the status-index GSI, which is
 * sparse and only meant to hold pending scheduled items) for anything
 * that isn't scheduled.
 */
async function createBroadcast({
  org_id, created_by, kind, platforms, caption, media_url,
  auto_rsvp, rsvp_url, wa_template, scheduled_for,
}) {
  const broadcast_id = `bc-${uuidv4()}`;
  const now = Date.now();

  const item = {
    broadcast_id,
    org_id,
    created_by: created_by || null,
    kind, // 'immediate' | 'scheduled'
    status: scheduled_for ? 'scheduled' : 'sending',
    platforms,
    caption: caption || '',
    media_url: media_url || null,
    auto_rsvp: !!auto_rsvp,
    rsvp_url: rsvp_url || null,
    wa_template: wa_template || null,
    results: {},
    created_at: now,
    updated_at: now,
  };
  if (scheduled_for) item.scheduled_for = scheduled_for;

  await dynamodb.send(new PutCommand({ TableName: BROADCASTS_TABLE, Item: item }));
  return item;
}

async function getBroadcast(broadcast_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: BROADCASTS_TABLE, Key: { broadcast_id } }));
  return result.Item || null;
}

// Deriving overall status from per-platform results: 'sent' only once every
// platform in the batch has come back successful; 'failed' only once every
// one of them has failed; anything else (some succeeded, some failed, or
// still missing entries) is 'partial' — including while mid-flight, since a
// batch's platforms send in parallel and this can be read before all of
// them have reported in. The row settles into its final status once
// finishBroadcast (routes/broadcast.js) has recorded every platform.
function computeStatus(platforms, results) {
  const settled = platforms.map(p => results[p]).filter(Boolean);
  if (settled.length < platforms.length) return 'partial';
  const allOk = settled.every(r => r.success);
  if (allOk) return 'sent';
  const allFailed = settled.every(r => !r.success);
  return allFailed ? 'failed' : 'partial';
}

/**
 * Record one platform's outcome on a broadcast row. Read-modify-write
 * rather than a single atomic UpdateExpression — same tradeoff
 * organizations.js's recordAiImageUsage already makes for the same reason:
 * DynamoDB can't SET a nested path (results.whatsapp) whose parent map
 * isn't already confirmed present in that same expression, and this
 * table's batches are small (2-3 platforms, sent within the same second),
 * so the realistic race window is tiny. Safe to call from both the
 * immediate-send path and the scheduler.
 */
async function recordPlatformResult(broadcast_id, platform, result) {
  const current = await getBroadcast(broadcast_id);
  if (!current) return null;

  const results = { ...(current.results || {}), [platform]: result };
  const status = computeStatus(current.platforms || [platform], results);
  const now = Date.now();

  await dynamodb.send(new UpdateCommand({
    TableName: BROADCASTS_TABLE,
    Key: { broadcast_id },
    UpdateExpression: 'SET #results = :results, #status = :status, updated_at = :now, sent_at = if_not_exists(sent_at, :now)',
    ExpressionAttributeNames: { '#results': 'results', '#status': 'status' },
    ExpressionAttributeValues: { ':results': results, ':status': status, ':now': now },
  }));

  return { ...current, results, status, updated_at: now };
}

/**
 * Claim a scheduled broadcast right before actually sending it — a
 * conditional update (only succeeds if status is still 'scheduled') so
 * that if the poller's interval ever overlaps itself (a send that runs
 * long) or the app ever scales to more than one instance, only one caller
 * can ever move a given row past 'scheduled'. Returns the claimed item, or
 * null if someone/something else already claimed it.
 */
async function claimScheduledBroadcast(broadcast_id) {
  try {
    const result = await dynamodb.send(new UpdateCommand({
      TableName: BROADCASTS_TABLE,
      Key: { broadcast_id },
      UpdateExpression: 'SET #status = :sending, updated_at = :now',
      ConditionExpression: '#status = :scheduled',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':sending': 'sending', ':scheduled': 'scheduled', ':now': Date.now() },
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

/** Cancel a still-pending scheduled broadcast — refuses once it's fired. */
async function cancelScheduledBroadcast(broadcast_id, org_id) {
  const current = await getBroadcast(broadcast_id);
  if (!current || current.org_id !== org_id) return { error: 'not_found' };
  if (current.status !== 'scheduled') return { error: 'already_sent' };

  await dynamodb.send(new UpdateCommand({
    TableName: BROADCASTS_TABLE,
    Key: { broadcast_id },
    UpdateExpression: 'SET #status = :cancelled, updated_at = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':cancelled': 'cancelled', ':now': Date.now() },
  }));
  return { success: true };
}

/** This org's broadcast history (sent + scheduled + cancelled), newest first. */
async function listBroadcastsForOrg(org_id, { limit = 30, cursor } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: BROADCASTS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
    ScanIndexForward: false, // newest created_at first
    Limit: limit,
    ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) : undefined,
  }));

  return {
    items: result.Items || [],
    cursor: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null,
  };
}

/** Every scheduled broadcast due to fire by `now` — the poller's one query. */
async function listDueScheduledBroadcasts(now = Date.now()) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: BROADCASTS_TABLE,
    IndexName: 'status-index',
    KeyConditionExpression: '#status = :scheduled AND scheduled_for <= :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':scheduled': 'scheduled', ':now': now },
  }));
  return result.Items || [];
}

module.exports = {
  createBroadcast,
  getBroadcast,
  recordPlatformResult,
  claimScheduledBroadcast,
  cancelScheduledBroadcast,
  listBroadcastsForOrg,
  listDueScheduledBroadcasts,
  BROADCASTS_TABLE,
};
