/**
 * Organization Management Module
 * Handles CRUD operations for organizations (tenants)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
// Used by changePlan() below to actually cancel a live Stripe subscription
// when an org downgrades to Free — see that function for why.
const { getStripe } = require('./utils/stripeClient');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(client);

const ORGANIZATIONS_TABLE = 'calendarfly_organizations';
const USERS_TABLE = 'calendarfly_users';

// Feature flags for different plans
const PLAN_FEATURES = {
  free: {
    calendar: true,
    flyer_editor: false,
    broadcast: true,
    whatsapp_broadcast: false,
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
    whatsapp_broadcast: false,
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
    whatsapp_broadcast: false,
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
    whatsapp_broadcast: true,
    rsvp: true,
    chatbot: true,
    temple_library: true,
    analytics: true,
    custom_domain: true,
    api_access: true,
    white_label: true
  }
};

// Limit key names previously didn't match what checkLimit() assumed: it
// always read `${resource}_per_month`, which matched events/flyers but not
// `rsvp_responses` or `chatbot_messages` (no suffix) — so checkLimit()
// silently read `undefined` as the limit for those two and always treated
// the org as over it. Never noticed because nothing actually called
// checkLimit() anywhere. Fixed here by renaming those two keys to match;
// `users` intentionally keeps no suffix — team size is a headcount cap,
// not a monthly quota, and is checked separately (see checkUserLimit).
const PLAN_LIMITS = {
  free: {
    events_per_month: 30,
    flyers_per_month: 30,
    rsvp_responses_per_month: 50,
    chatbot_messages_per_month: 0,
    users: 1,
    storage_gb: 1,
    ai_images_per_month: 30
  },
  starter: {
    events_per_month: 50,
    flyers_per_month: 50,
    rsvp_responses_per_month: 500,
    chatbot_messages_per_month: 500,
    users: 3,
    storage_gb: 5,
    ai_images_per_month: 150
  },
  pro: {
    events_per_month: -1,  // unlimited
    flyers_per_month: -1,
    rsvp_responses_per_month: -1,
    chatbot_messages_per_month: 2000,
    users: 10,
    storage_gb: 20,
    ai_images_per_month: -1
  },
  enterprise: {
    events_per_month: -1,
    flyers_per_month: -1,
    rsvp_responses_per_month: -1,
    chatbot_messages_per_month: -1,
    users: -1,
    storage_gb: 100,
    ai_images_per_month: -1
  }
};

// Price charged for each AI-generated image beyond the plan's free monthly
// allowance. This is a RECORD-KEEPING figure only — Checkout/webhooks now
// exist (routes/billing.js) for the subscription itself, but per-unit
// overage still isn't charged to the card automatically; it accrues on the
// org's `billing.ai_image_overage_cents` balance for now. $0.75/image is
// roughly a 3x markup over gpt-image-1's real per-image cost (~$0.25 at
// high quality/portrait size as of Aug 2026) to cover margin — adjust
// freely, it's just a constant.
const AI_IMAGE_PRICE_CENTS = 75;

// Same idea for chatbot messages (temple-bot / admin-assistant / welcome-
// intent — see routes/chat.js), which also cost real money per call
// (Anthropic API). A short Claude Sonnet completion costs a small fraction
// of a cent; 5¢/message is a healthy margin, not a cost-reflective price —
// adjust freely.
const CHATBOT_MESSAGE_PRICE_CENTS = 5;

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
    banner_url: data.banner_url || null,
    address: data.address || '',
    phone: data.phone || '',
    manager_phone: data.manager_phone || '',
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
      ai_images_this_month: 0,
      storage_used_gb: 0
    },
    // Not reset monthly — an accruing balance of what's owed for AI images
    // generated past the free monthly allowance (ai_image_overage_cents),
    // plus this org's Stripe subscription/trial state. card_on_file flips
    // true only once a Checkout Session actually completes (see
    // routes/billing.js's webhook handler) — never set it any other way.
    billing: {
      ai_image_overage_cents: 0,
      card_on_file: false,
      subscription_status: plan === 'free' ? 'none' : 'trialing'
    },
    // Self-serve guest sandboxes (POST /api/auth/guest-sandbox) set both of
    // these; every normal org leaves them false/null. sandbox_expires_at is
    // a plain stored timestamp, not a hardcoded credential+expiry — the
    // sandbox's JWT independently expires at the same time (see auth.js),
    // and runOnce()'s sandbox sweep (server/scheduler.js) uses this field to
    // actually delete the org once it's past due. A sandbox that adds a real
    // card (billing.card_on_file flips true) is never swept even if this
    // flag is still true — see listExpiredSandboxOrgs() below.
    is_sandbox: !!data.is_sandbox,
    sandbox_expires_at: data.sandbox_expires_at || null,
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
 * Downgrade an org to the free plan once its trial has ended with no card
 * on file — the "then upgrade" half of the 1-week-free-trial flow. Runs
 * lazily on every read rather than a scheduled job: no cron infrastructure
 * exists in this codebase, and a read-time check is simpler and can't
 * silently stop running. A no-op for orgs already on 'free', still inside
 * their trial window, or with a card already on file (billing.card_on_file
 * only flips true once Stripe Checkout actually completes — see
 * routes/billing.js — so this can't downgrade someone who's already paying).
 */
