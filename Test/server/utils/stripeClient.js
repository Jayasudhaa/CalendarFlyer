/**
 * server/utils/stripeClient.js
 * Lazy-init Stripe SDK client — same pattern as the OpenAI client in
 * routes/generate-image.js. Requires STRIPE_SECRET_KEY in .env.
 *
 * Nothing in this codebase ever sees a raw card number: card entry happens
 * entirely on Stripe's own hosted Checkout page (see routes/billing.js),
 * so PCI scope stays on Stripe, not this server.
 */
const Stripe = require('stripe');

let stripe = null;
function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured on server.');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Maps a plan key to the Stripe Price ID for its monthly subscription.
// These Price IDs come from Products/Prices created in the Stripe
// Dashboard (or via the Stripe CLI) — there is no way to invent working
// ones from here. See the setup checklist for what to create and where
// each ID goes in .env.
const PLAN_PRICE_ENV_VARS = {
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};

function getStripePriceId(planKey) {
  const envVar = PLAN_PRICE_ENV_VARS[planKey];
  if (!envVar) return null; // 'free' (or any unrecognized key) has no Stripe price
  return process.env[envVar] || null;
}

module.exports = { getStripe, getStripePriceId, PLAN_PRICE_ENV_VARS };
