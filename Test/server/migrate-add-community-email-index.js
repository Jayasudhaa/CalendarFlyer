/**
 * server/migrate-add-community-email-index.js — one-time setup for
 * switching devotee verification from phone/SMS to email (see
 * community-auth.js).
 *
 * Adds the 'org-email-index' GSI (org_id HASH, email RANGE) to the live
 * calendarfly_community_members table via UpdateTable, if it isn't there
 * yet. Editing dynamodb-schema.js alone does NOT touch a table that
 * already exists -- createTableIfMissing skips it -- so this is the step
 * that actually makes the index exist in production. Same pattern as
 * migrate-add-radar-index.js earlier in this project.
 *
 * No backfill needed: 'email' is a brand-new field going forward, there's
 * nothing on old phone-verified rows to fill in. Those old rows just won't
 * show up in the email index (expected -- they were never email-verified),
 * and org-phone-index is left untouched so they're still queryable there
 * if anything ever needs them again.
 *
 * Run once from server/: node migrate-add-community-email-index.js
 */
require('dotenv').config();
const { DynamoDBClient, DescribeTableCommand, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const TABLE = 'calendarfly_community_members';
const INDEX_NAME = 'org-email-index';

const client = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: REGION });

async function waitForIndexActive() {
  process.stdout.write('Waiting for org-email-index to finish building');
  for (;;) {
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
    const gsis = desc.Table.GlobalSecondaryIndexes || [];
    const idx = gsis.find((g) => g.IndexName === INDEX_NAME);
    if (idx && idx.IndexStatus === 'ACTIVE') {
      console.log('\norg-email-index is ACTIVE.');
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
    console.log(`org-email-index already exists (status: ${existing.IndexStatus}) — skipping creation.`);
    if (existing.IndexStatus !== 'ACTIVE') await waitForIndexActive();
    return;
  }

  console.log('Creating org-email-index on calendarfly_community_members...');
  await client.send(new UpdateTableCommand({
    TableName: TABLE,
    AttributeDefinitions: [
      { AttributeName: 'org_id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexUpdates: [
      {
        Create: {
          IndexName: INDEX_NAME,
          KeySchema: [
            { AttributeName: 'org_id', KeyType: 'HASH' },
            { AttributeName: 'email', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      },
    ],
  }));
  await waitForIndexActive();
}

async function main() {
  await ensureIndex();
  console.log('\nCommunity email-verification migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