async function settleTrial(org) {
  if (!org) return org;

  const trialExpired = org.plan !== 'free'
    && !(org.billing && org.billing.card_on_file)
    && org.trial_ends_at
    && org.trial_ends_at <= Date.now();

  if (trialExpired) {
    console.log(`[TRIAL] Trial ended with no card for org ${org.org_id} — downgrading to free`);
    org = await updateOrganization(org.org_id, {
      plan: 'free',
      features: PLAN_FEATURES.free,
      limits: PLAN_LIMITS.free,
      billing: { ...(org.billing || {}), subscription_status: 'trial_expired' },
    });
  }

  return applyFeatureOverrides(org);
}

/**
 * Platform-admin per-org feature overrides (see PUT /api/admin/organizations/
 * :org_id/features) — lets the site owner flip a specific feature on or off
 * for one org regardless of its plan (comp a feature for a customer, kill
 * switch a feature that's misbehaving for one tenant, etc.) without having
 * to change their plan. Stored separately from `features` so a plan change
 * doesn't silently wipe a support-granted override; merged in at every read
 * so callers never have to know overrides exist — they just read
 * `org.features` like always and get the effective value.
 */
function applyFeatureOverrides(org) {
  if (!org) return org;
  // Always re-derive features/limits from the live PLAN_FEATURES/PLAN_LIMITS
  // for this org's plan (falling back to whatever was stored only if the
  // plan key is somehow missing from those constants) -- this is what makes
  // a plan-config change here apply to every existing org on that plan, not
  // just newly-created ones. feature_overrides layers on top for the rare
  // per-org support comp/kill-switch case.
  //
  // A subscription marked 'past_due' (see routes/billing.js's
  // invoice.payment_failed handler) is treated as demoted to the free
  // plan's features/limits right away, rather than riding out Stripe's
  // whole dunning window on full paid access. org.plan itself is left
  // untouched so the Subscription page can still show what plan the org
  // is actually subscribed to -- and so access is restored automatically,
  // with no separate "undo" step, the moment invoice.payment_succeeded
  // flips subscription_status back to 'active'.
  const pastDue = !!(org.billing && org.billing.subscription_status === 'past_due');
  const effectivePlan = pastDue ? 'free' : org.plan;
  const planFeatures = PLAN_FEATURES[effectivePlan] || org.features || {};
  const planLimits = PLAN_LIMITS[effectivePlan] || org.limits || {};
  return {
    ...org,
    features: { ...planFeatures, ...(org.feature_overrides || {}) },
    limits: planLimits,
  };
}

/**
 * Get organization by ID
 */
