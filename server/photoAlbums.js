/**
 * server/photoAlbums.js — data access for photo album settings/metadata
 * (`calendarfly_photo_albums` — see dynamodb-schema.js for the table/GSI
 * definitions). Used by routes/photoAlbums.js.
 *
 * This table is the admin-facing "album" wrapper (name, cover, visibility,
 * upload/download/approval settings) around the photos that already live
 * in calendarfly_event_photos (server/photos.js), keyed by event_id. An
 * album row doesn't hold photos itself; routes/photoAlbums.js joins the
 * two by event_id (and, once a photo is registered against a specific
 * album, by album_id) the same way routes/photos.js already re-derives an
 * event's org rather than trusting a caller-supplied id.
 *
 * `publishing_status` is one of:
 *   'draft'     — visible to admins only, never shown on the public site
 *                 regardless of `visibility`.
 *   'published' — live per its `visibility` setting.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const PHOTO_ALBUMS_TABLE = 'calendarfly_photo_albums';

// Same six-way visibility model as livestreams.js's VISIBILITY_OPTIONS —
// kept as its own copy (rather than a shared import) because the two
// tables/routes files are otherwise fully independent of each other, and
// this one small array isn't worth a coupling between them.
const VISIBILITY_OPTIONS = ['public', 'link_only', 'verified_attendees', 'members_only', 'private', 'hidden'];

async function createAlbum(org_id, created_by, data) {
  const album_id = `album-${uuidv4()}`;
  const now = Date.now();
  // event_id is usually a real event, but the "quick add photos" flow
  // (routes/photos.js's admin upload routes, via getOrCreateQuickAlbum
  // below) lets an admin skip picking one -- same reasoning as
  // livestreams.js's date-only glimpses. Rather than leaving event_id out
  // of the item, which would need a second, parallel way to query "this
  // org's date-only albums," a synthetic id is used so every album row
  // still keys into the existing event-index GSI the same way, whether
  // the event is real or not.
  const event_id = data.event_id || `noevent-${org_id}-${data.date}`;
  const item = {
    album_id,
    org_id,
    event_id,
    date: data.date || null,
    name: data.name || '',
    cover_photo_url: data.cover_photo_url || null,
    description: data.description || '',
    photographer: data.photographer || '',
    visibility: VISIBILITY_OPTIONS.includes(data.visibility) ? data.visibility : 'public',
    download_permission: !!data.download_permission,
    // Attendee uploads always land in moderation first, no matter what --
    // see routes/photos.js's register handler. This flag only controls
    // whether an admin ALSO has to sign off on photos the admin
    // themselves adds directly to the album.
    attendee_uploads_enabled: data.attendee_uploads_enabled !== false,
    approval_required: data.approval_required !== false,
    publishing_status: data.publishing_status === 'published' ? 'published' : 'draft',
    // Child-safety defaults from the Media spec's "Best access model" --
    // off by default for every album, explicitly turned on by an admin
    // who wants recognition/attribution/downloads for a given event.
    disable_facial_recognition: data.disable_facial_recognition !== false,
    hide_contributor_names: !!data.hide_contributor_names,
    photo_count: 0,
    created_by,
    created_at: now,
    updated_at: now,
  };
  await dynamodb.send(new PutCommand({ TableName: PHOTO_ALBUMS_TABLE, Item: item }));
  return item;
}

/**
 * The "quick add photos" flow (routes/photos.js's admin upload routes)
 * needs *an* album to stamp photos with, but the whole point of that flow
 * is that the admin never sees or fills out an album settings form. This
 * finds the one album already backing a given event/date group, or spins
 * up a sensibly-defaulted one -- published immediately, no approval step,
 * since these are the admin's own trusted uploads -- the first time a
 * photo lands in that group.
 */
async function getOrCreateQuickAlbum(org_id, created_by, { event_id, date }) {
  const key_event_id = event_id || `noevent-${org_id}-${date}`;
  const existing = (await listAlbumsForEvent(key_event_id)).find((a) => a.org_id === org_id);
  if (existing) return existing;
  return createAlbum(org_id, created_by, {
    event_id: event_id || null,
    date: date || null,
    name: '',
    visibility: 'public',
    publishing_status: 'published',
    attendee_uploads_enabled: false,
    approval_required: false,
  });
}

async function getAlbum(album_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: PHOTO_ALBUMS_TABLE, Key: { album_id } }));
  return result.Item || null;
}

const UPDATABLE_FIELDS = [
  'name', 'cover_photo_url', 'description', 'photographer', 'visibility',
  'download_permission', 'attendee_uploads_enabled', 'approval_required',
  'publishing_status', 'disable_facial_recognition', 'hide_contributor_names',
];

async function updateAlbum(album_id, updates) {
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
    TableName: PHOTO_ALBUMS_TABLE,
    Key: { album_id },
    UpdateExpression: setExpr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

/** Called whenever a photo is approved into/removed from this album's live count. */
async function bumpPhotoCount(album_id, delta) {
  const result = await dynamodb.send(new UpdateCommand({
    TableName: PHOTO_ALBUMS_TABLE,
    Key: { album_id },
    UpdateExpression: 'SET photo_count = if_not_exists(photo_count, :zero) + :delta, updated_at = :now',
    ExpressionAttributeValues: { ':delta': delta, ':zero': 0, ':now': Date.now() },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

async function deleteAlbum(album_id) {
  await dynamodb.send(new DeleteCommand({ TableName: PHOTO_ALBUMS_TABLE, Key: { album_id } }));
  return true;
}

async function listAlbumsForEvent(event_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTO_ALBUMS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    ExpressionAttributeValues: { ':event_id': event_id },
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

/** Media Overview's "Recent albums" panel — every album for this org, newest first. */
async function listAlbumsForOrg(org_id, { limit = 50 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTO_ALBUMS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

/** Media Overview's "Published albums" summary card count. */
async function countPublishedAlbumsForOrg(org_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: PHOTO_ALBUMS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    FilterExpression: 'publishing_status = :published',
    ExpressionAttributeValues: { ':org_id': org_id, ':published': 'published' },
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

module.exports = {
  createAlbum,
  getAlbum,
  updateAlbum,
  bumpPhotoCount,
  deleteAlbum,
  getOrCreateQuickAlbum,
  listAlbumsForEvent,
  listAlbumsForOrg,
  countPublishedAlbumsForOrg,
  VISIBILITY_OPTIONS,
  PHOTO_ALBUMS_TABLE,
};
