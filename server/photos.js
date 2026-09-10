/**
 * server/photos.js — data access for the live event photo album
 * (`calendarfly_event_photos` — see dynamodb-schema.js for the table/GSI
 * definitions). Used by routes/photos.js.
 *
 * `status` on a row is one of:
 *   'live'            — passed moderation (or moderation was inconclusive
 *                        in a non-blocking way), visible in the public album.
 *   'pending_review'   — Rekognition flagged something; hidden from the
 *                        public album until an admin approves or rejects it.
 *   'rejected'         — an admin rejected it (or, in principle, a future
 *                        automated hard-block); hidden permanently, and
 *                        doesn't count against the uploader's per-event cap
 *                        (see countCappablePhotos below) so a rejected
 *                        photo doesn't cost them one of their slots.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const PHOTOS_TABLE = 'calendarfly_event_photos';

async function createPhoto(item) {
  await dynamodb.send(new PutCommand({ TableName: PHOTOS_TABLE, Item: item }));
  return item;
}

async function getPhoto(photo_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: PHOTOS_TABLE, Key: { photo_id } }));
  return result.Item || null;
}

/**
 * How many photos this member has already uploaded to this event that
 * still count against their cap — everything except 'rejected' (see the
 * file header). Queried, not scanned: event-index already gives us "every
 * photo for this event," filtered here to just this member's.
 */
async function countCappablePhotosForMember(event_id, member_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTOS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    FilterExpression: 'member_id = :member_id AND #status <> :rejected',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':event_id': event_id, ':member_id': member_id, ':rejected': 'rejected' },
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

/** Same idea, but the whole event's total rather than one member's. */
async function countCappablePhotosForEvent(event_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTOS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    FilterExpression: '#status <> :rejected',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':event_id': event_id, ':rejected': 'rejected' },
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

/** The public album — only 'live' photos, newest first. */
async function listLivePhotosForEvent(event_id, { limit = 100 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTOS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    FilterExpression: '#status = :live',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':event_id': event_id, ':live': 'live' },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

/** Admin moderation queue — one org's pending_review photos, oldest first (first flagged, first reviewed). */
async function listPendingReviewForOrg(org_id, { limit = 50 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTOS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    FilterExpression: '#status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':org_id': org_id, ':pending': 'pending_review' },
    ScanIndexForward: true,
    Limit: limit,
  }));
  return result.Items || [];
}

async function setPhotoStatus(photo_id, status, extra = {}) {
  const names = { '#status': 'status' };
  const values = { ':status': status, ':now': Date.now() };
  let setExpr = 'SET #status = :status, moderated_at = :now';
  Object.entries(extra).forEach(([k, v], i) => {
    const nk = `#e${i}`; const vk = `:e${i}`;
    names[nk] = k; values[vk] = v;
    setExpr += `, ${nk} = ${vk}`;
  });
  await dynamodb.send(new UpdateCommand({
    TableName: PHOTOS_TABLE,
    Key: { photo_id },
    UpdateExpression: setExpr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

module.exports = {
  createPhoto,
  getPhoto,
  countCappablePhotosForMember,
  countCappablePhotosForEvent,
  listLivePhotosForEvent,
  listPendingReviewForOrg,
  setPhotoStatus,
  PHOTOS_TABLE,
};