async function getOrganization(org_id) {
  const result = await dynamodb.send(new GetCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id }
  }));

  return settleTrial(result.Item);
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

  return settleTrial(result.Items && result.Items.length > 0 ? result.Items[0] : null);
}

/**
 * Get organization by custom domain
 */
/**
 * Get organization by custom domain
 * Note: This scans the table since we don't have an index on custom_domain
 * For production with many orgs, we'd add the index with sparse handling
 */
async function getOrganizationByDomain(domain) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: ORGANIZATIONS_TABLE,
    FilterExpression: 'custom_domain = :domain',
    ExpressionAttributeValues: {
      ':domain': domain
    }
  }));

  return settleTrial(result.Items && result.Items.length > 0 ? result.Items[0] : null);
}

/**
 * Get organization by Stripe customer ID — used by the billing webhook,
 * which only has Stripe object IDs to go on, not our own org_id. Same
 * scan-based tradeoff as getOrganizationByDomain above (no index on this
 * field); fine at this app's scale, worth an index if that changes.
 */
async function getOrganizationByStripeCustomerId(customerId) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: ORGANIZATIONS_TABLE,
    FilterExpression: 'stripe_customer_id = :cid',
    ExpressionAttributeValues: {
      ':cid': customerId
    }
  }));

  return settleTrial(result.Items && result.Items.length > 0 ? result.Items[0] : null);
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
 * Change organization plan.
 *
 * Downgrading away from a paid plan used to only flip plan/features/limits
 * in our own database — it never told Stripe anything, so the org's live
 * subscription kept billing every month even though this app had already
 * cut off their paid features. Now, moving to 'free' from a paid plan also
 * cancels the actual Stripe subscription first; the local downgrade only
 * happens once we know Stripe has actually stopped billing them (either we
 * canceled it just now, or it was already gone — e.g. a webhook beat us to
 * it, or it was canceled manually in the Dashboard). If Stripe can't be
 * reached or refuses for some other reason, this throws instead of silently
 * downgrading locally, so the org is never shown as "Free" while Stripe is
 * still charging their card.
 */
async function changePlan(org_id, newPlan) {
  const org = await getOrganization(org_id);
  const wasOnPaidPlan = !!(org && org.plan && org.plan !== 'free');

  let billing = (org && org.billing) || {};
  if (newPlan === 'free' && wasOnPaidPlan && org.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(org.stripe_subscription_id);
    } catch (err) {
      const alreadyGone = err.code === 'resource_missing' || /already been canceled/i.test(err.message || '');
      if (!alreadyGone) {
        console.error(`[ORG] Failed to cancel Stripe subscription ${org.stripe_subscription_id} for org ${org_id}:`, err.message);
        throw new Error('Could not cancel your subscription with Stripe — please try again in a moment or contact support.');
      }
      // else: nothing left to cancel, fall through to the local downgrade below.
    }
    billing = { ...billing, subscription_status: 'canceled' };
  }

  return updateOrganization(org_id, {
    plan: newPlan,
    features: PLAN_FEATURES[newPlan],
    limits: PLAN_LIMITS[newPlan],
    ...(newPlan === 'free' && wasOnPaidPlan ? { billing } : {}),
  });
}

/**
 * Check if organization can use feature
 */
function canUseFeature(organization, feature) {
  return organization.features[feature] === true;
}

/**
 * Check if organization is within usage limits for a monthly-resetting
 * resource ('events', 'flyers', 'rsvp_responses', or 'chatbot_messages').
 * Team size ('users') doesn't reset monthly and isn't tracked in `usage` at
 * all — use checkUserLimit() for that instead.
 */
// Comma-separated allowlist (same env var/mechanism as superAdminGuard in
// routes/admin.js and routes/organizations.js) -- these accounts never get
// gated by any plan usage limit, on any org they happen to be a member of.
// Case-insensitive, matched against the JWT's `email` claim.
function isPlatformAdminEmail(email) {
  if (!email) return false;
  const list = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(email).toLowerCase());
}

