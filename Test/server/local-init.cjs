require('./test-environment.cjs').validate(process.env);
const { DynamoDBClient, ListTablesCommand, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const db = new DynamoDBClient({ region: process.env.AWS_REGION, endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB });
(async () => {
  for (let attempt = 0; ; attempt++) {
    try { await db.send(new ListTablesCommand({})); break; }
    catch (error) { if (attempt >= 29) throw error; await new Promise(r => setTimeout(r, 1000)); }
  }
  await require('./dynamodb-schema').createTables();
  try {
    await db.send(new CreateTableCommand({
      TableName: 'temple_rsvp', BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }, { AttributeName: 'rsvpId', KeyType: 'RANGE' }],
      AttributeDefinitions: [{ AttributeName: 'eventId', AttributeType: 'S' }, { AttributeName: 'rsvpId', AttributeType: 'S' }]
    }));
  } catch (error) { if (error.name !== 'ResourceInUseException') throw error; }
  const { TableNames } = await db.send(new ListTablesCommand({}));
  if (TableNames.length < 13) throw new Error('Database initialization incomplete');
  console.log('Isolated local database ready.');
})().catch(error => { console.error(error); process.exitCode = 1; });
