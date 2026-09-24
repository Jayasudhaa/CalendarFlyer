/**
 * server/signups.js -- data access for the Sign-Up Sheets feature
 * (`calendarfly_signup_sheets` / `_signup_slots` / `_signup_entries` -- see
 * dynamodb-schema.js for the table/GSI definitions). Used by
 * routes/signups.js.
 *
 * One Sheet (e.g. "Ganesh Chaturthi -- Volunteers") holds several Slots (a
 * shift, or a potluck dish category); a devotee joining a Slot creates an
 * Entry. entry.status is one of:
 *   'confirmed'  -- counts against the slot's capacity, a filled spot.
 *   'waitlisted' -- slot was full when they joined; promoted to
 *                   'confirmed' automatically if a confirmed entry on the
 *                   same slot is cancelled (see promoteFromWaitlist).
 *   'cancelled'  -- no longer counts toward capacity or volunteer hours.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const SHEETS_TABLE = 'calendarfly_signup_sheets';
const SLOTS_TABLE = 'calendarfly_signup_slots';
const ENTRIES_TABLE = 'calendarfly_signup_entries';

// ── Sheets ───────────────────────────────────────────────────────────────

async function createSheet(item) {
  await dynamodb.send(new PutCommand({ TableName: SHEETS_TABLE, Item: item }));
  return item;
}

async function getSheet(sheet_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: SHEETS_TABLE, Key: { sheet_id } }));
  return result.Item || null;
}

/** Every sheet ever created for one event -- admin + devotee pages both start here. */
async function listSheetsForEvent(event_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: SHEETS_TABLE,
    IndexName: 'event-index',
    KeyConditionExpression: 'event_id = :event_id',
    ExpressionAttributeValues: { ':event_id': event_id },
    ScanIndexForward: true,
  }));
  return result.Items || [];
}

/** All of one org's sheets, newest first -- the admin Sign-Ups dashboard landing list. */
async function listSheetsForOrg(org_id, { limit = 100 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: SHEETS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

async function deleteSheet(sheet_id) {
  await dynamodb.send(new DeleteCommand({ TableName: SHEETS_TABLE, Key: { sheet_id } }));
}

// ── Slots ────────────────────────────────────────────────────────────────

async function createSlot(item) {
  await dynamodb.send(new PutCommand({ TableName: SLOTS_TABLE, Item: item }));
  return item;
}

async function getSlot(slot_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: SLOTS_TABLE, Key: { slot_id } }));
  return result.Item || null;
}

async function listSlotsForSheet(sheet_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: SLOTS_TABLE,
    IndexName: 'sheet-index',
    KeyConditionExpression: 'sheet_id = :sheet_id',
    ExpressionAttributeValues: { ':sheet_id': sheet_id },
    ScanIndexForward: true,
  }));
  return result.Items || [];
}

async function deleteSlot(slot_id) {
  await dynamodb.send(new DeleteCommand({ TableName: SLOTS_TABLE, Key: { slot_id } }));
}

// ── Entries ──────────────────────────────────────────────────────────────

async function createEntry(item) {
  await dynamodb.send(new PutCommand({ TableName: ENTRIES_TABLE, Item: item }));
  return item;
}

async function getEntry(entry_id) {
  const result = await dynamodb.send(new GetCommand({ TableName: ENTRIES_TABLE, Key: { entry_id } }));
  return result.Item || null;
}

/** Every non-cancelled entry on a slot, oldest first -- FIFO order for waitlist promotion. */
async function listActiveEntriesForSlot(slot_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ENTRIES_TABLE,
    IndexName: 'slot-index',
    KeyConditionExpression: 'slot_id = :slot_id',
    FilterExpression: '#status <> :cancelled',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':slot_id': slot_id, ':cancelled': 'cancelled' },
    ScanIndexForward: true,
  }));
  return result.Items || [];
}