function checkLimit(organization, resource, requesterEmail) {
  if (isPlatformAdminEmail(requesterEmail)) return true; // platform owner: unlimited

  const limit = organization.limits[`${resource}_per_month`];
  // organization.usage can be entirely absent -- e.g. an org record created
  // before usage tracking existed, or the DEFAULT_ORG_ID fallback used in
  // local dev -- and indexing into undefined crashed every single event
  // create/import with "Cannot read properties of undefined (reading
  // '..._this_month')" (a 500, not a limit-reached 403). Default to {} so a
  // missing usage map just reads as "0 used so far" instead of crashing.
  const usage = (organization.usage && organization.usage[`${resource}_this_month`]) || 0;

  if (limit == null || limit === -1) return true; // unlimited, or not tracked
  return usage < limit;
}

/**
 * How many users currently belong to an org (via the org-index GSI on
 * calendarfly_users) — a live headcount, not an incrementing counter.
 * Shared by checkUserLimit() and the /me endpoint's team-usage display.
 */
async function countOrgUsers(org_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: 'calendarfly_users',
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
    Select: 'COUNT',
  }));
  return result.Count || 0;
}

/**
 * Team size is a headcount cap, not a monthly counter — checking it means
 * counting how many users currently belong to the org, not reading an
 * incrementing field. Returns true if the org can add one more user right
 * now.
 */
async function checkUserLimit(org_id, organization) {
  const limit = organization.limits && organization.limits.users;
  if (limit == null || limit === -1) return true; // unlimited
  const count = await countOrgUsers(org_id);
  return count < limit;
}

/**
 * All users belonging to an org (via the org-index GSI), oldest first. Used
 * by the team-management API (GET /api/organizations/team) and by
 * ensureOwnerAssigned() below. Never includes password_hash — this is
 * exactly the shape the client is allowed to see.
 */
async function getOrgTeamMembers(org_id) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'org-index',
    KeyConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': org_id },
  }));
  return (result.Items || [])
    .map(u => ({
      user_id: u.user_id,
      email: u.email,
      display_name: u.display_name,
      role: u.role,
      created_at: u.created_at,
      last_login_at: u.last_login_at || null,
    }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * Roles (Owner / Admin / Viewer — see server/middleware/roles.js) replaced a
 * flat "every non-guest user is a full admin" model. Every org created from
 * here on gets owner_user_id set explicitly at signup (routes/auth.js), but
 * an org that already existed before this change has no owner on record
 * yet. This self-heals the first time anyone in that org logs in: it picks
 * the earliest-created non-guest/non-viewer user as the owner, persists
 * that on the org, and — only for that one user, only if their row still
 * says the legacy flat 'admin' — upgrades their own row to 'owner' so this
 * never has to run again for that org. Every OTHER existing admin in the
 * org is left as 'admin', which is exactly the tier they should land in.
 * A no-op (single read, no write) once owner_user_id is set.
 */
async function ensureOwnerAssigned(org) {
  if (!org || org.owner_user_id) return org;
  const members = await getOrgTeamMembers(org.org_id);
  const candidate = members.find(m => m.role !== 'guest' && m.role !== 'viewer') || members[0];
  if (!candidate) return org;

  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id: org.org_id },
    UpdateExpression: 'SET owner_user_id = :o',
    ExpressionAttributeValues: { ':o': candidate.user_id },
  })).catch(err => console.error('[ORG] Failed to backfill owner_user_id for', org.org_id, err.message));
  org.owner_user_id = candidate.user_id;

  if (candidate.role === 'admin') {
    await dynamodb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: candidate.user_id },
      UpdateExpression: 'SET #role = :r',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':r': 'owner' },
    })).catch(err => console.error('[ORG] Failed to upgrade owner role for', candidate.user_id, err.message));
  }
  return org;
}

