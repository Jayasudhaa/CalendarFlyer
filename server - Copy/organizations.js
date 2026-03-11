/**
 * Organization Management Module
 * Handles CRUD operations for organizations (tenants)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const ORGANIZATIONS_TABLE = 'calendarfly_organizations';

// Feature flags for different plans
const PLAN_FEATURES = {
  free: {
    calendar: true,
    flyer_editor: false,
    broadcast: false,
    rsvp: false,
    chatbot: false,
    temple_library: false,
    analytics: false,
    custom_domain: false,
    api_access: false
  },
  starter: {
    calendar: true,
    flyer_editor: true,
    broadcast: true,
    rsvp: true,
    chatbot: true,
    temple_library: true,
    analytics: false,
    custom_domain: false,
    api_access: false
  },
  pro: {
    calendar: true,
    flyer_editor: true,
    broadcast: true,
    rsvp: true,
    chatbot: true,
    temple_library: true,
    analytics: true,
    custom_domain: false,
    api_access: false
  },
  enterprise: {
    calendar: true,
    flyer_editor: true,
    broadcast: true,
    rsvp: true,
    chatbot: true,
    temple_library: true,
    analytics: true,
    custom_domain: true,
    api_access: true,
    white_label: true
  }
};

const PLAN_LIMITS = {
  free: {
    events_per_month: 10,
    flyers_per_month: 0,
    rsvp_responses: 50,
    chatbot_messages: 0,
    users: 1,
    storage_gb: 1
  },
  starter: {
    events_per_month: 50,
    flyers_per_month: 20,
    rsvp_responses: 500,
    chatbot_messages: 500,
    users: 3,
    storage_gb: 5
  },
  pro: {
    events_per_month: -1,  // unlimited
    flyers_per_month: -1,
    rsvp_responses: -1,
    chatbot_messages: 2000,
    users: 10,
    storage_gb: 20
  },
  enterprise: {
    events_per_month: -1,
    flyers_per_month: -1,
    rsvp_responses: -1,
    chatbot_messages: -1,
    users: -1,
    storage_gb: 100
  }
};

/**
 * Create a new organization
 */
async function createOrganization(data) {
  const org_id = `org-${uuidv4()}`;
  const plan = data.plan || 'free';
  
  const organization = {
    org_id,
    name: data.name,
    subdomain: data.subdomain,
    custom_domain: data.custom_domain || null,
    logo_url: data.logo_url || null,
    primary_color: data.primary_color || '#ea580c',
    secondary_color: data.secondary_color || '#fff7ed',
    plan: plan,
    stripe_customer_id: data.stripe_customer_id || null,
    stripe_subscription_id: data.stripe_subscription_id || null,
    trial_ends_at: data.trial_ends_at || (Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    features: PLAN_FEATURES[plan],
    limits: PLAN_LIMITS[plan],
    usage: {
      events_this_month: 0,
      flyers_this_month: 0,
      rsvp_responses_this_month: 0,
      chatbot_messages_this_month: 0,
      storage_used_gb: 0
    },
    created_at: Date.now(),
    updated_at: Date.now()
  };

  await dynamodb.send(new PutCommand({
    TableName: ORGANIZATIONS_TABLE,
    Item: organization
  }));

  return organization;
}

/**
 * Get organization by ID
 */
async function getOrganization(org_id) {
  const result = await dynamodb.send(new GetCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id }
  }));

  return result.Item;
}

/**
 * Get organization by subdomain
 */
async function getOrganizationBySubdomain(subdomain) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: ORGANIZATIONS_TABLE,
    IndexName: 'subdomain-index',
    KeyConditionExpression: 'subdomain = :subdomain',
    ExpressionAttributeValues: {
      ':subdomain': subdomain
    }
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Get organization by custom domain
 */
async function getOrganizationByDomain(domain) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: ORGANIZATIONS_TABLE,
    FilterExpression: 'custom_domain = :domain',
    ExpressionAttributeValues: {
      ':domain': domain
    }
  }));

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Update organization
 */
async function updateOrganization(org_id, updates) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updates).forEach((key, index) => {
    const placeholder = `:val${index}`;
    const namePlaceholder = `#${key}`;
    updateExpressions.push(`${namePlaceholder} = ${placeholder}`);
    expressionAttributeNames[namePlaceholder] = key;
    expressionAttributeValues[placeholder] = updates[key];
  });

  expressionAttributeNames['#updated_at'] = 'updated_at';
  expressionAttributeValues[':updated_at'] = Date.now();
  updateExpressions.push('#updated_at = :updated_at');

  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }));

  return getOrganization(org_id);
}

/**
 * Change organization plan
 */
async function changePlan(org_id, newPlan) {
  return updateOrganization(org_id, {
    plan: newPlan,
    features: PLAN_FEATURES[newPlan],
    limits: PLAN_LIMITS[newPlan]
  });
}

/**
 * Check if organization can use feature
 */
function canUseFeature(organization, feature) {
  return organization.features[feature] === true;
}

/**
 * Check if organization is within usage limits
 */
function checkLimit(organization, resource) {
  const limit = organization.limits[`${resource}_per_month`];
  const usage = organization.usage[`${resource}_this_month`];
  
  if (limit === -1) return true; // unlimited
  return usage < limit;
}

/**
 * Increment usage counter
 */
async function incrementUsage(org_id, resource) {
  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: 'ADD #usage.#resource :inc',
    ExpressionAttributeNames: {
      '#usage': 'usage',
      '#resource': `${resource}_this_month`
    },
    ExpressionAttributeValues: {
      ':inc': 1
    }
  }));
}

/**
 * Reset monthly usage (run this on 1st of each month)
 */
async function resetMonthlyUsage(org_id) {
  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: 'SET #usage = :reset',
    ExpressionAttributeNames: {
      '#usage': 'usage'
    },
    ExpressionAttributeValues: {
      ':reset': {
        events_this_month: 0,
        flyers_this_month: 0,
        rsvp_responses_this_month: 0,
        chatbot_messages_this_month: 0,
        storage_used_gb: 0
      }
    }
  }));
}

/**
 * List all organizations (admin only)
 */
async function listOrganizations() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: ORGANIZATIONS_TABLE
  }));

  return result.Items;
}

module.exports = {
  createOrganization,
  getOrganization,
  getOrganizationBySubdomain,
  getOrganizationByDomain,
  updateOrganization,
  changePlan,
  canUseFeature,
  checkLimit,
  incrementUsage,
  resetMonthlyUsage,
  listOrganizations,
  PLAN_FEATURES,
  PLAN_LIMITS
};
