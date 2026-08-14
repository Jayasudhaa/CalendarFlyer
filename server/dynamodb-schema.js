/**
 * DynamoDB Schema for CalendarFly Multi-Tenant
 * Run this to create the organizations table
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config();

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });

// Organizations Table
const organizationsTableParams = {
  TableName: 'calendarfly_organizations',
  KeySchema: [
    { AttributeName: 'org_id', KeyType: 'HASH' }  // Partition key
  ],
  AttributeDefinitions: [
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'subdomain', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'subdomain-index',
      KeySchema: [
        { AttributeName: 'subdomain', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Users Table (multi-tenant)
const usersTableParams = {
  TableName: 'calendarfly_users',
  KeySchema: [
    { AttributeName: 'user_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'user_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'email-index',
      KeySchema: [
        { AttributeName: 'email', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Events Table (multi-tenant) - Enhanced version of temple_rsvp
const eventsTableParams = {
  TableName: 'calendarfly_events',
  KeySchema: [
    { AttributeName: 'event_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Create tables
async function createTables() {
  try {
    console.log('Creating calendarfly_organizations table...');
    await dynamodb.send(new CreateTableCommand(organizationsTableParams));
    console.log('✓ Organizations table created');

    console.log('Creating calendarfly_users table...');
    await dynamodb.send(new CreateTableCommand(usersTableParams));
    console.log('✓ Users table created');

    console.log('Creating calendarfly_events table...');
    await dynamodb.send(new CreateTableCommand(eventsTableParams));
    console.log('✓ Events table created');

    console.log('\n✓ All tables created successfully!');
    console.log('\nWaiting for tables to be active...');
    
    // Wait for tables to be active
    await waitForTable('calendarfly_organizations');
    await waitForTable('calendarfly_users');
    await waitForTable('calendarfly_events');

    console.log('✓ All tables are now active!');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('⚠ Tables already exist');
    } else {
      console.error('Error creating tables:', error);
    }
  }
}

async function waitForTable(tableName) {
  let tries = 0;
  const maxTries = 30;
  while (tries < maxTries) {
    try {
      const result = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
      if (result.Table.TableStatus === 'ACTIVE') {
        console.log(`✓ ${tableName} is active`);
        return;
      }
    } catch (e) {
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    tries++;
  }
  throw new Error(`Timeout waiting for ${tableName}`);
}
// Run if called directly
if (require.main === module) {
  createTables();
}

module.exports = { createTables };