/**
 * Change a team member's role to 'admin' or 'viewer'. Only ever reached
 * from behind requireRole('owner','admin') server-side, but this function
 * adds the one check that has to hold regardless of who's calling: the
 * org's Owner (organization.owner_user_id) can never be reassigned through
 * this path — that needs a dedicated "transfer ownership" action (not built
 * yet) so an org can't accidentally end up with no Owner. The
 * ConditionExpression stops a caller from touching a user_id that belongs
 * to a different organization.
 */
async function updateTeamMemberRole(organization, target_user_id, newRole) {
  if (!['admin', 'viewer'].includes(newRole)) {
    throw Object.assign(new Error('role must be "admin" or "viewer"'), { statusCode: 400 });
  }
  if (organization.owner_user_id === target_user_id) {
    throw Object.assign(new Error("The organization's Owner can't be reassigned here."), { statusCode: 403 });
  }
  await dynamodb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { user_id: target_user_id },
    ConditionExpression: 'org_id = :org_id',
    UpdateExpression: 'SET #role = :r, updated_at = :u',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':r': newRole, ':u': new Date().toISOString(), ':org_id': organization.org_id },
  }));
}

/**
 * Remove a team member entirely. Same Owner protection and cross-org guard
 * as updateTeamMemberRole() above.
 */
async function removeTeamMember(organization, target_user_id) {
  if (organization.owner_user_id === target_user_id) {
    throw Object.assign(new Error("The organization's Owner can't be removed."), { statusCode: 403 });
  }
  await dynamodb.send(new DeleteCommand({
    TableName: USERS_TABLE,
    Key: { user_id: target_user_id },
    ConditionExpression: 'org_id = :org_id',
    ExpressionAttributeValues: { ':org_id': organization.org_id },
  }));
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
 * Undo one increment from incrementUsage() -- e.g. when a created event is
 * deleted, so it stops counting against the plan's monthly cap. Read-
 * modify-write and floored at zero (never a blind ADD -1) so a delete can
 * never push the counter negative -- e.g. if usage was already reset to 0
 * by a new month between the original creation and this deletion.
 */
async function decrementUsage(org_id, resource) {
  const result = await dynamodb.send(new GetCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
  }));
  const org = result.Item;
  if (!org) return;
  const key = `${resource}_this_month`;
  const current = (org.usage && org.usage[key]) || 0;
  const next = Math.max(0, current - 1);
  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: 'SET #usage.#resource = :next, #updated_at = :now',
    ExpressionAttributeNames: { '#usage': 'usage', '#resource': key, '#updated_at': 'updated_at' },
    ExpressionAttributeValues: { ':next': next, ':now': Date.now() },
  }));
}

/**
 * Record one AI-generated image against an org's monthly free allowance,
 * accruing an overage charge on `billing.ai_image_overage_cents` once that
 * allowance is used up. Deliberately never blocks generation — the request
 * that got us here already succeeded; this just tracks what's owed.
 *
 * Read-modify-write rather than a blind DynamoDB ADD: `billing` doesn't
 * exist on orgs created before this field was added, and ADD can't create
 * an attribute inside a map that isn't there yet. This trades perfect
 * atomicity under simultaneous requests from the same org (unrealistic for
 * a single temple's flyer generation) for code that works for every org
 * regardless of when it was created.
 */
async function recordAiImageUsage(org_id) {
  const org = await getOrganization(org_id);
  if (!org) return null;

  const limit = (org.limits && org.limits.ai_images_per_month) ?? PLAN_LIMITS[org.plan]?.ai_images_per_month ?? 30;
  const usedBefore = (org.usage && org.usage.ai_images_this_month) || 0;
  const usedAfter = usedBefore + 1;
  const isUnlimited = limit === -1;
  const overLimit = !isUnlimited && usedAfter > limit;

  const overageBefore = (org.billing && org.billing.ai_image_overage_cents) || 0;
  const overageAfter = overLimit ? overageBefore + AI_IMAGE_PRICE_CENTS : overageBefore;

  // `billing` is a newer field — orgs created before it existed won't have
  // the map at all yet, and DynamoDB can't SET a nested attribute whose
  // parent map is missing. Overwrite the whole `billing` object (computed
  // above from a full read) instead of a nested path, so this works
  // whether or not the org already had one.
  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: 'SET #usage.#aiImages = :usedAfter, #billing = :billingObj, #updated_at = :now',
    ExpressionAttributeNames: {
      '#usage': 'usage',
      '#aiImages': 'ai_images_this_month',
      '#billing': 'billing',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':usedAfter': usedAfter,
      ':billingObj': { ...(org.billing || {}), ai_image_overage_cents: overageAfter },
      ':now': Date.now(),
    },
  }));

  return {
    used: usedAfter,
    limit,
    isUnlimited,
    overLimit,
    overageCentsAdded: overLimit ? AI_IMAGE_PRICE_CENTS : 0,
    totalOverageCents: overageAfter,
  };
}

