/**
 * Organization Management Routes
 * Handles signup, settings, plan changes
 */
const express = require('express');
const router = express.Router();
const {
  createOrganization,
  getOrganization,
  updateOrganization,
  changePlan,
  listOrganizations,
  countOrgUsers,
  redactSocialAccounts,
  PLAN_LIMITS,
  AI_IMAGE_PRICE_CENTS
} = require('../organizations');
const { authenticateToken, requireNonGuest } = require('./auth');
const { sendServerError } = require('../utils/errors');

const FACEBOOK_GRAPH_VERSION = 'v20.0';

// A Page Access Token pasted in from Graph API Explorer is short-lived --
// often just 1-2 hours -- and broadcasts start silently failing once it
// expires (see routes/broadcast.js's "Session has expired" errors). This
// trades it for a long-lived version using Facebook's own token-exchange
// endpoint, with only the app's own id/secret (never sent to the client).
// Meta's documented "guaranteed never-expiring" path is to exchange a USER
// token and re-derive Page tokens from that -- but exchanging a Page token
// directly through the same endpoint also extends its life in practice, so
// this tries it on whatever was pasted. If the exchange fails for any
// reason (rate limit, network, already non-expiring, wrong token type),
// this returns the original token unchanged -- saving never gets worse
// than it was before this existed.
async function exchangeForLongLivedToken(shortLivedToken) {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) return shortLivedToken;
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    });
    const res = await fetch(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.access_token) {
      console.log('[ORGANIZATIONS] Exchanged Facebook token for a long-lived one.');
      return data.access_token;
    }
    console.warn('[ORGANIZATIONS] Facebook token exchange did not return a token — saving the pasted token as-is:', data.error?.message || JSON.stringify(data));
  } catch (err) {
    console.warn('[ORGANIZATIONS] Facebook token exchange failed — saving the pasted token as-is:', err.message);
  }
  return shortLivedToken;
}

// Create new organization (signup)
router.post('/signup', async (req, res) => {
  try {
    const { name, subdomain, email, password, plan } = req.body;
    
    // Validate required fields
    if (!name || !subdomain || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'subdomain', 'email']
      });
    }
    
    // Create organization
    const organization = await createOrganization({
      name,
      subdomain: subdomain.toLowerCase(),
      plan: plan || 'free'
    });
    
    console.log('[ORG] Created:', organization.name, organization.org_id);
    
    res.json({
      success: true,
      organization: {
        org_id: organization.org_id,
        name: organization.name,
        subdomain: organization.subdomain,
        plan: organization.plan,
        features: organization.features,
        trial_ends_at: organization.trial_ends_at
      },
      login_url: `https://${subdomain}.calendarflyapp.com`
    });
  } catch (error) {
    console.error('[ORG] Signup error:', error);
    sendServerError(res, error, 'Failed to create organization');
  }
});

