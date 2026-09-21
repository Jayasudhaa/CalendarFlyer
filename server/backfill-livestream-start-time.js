/**
 * server/backfill-livestream-start-time.js — one-time fix for glimpse
 * videos saved before livestreams.js#createStream started setting
 * start_time (see that file's comment). Those rows exist in
 * calendarfly_livestreams but are invisible to both its GSIs, so this
 * scans the base table directly (no GSI needed for a Scan) and backfills
 * start_time = created_at for anything missing it.
 *
 * Run once from server/: node backfill-livestream-start-time.js
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE = 'calendarfly_livestreams';

async function main() {
  const result = await dynamodb.send(new ScanCommand({ TableName: TABLE }));
  const items = result.Items || [];
  const toFix = items.filter((i) => i.start_time === undefined);

  if (!toFix.length) {
    console.log(`Nothing to fix — all ${items.length} row(s) already have start_time.`);
    return;
  }

  for (const item of toFix) {
    await dynamodb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { stream_id: item.stream_id },
      UpdateExpression: 'SET start_time = :st',
      ExpressionAttributeValues: { ':st': item.created_at || Date.now() },
    }));
    console.log(`Fixed ${item.stream_id} (${item.title || item.date || 'untitled'})`);
  }
  console.log(`Done — fixed ${toFix.length} of ${items.length} row(s).`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