/**
 * Same shape as recordAiImageUsage, for chatbot messages instead. Unlike
 * AI images, the Free plan blocks chatbot entirely (limit is 0) — routes/
 * chat.js checks that BEFORE calling Claude and never reaches this
 * function for a blocked request, so this only ever runs for a message
 * that already succeeded, same "just track what's owed" role.
 */
async function recordChatbotMessageUsage(org_id) {
  const org = await getOrganization(org_id);
  if (!org) return null;

  const limit = (org.limits && org.limits.chatbot_messages_per_month) ?? PLAN_LIMITS[org.plan]?.chatbot_messages_per_month ?? 0;
  const usedBefore = (org.usage && org.usage.chatbot_messages_this_month) || 0;
  const usedAfter = usedBefore + 1;
  const isUnlimited = limit === -1;
  const overLimit = !isUnlimited && usedAfter > limit;

  const overageBefore = (org.billing && org.billing.chatbot_message_overage_cents) || 0;
  const overageAfter = overLimit ? overageBefore + CHATBOT_MESSAGE_PRICE_CENTS : overageBefore;

  await dynamodb.send(new UpdateCommand({
    TableName: ORGANIZATIONS_TABLE,
    Key: { org_id },
    UpdateExpression: 'SET #usage.#chatbotMsgs = :usedAfter, #billing = :billingObj, #updated_at = :now',
    ExpressionAttributeNames: {
      '#usage': 'usage',
      '#chatbotMsgs': 'chatbot_messages_this_month',
      '#billing': 'billing',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':usedAfter': usedAfter,
      ':billingObj': { ...(org.billing || {}), chatbot_message_overage_cents: overageAfter },
      ':now': Date.now(),
    },
  }));

  return {
    used: usedAfter,
    limit,
    isUnlimited,
    overLimit,
    overageCentsAdded: overLimit ? CHATBOT_MESSAGE_PRICE_CENTS : 0,
    totalOverageCents: overageAfter,
  };
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
        ai_images_this_month: 0,
        storage_used_gb: 0
      }
    }
  }));
}

/**
 * Redacted, client-safe view of an org's per-platform Facebook/Instagram
 * connection (see routes/organizations.js PUT /settings, which is where
 * social_accounts gets written) — whether a connection is on file plus the
 * non-secret Page ID / Instagram Account ID, and NEVER the Facebook Page
 * access token itself. Shared by every response that hands `organization`
 * to the client (login, Google login, GET /me, PUT /settings) so none of
 * them can accidentally leak the token into browser localStorage.
 */
