/**
 * server/utils/instagramCandidates.js — the review queue for event
 * candidates pulled from Instagram (either an org's own connected account
 * via lib/instagramClient.getRecentMedia, or a one-off pasted post link via
 * utils/instagramOembed.js). Nothing here ever becomes a real calendar
 * event on its own -- routes/instagramEvents.js's approve step is the only
 * path from a candidate row to events.js's createEvent().
 *
 * Table: calendarfly_instagram_candidates (partition key: candidate_id,
 * GSI org-index on org_id + created_at -- same shape as calendarfly_documents).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const CANDIDATES_TABLE = 'calendarfly_instagram_candidates';

async function listCandidatesForOrg(org_id, { includeResolved = false } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: CANDIDATES_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :o',
    ExpressionAttributeValues: { ':o': org_id },
    ScanIndexForward: false,
  }));
  const items = result.Items || [];
  return includeResolved ? items : items.filter((c) => c.status === 'pending');
}

// A source_id (the Instagram media id, or the pasted post URL for the
// oEmbed path) is unique per org -- re-syncing the same connected account,
// or pasting the same link twice, should find the existing row instead of
// creating a duplicate. No dedicated GSI for this lookup (a single org's
// queue is small -- tens, not thousands, of rows), so it's the same Query-
// then-filter-in-memory tradeoff this app already makes for similarly
// small per-org collections.
async function findExistingCandidate(org_id, source_id) {
  const items = await listCandidatesForOrg(org_id, { includeResolved: true });
  return items.find((c) => c.source_id === source_id) || null;
}

/**
 * Adds a new candidate row, or hands back the existing one if this exact
 * source_id was already seen for this org (a re-sync should never
 * resurrect something already approved/rejected, or duplicate a still-
 * pending row). Returns { item, created } so callers can report an
 * accurate "N new" count without guessing from timestamps.
 */
async function upsertCandidate(org_id, {
  source, source_id, source_url, caption, media_url, posted_at, parsed,
}) {
  const existing = await findExistingCandidate(org_id, source_id);
  if (existing) return { item: existing, created: false };

  const candidate_id = `igc-${uuidv4()}`;
  const item = {
    candidate_id,
    org_id,
    source,               // 'connected_account' | 'pasted_link'
    source_id,            // Instagram media id, or the pasted URL itself
    source_url: source_url || null,
    caption: (caption || '').slice(0, 4000),
    media_url: media_url || null,
    posted_at: posted_at || null,
    parsed: parsed || null, // { is_event, title, date, time, location, confidence } or null
    status: 'pending',      // 'pending' | 'approved' | 'rejected'
    event_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await dynamodb.send(new PutCommand({ TableName: CANDIDATES_TABLE, Item: item }));
  return { item, created: true };
}

async function getCandidate(candidate_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: CANDIDATES_TABLE, Key: { candidate_id } }));
  return result.Item || null;
}

async function updateCandidateStatus(candidate_id, status, event_id = null) {
  await dynamodb.send(new UpdateCommand({
    TableName: CANDIDATES_TABLE,
    Key: { candidate_id },
    UpdateExpression: 'SET #status = :s, event_id = :e, updated_at = :u',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':s': status, ':e': event_id, ':u': Date.now() },
  }));
}

module.exports = { upsertCandidate, listCandidatesForOrg, getCandidate, updateCandidateStatus };
