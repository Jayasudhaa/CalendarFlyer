/**
 * server/migrate-add-radar-index.js — one-time setup for Community Radar
 * (the cross-org "discoverable events" feed, see routes/radar.js).
 *
 * Does two things, safely re-runnable:
 *   1. Adds the 'radar-index' GSI (discoverability HASH, date RANGE) to the
 *      live calendarfly_events table via UpdateTable, if it isn't there yet.
 *      Editing dynamodb-schema.js alone does NOT touch a table that already
 *      exists -- createTableIfMissing skips it -- so this is the step that
 *      actually makes the index exist in production.
 *   2. Backfills discoverability = 'org_only' onto every existing event that
 *      doesn't have it yet. Not strictly required (the app already treats a
 *      missing discoverability as 'org_only' everywhere), but it keeps every
 *      row consistent and means the radar-index projection is accurate for
 *      counting/debugging later.
 *
 * Neither step changes what's visible today: 'org_only' is the same
 * behavior every existing event already has (shown only on its own org's
 * public calendar). Nothing becomes visible in Community Radar until an
 * admin explicitly flips an event to it.
 *
 * Run once from server/: node migrate-add-radar-index.js
 */
require('dotenv').config();
const { DynamoDBClient, DescribeTableCommand, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = 'calendarfly_events';
const INDEX_NAME = 'radar-index';

const client = new DynamoDBClient({ region: REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

async function waitForIndexActive() {
  process.stdout.write('Waiting for radar-index to finish building');
  for (;;) {
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
    const gsis = desc.Table.GlobalSecondaryIndexes || [];
    const idx = gsis.find((g) => g.IndexName === INDEX_NAME);
    if (idx && idx.IndexStatus === 'ACTIVE') {
      console.log('\nradar-index is ACTIVE.');
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function ensureIndex() {
  const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
  const gsis = desc.Table.GlobalSecondaryIndexes || [];
  const existing = gsis.find((g) => g.IndexName === INDEX_NAME);

  if (existing) {
    console.log(`radar-index already exists (status: ${existing.IndexStatus}) — skipping creation.`);
    if (existing.IndexStatus !== 'ACTIVE') await waitForIndexActive();
    return;
  }

  console.log('Creating radar-index on calendarfly_events...');
  await client.send(new UpdateTableCommand({
    TableName: TABLE,
    AttributeDefinitions: [
      { AttributeName: 'discoverability', AttributeType: 'S' },
      { AttributeName: 'date', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexUpdates: [
      {
        Create: {
          IndexName: INDEX_NAME,
          KeySchema: [
            { AttributeName: 'discoverability', KeyType: 'HASH' },
            { AttributeName: 'date', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      },
    ],
  }));
  await waitForIndexActive();
}

async function backfillDiscoverability() {
  const result = await dynamodb.send(new ScanCommand({ TableName: TABLE }));
  const items = result.Items || [];
  const toFix = items.filter((i) => i.discoverability === undefined);

  if (!toFix.length) {
    console.log(`Nothing to backfill — all ${items.length} event(s) already have discoverability.`);
    return;
  }

  for (const item of toFix) {
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { event_id: item.event_id },
      UpdateExpression: 'SET discoverability = :d',
      ExpressionAttributeValues: { ':d': 'org_only' },
    }));
    console.log(`Backfilled ${item.event_id} (${item.title || item.date || 'untitled'}) -> org_only`);
  }
  console.log(`Done — backfilled ${toFix.length} of ${items.length} event(s).`);
}

async function main() {
  await ensureIndex();
  await backfillDiscoverability();
  console.log('\nCommunity Radar migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