function redactSocialAccounts(org) {
  const social = (org && org.social_accounts) || {};
  return {
    facebook: {
      connected: !!(social.facebook && social.facebook.page_token),
      page_id: (social.facebook && social.facebook.page_id) || '',
      page_name: (social.facebook && social.facebook.page_name) || '',
      connected_via: (social.facebook && social.facebook.connected_via) || ''
    },
    instagram: {
      connected: !!(social.instagram && social.instagram.account_id),
      account_id: (social.instagram && social.instagram.account_id) || '',
      username: (social.instagram && social.instagram.username) || '',
      connected_via: (social.instagram && social.instagram.connected_via) || ''
    },
    // Added alongside the WhatsApp Embedded Signup flow (routes/
    // social-connect.js) — never echoes the token, same as the other two.
    whatsapp: {
      connected: !!(social.whatsapp && social.whatsapp.token && social.whatsapp.phone_id),
      phone_id: (social.whatsapp && social.whatsapp.phone_id) || '',
      waba_id: (social.whatsapp && social.whatsapp.waba_id) || '',
      connected_via: (social.whatsapp && social.whatsapp.connected_via) || ''
    }
  };
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

/**
 * Guest sandboxes (POST /api/auth/guest-sandbox, server/scheduler.js's
 * sandbox sweep) — self-serve demo orgs that expire on their own rather
 * than needing a platform admin to clean them up. No GSI on is_sandbox
 * (there are only ever a handful of these live at once), so this is a
 * scan with a filter — same tradeoff already made for
 * getOrganizationByDomain/getOrganizationByStripeCustomerId above.
 *
 * A sandbox that added a real card mid-trial (billing.card_on_file — see
 * routes/billing.js's checkout webhook) is excluded here even though
 * is_sandbox is still true on the row: that guest converted to a real
 * customer, and the sweep must never delete a paying org.
 */
async function listExpiredSandboxOrgs() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: ORGANIZATIONS_TABLE,
    FilterExpression: 'is_sandbox = :true AND sandbox_expires_at <= :now',
    ExpressionAttributeValues: { ':true': true, ':now': Date.now() }
  }));
  return (result.Items || []).filter(org => !(org.billing && org.billing.card_on_file));
}

/**
 * Deletes a sandbox org and everything scoped to it — its users
 * (calendarfly_users' org-index) and its events (calendarfly_events' own
 * org-index, via events.js's getEventsByOrg so this doesn't have to know
 * that table's shape) — then the org row itself. Only ever called on rows
 * listExpiredSandboxOrgs() already vetted (is_sandbox, past
 * sandbox_expires_at, no card on file); re-checked here too so this is
 * never accidentally reachable against a real org.
 */
async function deleteSandboxOrgData(org_id) {
  const org = await dynamodb.send(new GetCommand({ TableName: ORGANIZATIONS_TABLE, Key: { org_id } }));
  if (!org.Item || !org.Item.is_sandbox || (org.Item.billing && org.Item.billing.card_on_file)) {
    console.warn(`[SANDBOX] Refusing to delete ${org_id} — no longer a clean sandbox row`);
    return false;
  }

  const { getEventsByOrg } = require('./events');
  const [members, events] = await Promise.all([
    getOrgTeamMembers(org_id),
    getEventsByOrg(org_id).catch(() => []),
  ]);

  await Promise.all([
    ...members.map(m => dynamodb.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { user_id: m.user_id } }))),
    ...events.map(e => dynamodb.send(new DeleteCommand({ TableName: 'calendarfly_events', Key: { event_id: e.id || e.event_id } }))),
  ]);

  await dynamodb.send(new DeleteCommand({ TableName: ORGANIZATIONS_TABLE, Key: { org_id } }));
  return true;
}

module.exports = {
  createOrganization,
  getOrganization,
  getOrganizationBySubdomain,
  getOrganizationByDomain,
  getOrganizationByStripeCustomerId,
  updateOrganization,
  settleTrial,
  changePlan,
  canUseFeature,
  checkLimit,
  checkUserLimit,
  countOrgUsers,
  getOrgTeamMembers,
  ensureOwnerAssigned,
  updateTeamMemberRole,
  removeTeamMember,
  incrementUsage,
  decrementUsage,
  recordAiImageUsage,
  recordChatbotMessageUsage,
  resetMonthlyUsage,
  listOrganizations,
  redactSocialAccounts,
  listExpiredSandboxOrgs,
  deleteSandboxOrgData,
  PLAN_FEATURES,
  PLAN_LIMITS,
  AI_IMAGE_PRICE_CENTS,
  CHATBOT_MESSAGE_PRICE_CENTS
};