/** Every non-cancelled entry across a whole sheet -- the admin sheet-detail view. */
async function listActiveEntriesForSheet(sheet_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ENTRIES_TABLE,
    IndexName: 'sheet-index',
    KeyConditionExpression: 'sheet_id = :sheet_id',
    FilterExpression: '#status <> :cancelled',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':sheet_id': sheet_id, ':cancelled': 'cancelled' },
    ScanIndexForward: true,
  }));
  return result.Items || [];
}

/** One devotee's own sign-up history -- "my sign-ups" + the volunteer-hours total below. */
async function listEntriesForMember(member_id, { limit = 200 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ENTRIES_TABLE,
    IndexName: 'member-index',
    KeyConditionExpression: 'member_id = :member_id',
    ExpressionAttributeValues: { ':member_id': member_id },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

/** Every non-cancelled entry for a whole org -- backs the volunteer-hours leaderboard below. */
async function listActiveEntriesForOrg(org_id, { limit = 2000 } = {}) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ENTRIES_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    FilterExpression: '#status <> :cancelled',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':org_id': org_id, ':cancelled': 'cancelled' },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

async function setEntryStatus(entry_id, status) {
  await dynamodb.send(new UpdateCommand({
    TableName: ENTRIES_TABLE,
    Key: { entry_id },
    UpdateExpression: 'SET #status = :status, updated_at = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status, ':now': Date.now() },
  }));
}

/**
 * Cancelling a confirmed entry can free up a spot -- promotes the earliest
 * still-waitlisted entry on the same slot to 'confirmed', if there is one.
 * Returns the promoted entry, or null if nobody was waiting. Callers
 * (routes/signups.js) run this right after cancelling a *confirmed* entry;
 * cancelling an already-waitlisted one never needs it -- nothing freed up.
 */
async function promoteFromWaitlist(slot_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ENTRIES_TABLE,
    IndexName: 'slot-index',
    KeyConditionExpression: 'slot_id = :slot_id',
    FilterExpression: '#status = :waitlisted',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':slot_id': slot_id, ':waitlisted': 'waitlisted' },
    ScanIndexForward: true,
    Limit: 1,
  }));
  const next = (result.Items || [])[0];
  if (!next) return null;
  await setEntryStatus(next.entry_id, 'confirmed');
  return { ...next, status: 'confirmed' };
}

/**
 * Org-wide volunteer-hours report -- every member with at least one
 * confirmed volunteer shift for this org, most minutes first. Powers the
 * admin Sign-Ups dashboard's "Volunteer Hours" tab (certificate/report
 * backup use case). Potluck entries never carry duration_minutes (see
 * routes/signups.js), so they drop out on their own here.
 */
async function volunteerHoursReportForOrg(org_id) {
  const entries = await listActiveEntriesForOrg(org_id);
  const byMember = new Map();
  for (const e of entries) {
    if (e.status !== 'confirmed' || !e.duration_minutes || !e.member_id) continue;
    const row = byMember.get(e.member_id) || { member_id: e.member_id, member_name: e.member_name, totalMinutes: 0, shiftsCount: 0 };
    row.totalMinutes += e.duration_minutes;
    row.shiftsCount += 1;
    byMember.set(e.member_id, row);
  }
  return Array.from(byMember.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** Same idea as the org-wide report above, but for one member's own total (any org). */
function summarizeVolunteerMinutes(entries) {
  const confirmed = entries.filter((e) => e.status === 'confirmed' && e.duration_minutes);
  const totalMinutes = confirmed.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  return { totalMinutes, shiftsCount: confirmed.length };
}

module.exports = {
  SHEETS_TABLE, SLOTS_TABLE, ENTRIES_TABLE,
  createSheet, getSheet, listSheetsForEvent, listSheetsForOrg, deleteSheet,
  createSlot, getSlot, listSlotsForSheet, deleteSlot,
  createEntry, getEntry, listActiveEntriesForSlot,
  listActiveEntriesForSheet, listEntriesForMember, listActiveEntriesForOrg,
  setEntryStatus, promoteFromWaitlist, volunteerHoursReportForOrg, summarizeVolunteerMinutes,
};