// Get current organization info
//
// SECURITY FIX: this used to try req.org FIRST and only fall back to the
// JWT if that was empty. req.org comes from tenantMiddleware, which sets it
// from the request's subdomain OR — critically — an unauthenticated
// ?org=<subdomain> query param (see server/middleware/tenant.js). Since
// this route returns another org's billing status, address/phone,
// broadcast email, plan/limits/usage and social-connection status, any
// logged-in user of ANY org could read a DIFFERENT org's data by just
// adding ?org=<other-subdomain> to this one GET request — their own valid
// token never got checked at all once req.org was already set. The two
// known callers (AuthContext.jsx after login, SubscriptionPage.jsx) both
// always send their own Bearer token, so resolving from the verified JWT
// first and using req.org only when there's no token (an actual
// unauthenticated/public caller) doesn't change behavior for either.
router.get('/me', async (req, res) => {
  try {
    let org = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../utils/jwtSecret');
        const decoded = jwt.verify(token, JWT_SECRET);
        org = await getOrganization(decoded.org_id);
      } catch (e) { /* invalid/expired token — fall through to req.org below */ }
    }
    if (!org) {
      // No (valid) token — the intended case here is an unauthenticated
      // public caller, so the subdomain/?org=-resolved req.org is correct.
      org = req.org;
    }
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Live headcount, not a monthly counter — lets the Subscription page
    // show "used / limit" for team members the same way it does for the
    // monthly-resetting resources. Non-fatal if it fails (e.g. GSI hiccup):
    // the page just falls back to showing the limit alone.
    let teamMembersUsed = null;
    try { teamMembersUsed = await countOrgUsers(org.org_id); } catch (e) { /* non-critical */ }

    res.json({
      org_id: org.org_id,
      name: org.name,
      subdomain: org.subdomain,
      custom_domain: org.custom_domain,
      logo_url: org.logo_url,
      banner_url: org.banner_url || null,
      category: org.category || null,
      address: org.address || '',
      phone: org.phone || '',
      manager_phone: org.manager_phone || '',
      primary_color: org.primary_color,
      secondary_color: org.secondary_color,
      plan: org.plan,
      features: org.features,
      limits: org.limits,
      usage: org.usage,
      team_members_used: teamMembersUsed,
      trial_ends_at: org.trial_ends_at,
      // Card-on-file / subscription status for the trial banner on the
      // Subscription page — see settleTrial()/routes/billing.js.
      billing: org.billing || null,
      // Broadcast's Email channel sends one email here (your existing
      // mailing list / Google Group / Mailchimp-forwarding address) rather
      // than to individual devotees -- same shape as the WhatsApp group ID
      // and Facebook Page it already broadcasts to. Not a secret, so it's
      // returned as-is (unlike the Facebook/Instagram tokens below).
      broadcast_email: org.broadcast_email || '',
      // Orgs created before the onboarding wizard existed have no such field —
      // treat that as "already done" rather than forcing them through it now.
      onboarding_completed: org.onboarding_completed !== false,
      // Redacted view of this org's own Facebook Page / Instagram Business
      // connection (saved from Organization Settings — see PUT /settings
      // below). The Page access token itself is NEVER sent back to the
      // client, only whether one is on file plus the (non-secret) Page ID /
      // Account ID, so Settings can show a "Connected" badge without
      // re-exposing the token on every page load.
      social_accounts: redactSocialAccounts(org)
    });
  } catch (error) {
    console.error('[ORG] Get org error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization settings
router.put('/settings', authenticateToken, requireNonGuest, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const {
      name, logo_url, banner_url, address, phone, manager_phone, primary_color, secondary_color,
      category, onboarding_completed, admin_code, broadcast_email,
      // Per-organization Facebook/Instagram connection (Organization
      // Settings → Social Media Connections, below).
      facebook_page_token, facebook_page_id, facebook_page_name, instagram_account_id, instagram_username,
      disconnect_facebook, disconnect_instagram,
      // WhatsApp itself is only ever connected via Embedded Signup (routes/
      // social-connect.js POST /whatsapp/finish) — there's no manual paste
      // path for it, unlike Facebook/Instagram above. Disconnecting is the
      // one WhatsApp action that belongs here, alongside the other two.
      disconnect_whatsapp
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (logo_url) updates.logo_url = logo_url;
    if (banner_url) updates.banner_url = banner_url;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (manager_phone !== undefined) updates.manager_phone = manager_phone;
    if (primary_color) updates.primary_color = primary_color;
    if (secondary_color) updates.secondary_color = secondary_color;
    if (onboarding_completed !== undefined) updates.onboarding_completed = onboarding_completed;
    if (broadcast_email !== undefined) {
      const trimmed = (broadcast_email || '').toString().trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'That doesn\'t look like a valid email address.' });
      }
      updates.broadcast_email = trimmed;
    }

    // Fetch the current org once, lazily — only the category-lock check and
    // the social_accounts merge below actually need existing state, so the
    // common "just save my name/colors" request skips this extra read.
    let existingOrg = null;
    const needsExistingOrg = category !== undefined
      || facebook_page_token !== undefined || facebook_page_id !== undefined || facebook_page_name !== undefined
      || instagram_account_id !== undefined || instagram_username !== undefined
      || disconnect_facebook || disconnect_instagram || disconnect_whatsapp;
    if (needsExistingOrg) {
      existingOrg = await getOrganization(org_id);
    }

    // Organization type is locked once it's been set the first time (e.g. via
    // the onboarding wizard). Changing it after that requires the platform
    // owner's admin code — a regular org admin can no longer flip it themselves.
    if (category !== undefined) {
      const currentCategory = existingOrg && existingOrg.category;
      const changingLockedCategory = currentCategory && category !== currentCategory;

      if (changingLockedCategory) {
        const secret = process.env.ADMIN_SECRET;
        if (!secret || admin_code !== secret) {
          return res.status(403).json({ error: 'Organization type is locked. Enter the admin code to change it.' });
        }
      }
      updates.category = category;
    }

    // Facebook Page / Instagram Business account this org has connected —
    // available on every plan, collected here in Settings rather than at
    // signup. Stored as one social_accounts map so each write replaces the
    // whole attribute (DynamoDB can't SET a nested path inside a map that
    // doesn't exist yet for older orgs); merge on top of whatever's already
    // there so saving Facebook doesn't wipe an already-connected Instagram,
    // and vice versa. The Page access token is write-only from here on —
    // GET /me above never echoes it back, only a redacted "connected" view.
    if (facebook_page_token !== undefined || facebook_page_id !== undefined || facebook_page_name !== undefined
        || instagram_account_id !== undefined || instagram_username !== undefined
        || disconnect_facebook || disconnect_instagram || disconnect_whatsapp) {
      const social = { ...((existingOrg && existingOrg.social_accounts) || {}) };

      if (disconnect_facebook) {
        delete social.facebook;
      } else if (facebook_page_token || facebook_page_id !== undefined || facebook_page_name !== undefined) {
        // Try to trade a freshly-pasted token for a long-lived one before
        // storing it, so it doesn't expire again in a couple hours (see
        // exchangeForLongLivedToken above). Never blocks the save either
        // way -- worst case this just stores the token exactly as pasted.
        const longLivedFbToken = facebook_page_token ? await exchangeForLongLivedToken(facebook_page_token) : facebook_page_token;
        social.facebook = {
          ...(social.facebook || {}),
          ...(facebook_page_token ? { page_token: longLivedFbToken } : {}),
          ...(facebook_page_id !== undefined ? { page_id: facebook_page_id } : {}),
          ...(facebook_page_name !== undefined ? { page_name: facebook_page_name, connected_via: 'manual' } : {}),
          connected_at: new Date().toISOString(),
        };
      }

      if (disconnect_instagram) {
        delete social.instagram;
      } else if (instagram_account_id !== undefined || instagram_username !== undefined) {
        social.instagram = {
          ...(social.instagram || {}),
          ...(instagram_account_id !== undefined ? { account_id: instagram_account_id } : {}),
          ...(instagram_username !== undefined ? { username: instagram_username, connected_via: 'manual' } : {}),
          connected_at: new Date().toISOString(),
        };
      }

      if (disconnect_whatsapp) {
        delete social.whatsapp;
      }

      updates.social_accounts = social;
    }

    const updated = await updateOrganization(org_id, updates);

    // AuthContext.updateOrganization() (the client-side function that calls
    // this route) writes this exact `organization` response straight into
    // localStorage (`cf_org`) and app state — so the raw Facebook Page
    // access token must never appear in it, or it ends up sitting in
    // plaintext in the browser. Swap in the redacted view; every other
    // field here is unchanged and already what other pages (Subscription,
    // My Profile, etc.) expect.
    const safeOrg = updated ? { ...updated, social_accounts: redactSocialAccounts(updated) } : updated;

    res.json({
      success: true,
      organization: safeOrg
    });
  } catch (error) {
    console.error('[ORG] Update error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Change plan — SELF-SERVICE DOWNGRADE TO FREE ONLY.
//
// This used to accept any plan name and just set it directly, no payment
// involved -- meaning any logged-in non-guest could set their own org to
// Enterprise for free by calling this endpoint (or clicking the "Switch to
// this plan" button on the Subscription page, which called this
// unconditionally). Moving to a PAID plan now has to go through
// POST /api/billing/checkout-session, which actually charges a card via
// Stripe before routes/billing.js's webhook handler ever calls changePlan().
// This route still handles downgrading to Free directly, since that's a
// real "stop paying" action that shouldn't require a Stripe round-trip --
// canceling the Stripe subscription itself is a separate, later concern
// (not needed for the DB-side plan to reflect Free immediately).
router.post('/change-plan', authenticateToken, requireNonGuest, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { plan } = req.body;

    if (plan !== 'free') {
      return res.status(400).json({
        error: 'Upgrading to a paid plan requires checkout — use POST /api/billing/checkout-session instead of setting a plan directly.',
      });
    }

    const updated = await changePlan(org_id, plan);

    res.json({
      success: true,
      organization: updated,
      message: `Plan changed to ${plan}`
    });
  } catch (error) {
    console.error('[ORG] Change plan error:', error);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// AI image usage — how many of the free monthly allowance have been used,
// and any overage balance accrued past it (see AI_IMAGE_PRICE_CENTS /
// recordAiImageUsage in organizations.js). Used by the Subscription page.
router.get('/ai-image-usage', authenticateToken, async (req, res) => {
  try {
    const org_id = req.user.org_id;
    if (!org_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const org = await getOrganization(org_id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const limit = (org.limits && org.limits.ai_images_per_month) ?? PLAN_LIMITS[org.plan]?.ai_images_per_month ?? 30;
    const used  = (org.usage && org.usage.ai_images_this_month) || 0;
    const overageCents = (org.billing && org.billing.ai_image_overage_cents) || 0;
    res.json({
      used,
      limit,
      isUnlimited: limit === -1,
      remaining: limit === -1 ? -1 : Math.max(0, limit - used),
      overageCents,
      pricePerImageCents: AI_IMAGE_PRICE_CENTS,
    });
  } catch (error) {
    console.error('[ORG] AI image usage error:', error);
    res.status(500).json({ error: 'Failed to fetch AI image usage' });
  }
});

// Platform-owner guard — same pattern as adminGuard in routes/rsvp.js:
// site-wide admin session (server.js /api/admin/login) OR the ADMIN_SECRET header.
// This is intentionally NOT the per-org authenticateToken — any org admin passing
// that check would still be able to see every other tenant's data.
function superAdminGuard(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  const secret = process.env.ADMIN_SECRET;
  if (secret) {
    const provided = req.headers['x-admin-secret'] || req.query.secret;
    if (provided === secret) {
      return next();
    }
  }
  // A specific org staff account can also get platform-owner access
  // through its own regular login, with no separate site-admin login or
  // ADMIN_SECRET needed -- set PLATFORM_ADMIN_EMAILS (comma-separated) in
  // .env to the address(es) that should get this. Checked last since
  // most requests here come through the session or ADMIN_SECRET path
  // above.
  const platformAdminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (platformAdminEmails.length) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../utils/jwtSecret');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.email && platformAdminEmails.includes(String(decoded.email).toLowerCase())) {
          return next();
        }
      } catch (e) { /* invalid/expired token -- fall through to 401 below */ }
    }
  }
  return res.status(401).json({ error: 'Unauthorized - Admin login required' });
}

// List all organizations (super admin only)
router.get('/list', superAdminGuard, async (req, res) => {
  try {
    const organizations = await listOrganizations();
    
    res.json({
      count: organizations.length,
      organizations: organizations.map(org => ({
        org_id: org.org_id,
        name: org.name,
        subdomain: org.subdomain,
        plan: org.plan,
        created_at: org.created_at,
        usage: org.usage
      }))
    });
  } catch (error) {
    console.error('[ORG] List error:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

module.exports = router;
