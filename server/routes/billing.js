/**
 * server/routes/billing.js
 * Stripe billing — collecting a card and starting/converting a paid
 * subscription after the 1-week free trial (see organizations.js's
 * settleTrial()), and reacting to what Stripe reports actually happened.
 *
 * Card entry never touches this server: it happens entirely on Stripe's
 * own hosted Checkout page, so PCI scope stays with Stripe.
 *
 * Requires (see the setup checklist wherever this was delivered):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE
 */
const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const { authenticateToken } = require('./auth');
const { requireRole } = require('../middleware/roles');
const { getStripe, getStripePriceId } = require('../utils/stripeClient');
const {
  getOrganization,
  getOrganizationByStripeCustomerId,
  updateOrganization,
  PLAN_FEATURES,
  PLAN_LIMITS,
} = require('../organizations');
const { sendServerError } = require('../utils/errors');

// A checkout session is a real, chargeable action -- cap how many an org
// can start in a window, same rateLimit pattern as broadcast.js's
// broadcastSendLimiter. Keyed by org rather than IP so it isn't trivially
// dodged by a proxy, but still falls back to IP if req.user is somehow
// unset.
const checkoutSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.org_id) || req.ip,
  message: { error: 'Too many checkout attempts — please wait a few minutes and try again.' },
});

function checkoutReturnUrls(req) {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  // Subscription now lives as a tab in My Profile (see MyProfile.jsx) rather
  // than its own /subscription page, so Stripe should land back there
  // directly instead of round-tripping through the /subscription redirect.
  return {
    success_url: `${origin}/profile?tab=subscription&checkout=success`,
    cancel_url: `${origin}/profile?tab=subscription&checkout=cancelled`,
  };
}

// POST /api/billing/checkout-session
// Creates (or reuses) a Stripe Customer for the org, then a Checkout
// Session in subscription mode for the requested plan. If the org's
// existing 7-day trial hasn't ended yet, the subscription's trial_end is
// pinned to that same timestamp — adding a card mid-trial doesn't get
// charged early, billing just starts exactly when the free week was
// always going to end. If the trial's already over, billing starts
// immediately on checkout.
router.post('/checkout-session', authenticateToken, requireRole('owner'), checkoutSessionLimiter, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) return res.status(404).json({ error: 'Organization not found' });
    const org = await getOrganization(org_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const { plan } = req.body;
    // Checkout only ever makes sense for a PAID plan -- 'free' or anything
    // else isn't a real Stripe product. Reject before even asking Stripe
    // for a price ID, so the error is unambiguous either way.
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: `"${plan}" isn't a paid plan you can check out into.` });
    }
    const priceId = getStripePriceId(plan);
    if (!priceId) {
      return res.status(400).json({
        error: `No Stripe price configured for the "${plan}" plan yet — add its Price ID to the server .env first.`,
      });
    }

    const stripe = getStripe();

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: org.org_id },
      });
      customerId = customer.id;
      await updateOrganization(org_id, { stripe_customer_id: customerId });
    }

    const trialStillActive = org.trial_ends_at && org.trial_ends_at > Date.now();
    const subscriptionData = { metadata: { org_id: org.org_id, plan } };
    if (trialStillActive) {
      // Stripe needs trial_end comfortably in the future — guard the edge
      // case where the trial has only seconds left when they check out.
      const trialEndSeconds = Math.floor(org.trial_ends_at / 1000);
      const minSeconds = Math.floor(Date.now() / 1000) + 3600;
      subscriptionData.trial_end = Math.max(trialEndSeconds, minSeconds);
    }

    const { success_url, cancel_url } = checkoutReturnUrls(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: org.org_id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: subscriptionData,
      metadata: { org_id: org.org_id, plan },
      success_url,
      cancel_url,
    });

    res.json({ url: session.url });
  } catch (err) {
    sendServerError(res, err, 'Failed to start checkout');
  }
});

