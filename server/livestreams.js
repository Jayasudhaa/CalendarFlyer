/**
 * server/livestreams.js — data access for admin-uploaded "event glimpse"
 * videos (`calendarfly_livestreams` — see dynamodb-schema.js for the
 * table/GSI definitions; the table keeps its original name for
 * infra/deploy continuity even though it no longer holds real-time
 * livestreams). Used by routes/livestreams.js.
 *
 * A glimpse is a short (<=15s), admin-uploaded video clip -- a quick
 * preview, not a real-time broadcast. Picking an event is optional: if
 * there's a matching event that day it's tagged with `event_id` (and only
 * then does it appear on that event's own page); otherwise it's just
 * tagged with `date` and only shows up in the org-wide reel. There is no
 * scheduling and no live/ended status: a row exists the moment its upload
 * finishes, visible to whoever `visibility` allows from that point on.
 * Uploads are capped at MAX_GLIMPSES_PER_EVENT per group -- per event when
 * one's attached, per calendar day otherwise (see countGlimpsesForGroup).
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const LIVESTREAMS_TABLE = 'calendarfly_livestreams';

// Mirrors the "Visibility options" list from the Media spec exactly, so
// the same set of values is valid for both a glimpse video and a photo
// album (see photoAlbums.js) and the frontend can share one
// <VisibilitySelect>.
const VISIBILITY_OPTIONS = ['public', 'link_only', 'verified_attendees', 'members_only', 'private', 'hidden'];

const MAX_GLIMPSE_SECONDS = 15;
const MAX_GLIMPSES_PER_EVENT = 10;

async function createStream(org_id, created_by, data) {
  const stream_id = `glimpse-${uuidv4()}`;
  const now = Date.now();
  const item = {
    stream_id,
    org_id,
    date: data.date,
    title: data.title || '',
    video_url: data.video_url,
    video_key: data.video_key,
    duration_seconds: data.duration_seconds,
    cover_image_url: data.cover_image_url || null,
    visibility: VISIBILITY_OPTIONS.includes(data.visibility) ? data.visibility : 'public',
    created_by,
    created_at: now,
    updated_at: now,
    // Both of this table's GSIs (org-index, event-index -- see
    // dynamodb-schema.js) still use start_time as their sort key, a
    // holdover from this table's original real-time-broadcast design.
    // DynamoDB doesn't error on a PutItem missing a GSI's sort key -- it
    // just silently leaves that item out of the index entirely, which is
    // why every glimpse was saving fine but never showing up in any list.
    // Reusing created_at here (rather than migrating the two GSIs) avoids
    // an index rebuild; every other table this session touched already
    // keys its own indexes off created_at the same way.
    start_time: now,
  };
  // Only set event_id when a real event was picked -- leaving the
  // attribute off entirely (rather than null) keeps it out of the
  // event-index GSI, which is what lets a date-only glimpse skip event
  // pages and still show up fine in the org-wide reel.
  if (data.event_id) item.event_id = data.event_id;
  await dynamodb.send(new PutCommand({ TableName: LIVESTREAMS_TABLE, Item: item }));
  return item;
}

async function getStream(stream_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: LIVESTREAMS_TABLE, Key: { stream_id } }));
  return result.Item || null;
}

const UPDATABLE_FIELDS = ['title', 'cover_image_url', 'visibility'];

async function updateStream(stream_id, updates) {
  const names = { '#updated_at': 'updated_at' };
  const values = { ':updated_at': Date.now() };
  let setExpr = 'SET #updated_at = :updated_at';
  for (const key of UPDATABLE_FIELDS) {
    if (updates[key] !== undefined) {
      const nk = `#${key}`; const vk = `:${key}`;
      names[nk] = key; values[vk] = updates[key];
      setExpr += `, ${nk} = ${vk}`;
    }
  }
  const result = await dynamodb.send(new UpdateCommand({
    TableName: LIVESTREAMS_TABLE,
    Key: { stream_id },
    UpdateExpression: setExpr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

async function deleteStream(stream_id) {
  await dynamodb.send(new DeleteCommand({ TableName: LIVESTREAMS_TABLE, Key: { stream_id } }));
  return true;
}

/** All glimpse videos tagged to one real event, newest first. */
async function listStreamsForEvent(event_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: LIVESTREAMS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    ExpressionAttributeValues: { ':event_id': event_id },
    ScanIndexForward: false,
  }));
  return (result.Items || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

/** How many glimpses this event already has. */
async function countGlimpsesForEvent(event_id) {
  const items = await listStreamsForEvent(event_id);
  return items.length;
}

/** Media Overview's "Event glimpse videos" panel + the public org-wide
 *  reel -- every glimpse for this org, newest first. */
async function listRecentGlimpsesForOrg(org_id, { limit = 50 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: LIVESTREAMS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return (result.Items || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

/** Glimpses uploaded for a calendar day with no event attached (there's no
 *  GSI on `date`, so this filters a recent org-wide page in memory --
 *  plenty fast at this scale, and only used for the no-event upload cap). */
async function listGlimpsesForDate(org_id, date) {
  const items = await listRecentGlimpsesForOrg(org_id, { limit: 200 });
  return items.filter((s) => !s.event_id && s.date === date);
}

/** The MAX_GLIMPSES_PER_EVENT cap check, whichever group this upload
 *  belongs to: a real event when one's attached, otherwise the calendar
 *  day it's dated for. */
async function countGlimpsesForGroup(org_id, { event_id, date }) {
  if (event_id) return countGlimpsesForEvent(event_id);
  return (await listGlimpsesForDate(org_id, date)).length;
}

module.exports = {
  createStream,
  getStream,
  updateStream,
  deleteStream,
  listStreamsForEvent,
  countGlimpsesForEvent,
  listRecentGlimpsesForOrg,
  listGlimpsesForDate,
  countGlimpsesForGroup,
  VISIBILITY_OPTIONS,
  LIVESTREAMS_TABLE,
  MAX_GLIMPSE_SECONDS,
  MAX_GLIMPSES_PER_EVENT,
};
