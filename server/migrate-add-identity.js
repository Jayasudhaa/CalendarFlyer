/**
 * server/migrate-add-identity.js — one-time setup for the cross-org
 * "Community Passport" identity (see identity-auth.js), Phase 1 of the
 * Community Radar personalization plan.
 *
 * Does three things against the live tables, each safely re-runnable:
 *   1. Ensures 'org-email-index' exists on calendarfly_community_members
 *      (org_id HASH, email RANGE) -- this is the same index the earlier
 *      email-verification migration (migrate-add-community-email-index.js)
 *      added. If that script already ran, this is a no-op for it; if it
 *      never ran, this covers it too, so there's only one script left to
 *      run for anyone starting from scratch.
 *   2. Adds 'email-index' to calendarfly_community_members (email HASH
 *      only, no range) -- the reverse lookup identity-auth.js needs to
 *      answer "which orgs has this email followed", across every org, in
 *      one Query instead of a table scan.
 *   3. Creates calendarfly_identities (brand-new table, not a GSI-on-
 *      existing-table, so this step is a plain CreateTable) with its own
 *      'email-index' for "does this email already have an identity".
 *
 * DynamoDB only allows one GSI create per UpdateTable call on a table
 * that already exists, so steps 1 and 2 run sequentially, each polled to
 * ACTIVE before the next starts.
 *
 * Run once from server/: node migrate-add-identity.js
 */
require('dotenv').config();
const {
  DynamoDBClient, DescribeTableCommand, UpdateTableCommand, CreateTableCommand,
} = require('@aws-sdk/client-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-2';
const MEMBERS_TABLE = 'calendarfly_community_members';
const IDENTITIES_TABLE = 'calendarfly_identities';

const client = new DynamoDBClient({ region: REGION });

async function waitForGsiActive(tableName, indexName) {
  process.stdout.write(`Waiting for ${indexName} on ${tableName} to finish building`);
  for (;;) {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    const gsis = desc.Table.GlobalSecondaryIndexes || [];
    const idx = gsis.find((g) => g.IndexName === indexName);
    if (idx && idx.IndexStatus === 'ACTIVE') {
      console.log(`\n${indexName} is ACTIVE.`);
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function waitForTableActive(tableName) {
  process.stdout.write(`Waiting for ${tableName} to finish creating`);
  for (;;) {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (desc.Table.TableStatus === 'ACTIVE') {
      console.log(`\n${tableName} is ACTIVE.`);
      return;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function ensureMembersGsi(indexName, keySchema, extraAttrs) {
  const desc = await client.send(new DescribeTableCommand({ TableName: MEMBERS_TABLE }));
  const gsis = desc.Table.GlobalSecondaryIndexes || [];
  const existing = gsis.find((g) => g.IndexName === indexName);

  if (existing) {
    console.log(`${indexName} already exists on ${MEMBERS_TABLE} (status: ${existing.IndexStatus}) — skipping creation.`);
    if (existing.IndexStatus !== 'ACTIVE') await waitForGsiActive(MEMBERS_TABLE, indexName);
    return;
  }

  console.log(`Creating ${indexName} on ${MEMBERS_TABLE}...`);
  await client.send(new UpdateTableCommand({
    TableName: MEMBERS_TABLE,
    AttributeDefinitions: extraAttrs,
    GlobalSecondaryIndexUpdates: [
      {
        Create: {
          IndexName: indexName,
          KeySchema: keySchema,
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      },
    ],
  }));
  await waitForGsiActive(MEMBERS_TABLE, indexName);
}

async function ensureIdentitiesTable() {
  try {
    const desc = await client.send(new DescribeTableCommand({ TableName: IDENTITIES_TABLE }));
    console.log(`${IDENTITIES_TABLE} already exists (status: ${desc.Table.TableStatus}) — skipping creation.`);
    if (desc.Table.TableStatus !== 'ACTIVE') await waitForTableActive(IDENTITIES_TABLE);
    return;
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') throw err;
  }

  console.log(`Creating ${IDENTITIES_TABLE}...`);
  await client.send(new CreateTableCommand({
    TableName: IDENTITIES_TABLE,
    KeySchema: [{ AttributeName: 'identity_id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'identity_id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  }));
  await waitForTableActive(IDENTITIES_TABLE);
}

async function main() {
  await ensureMembersGsi(
    'org-email-index',
    [{ AttributeName: 'org_id', KeyType: 'HASH' }, { AttributeName: 'email', KeyType: 'RANGE' }],
    [{ AttributeName: 'org_id', AttributeType: 'S' }, { AttributeName: 'email', AttributeType: 'S' }],
  );
  await ensureMembersGsi(
    'email-index',
    [{ AttributeName: 'email', KeyType: 'HASH' }],
    [{ AttributeName: 'email', AttributeType: 'S' }],
  );
  await ensureIdentitiesTable();
  console.log('\nCommunity Passport identity migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