// Called from server.js with the RAW request body (required for Stripe's
// signature check — see the express.raw() mount there). Not behind
// authenticateToken: Stripe calls this server-to-server with no user JWT,
// its signature is the authentication.
async function handleStripeWebhook(req, res) {
  // getStripe() throws if STRIPE_SECRET_KEY isn't set -- this MUST be
  // caught right here. This function is an async Express route handler
  // with no surrounding try/catch of its own; an uncaught throw inside
  // it becomes an unhandled promise rejection, which crashes the entire
  // Node process by default -- not just this one request. Confirmed in
  // production: a single Stripe webhook arriving while STRIPE_SECRET_KEY
  // was unset took the whole server down (~90s outage until App Runner
  // restarted it), breaking every other user's request in flight too.
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error('[BILLING] Webhook received but Stripe is not configured:', err.message);
    return res.status(500).send('Stripe is not configured on this server.');
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[BILLING] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // Card added, subscription created (trialing or active depending on
      // whether trial_end was set above) — this is the actual "upgrade".
      case 'checkout.session.completed': {
        const session = event.data.object;
        const org_id = session.metadata?.org_id || session.client_reference_id;
        const plan = session.metadata?.plan;
        if (!org_id || !plan || !PLAN_FEATURES[plan]) {
          console.warn('[BILLING] checkout.session.completed missing org_id/plan metadata, skipping');
          break;
        }
        const org = await getOrganization(org_id);
        await updateOrganization(org_id, {
          plan,
          features: PLAN_FEATURES[plan],
          limits: PLAN_LIMITS[plan],
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          billing: { ...(org?.billing || {}), card_on_file: true, subscription_status: 'active' },
        });
        console.log(`[BILLING] Org ${org_id} converted to ${plan} via Checkout`);
        break;
      }

      // Subscription actually canceled (by the org, or by Stripe after
      // payment retries are exhausted) — lose paid access, same as a
      // trial lapsing unpaid.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const org_id = subscription.metadata?.org_id;
        const org = org_id ? await getOrganization(org_id) : await getOrganizationByStripeCustomerId(subscription.customer);
        if (!org) {
          console.warn('[BILLING] customer.subscription.deleted — no matching org, skipping');
          break;
        }
        await updateOrganization(org.org_id, {
          plan: 'free',
          features: PLAN_FEATURES.free,
          limits: PLAN_LIMITS.free,
          billing: { ...(org.billing || {}), subscription_status: 'canceled' },
        });
        console.log(`[BILLING] Org ${org.org_id} subscription canceled — downgraded to free`);
        break;
      }

      // A renewal charge failed. Stripe handles retries/dunning on its own
      // and will fire customer.subscription.deleted if they're all
      // exhausted, but paid access is restricted right away rather than
      // riding out that whole window: marking the org past_due here makes
      // applyFeatureOverrides() (organizations.js) immediately serve
      // free-plan features/limits on every read, without touching
      // org.plan -- see invoice.payment_succeeded below for the restore.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const org = await getOrganizationByStripeCustomerId(invoice.customer);
        if (!org) {
          console.warn('[BILLING] invoice.payment_failed — no matching org, skipping');
          break;
        }
        await updateOrganization(org.org_id, {
          billing: { ...(org.billing || {}), subscription_status: 'past_due' },
        });
        console.log(`[BILLING] Org ${org.org_id} payment failed — marked past_due, paid features restricted`);
        break;
      }

      // A charge succeeded -- including a retried one after a prior
      // failure. If the org was marked past_due, clear it: that alone
      // restores full access, since applyFeatureOverrides() re-derives
      // features/limits from org.plan (never changed by the failure
      // above) the moment subscription_status isn't 'past_due' anymore.
      // Also fires for the very first invoice right after checkout,
      // which is a harmless no-op here since that org isn't past_due.
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const org = await getOrganizationByStripeCustomerId(invoice.customer);
        if (!org) {
          console.warn('[BILLING] invoice.payment_succeeded — no matching org, skipping');
          break;
        }
        if (org.billing && org.billing.subscription_status === 'past_due') {
          await updateOrganization(org.org_id, {
            billing: { ...org.billing, subscription_status: 'active' },
          });
          console.log(`[BILLING] Org ${org.org_id} payment succeeded — restored from past_due to active`);
        }
        break;
      }

      default:
        // Unhandled event types are expected — Stripe sends many more
        // than this app acts on.
        break;
    }
  } catch (err) {
    // Signature already verified above; an error handling the event body
    // shouldn't make Stripe think delivery failed and retry forever.
    console.error(`[BILLING] Error handling webhook event ${event.type}:`, err.message);
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.handleStripeWebhook = handleStripeWebhook;
