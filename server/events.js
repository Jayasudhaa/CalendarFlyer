/**
 * Events Data Module
 * CRUD for calendar events, always scoped to an org_id.
 * Table: calendarfly_events (partition key: event_id, GSI: org-index on org_id)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const EVENTS_TABLE = 'calendarfly_events';

// Same org, same date, same title (trimmed/case-insensitive) counts as a duplicate.
async function findDuplicateEvent(org_id, title, date) {
  if (!title || !date) return null;
  const existing = await getEventsByOrg(org_id);
  const normalizedTitle = title.trim().toLowerCase();
  return existing.find(e => e.date === date && (e.title || '').trim().toLowerCase() === normalizedTitle) || null;
}

async function createEvent(org_id, data) {
  const duplicate = await findDuplicateEvent(org_id, data.title, data.date);
  if (duplicate) {
    // Don't insert a second copy — hand back the existing event so callers
    // (manual add, template loading, JSON import) can tell it was skipped.
    return { ...duplicate, duplicate: true };
  }

  const event_id = `event-${uuidv4()}`;
  const event = {
    event_id,
    org_id,
    title: data.title,
    description: data.description || '',
    date: data.date,          // ISO date string, e.g. '2026-08-20'
    time: data.time || null,
    type: data.type || null,  // e.g. 'pooja' | 'festival' | 'holiday' | 'kalyanam' | 'abhishekam' | 'panchang'
    image_url: data.image_url || null,
    location: data.location || null,
    // Panchang-specific fields — the frontend's PanchangBadge/PanchangRow
    // read these directly when present, only falling back to parsing them
    // out of the title string for older data that predates these fields.
    tithi: data.tithi || null,
    nakshatra: data.nakshatra || null,
    moon_phase: data.moon_phase || null,
    created_at: Date.now(),
    updated_at: Date.now()
  };

  await dynamodb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: event }));
  return event;
}

async function getEventsByOrg(org_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: EVENTS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id }
  }));
  return result.Items || [];
}

async function getEvent(event_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { event_id } }));
  return result.Item || null;
}

async function updateEvent(event_id, org_id, updates) {
  const existing = await getEvent(event_id);
  if (!existing || existing.org_id !== org_id) {
    return null; // not found, or belongs to a different org — treat the same either way
  }

  const allowed = ['title', 'description', 'date', 'time', 'type', 'image_url', 'location', 'tithi', 'nakshatra', 'moon_phase'];
  const updateExpr = [];
  const exprValues = {};
  const exprNames = {};

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      updateExpr.push(`#${key} = :${key}`);
      exprValues[`:${key}`] = updates[key];
      exprNames[`#${key}`] = key;
    }
  }
  updateExpr.push('#updated_at = :updated_at');
  exprValues[':updated_at'] = Date.now();
  exprNames['#updated_at'] = 'updated_at';

  const result = await dynamodb.send(new UpdateCommand({
    TableName: EVENTS_TABLE,
    Key: { event_id },
    UpdateExpression: 'SET ' + updateExpr.join(', '),
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: exprNames,
    ReturnValues: 'ALL_NEW'
  }));
  return result.Attributes;
}

async function deleteEvent(event_id, org_id) {
  const existing = await getEvent(event_id);
  if (!existing || existing.org_id !== org_id) {
    return false;
  }
  await dynamodb.send(new DeleteCommand({ TableName: EVENTS_TABLE, Key: { event_id } }));
  return true;
}

module.exports = { createEvent, getEventsByOrg, getEvent, updateEvent, deleteEvent };
