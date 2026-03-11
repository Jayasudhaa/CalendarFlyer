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
  listOrganizations
} = require('../organizations');

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
    res.status(500).json({ 
      error: 'Failed to create organization',
      message: error.message 
    });
  }
});

// Get current organization info
router.get('/me', async (req, res) => {
  try {
    if (!req.org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    res.json({
      org_id: req.org.org_id,
      name: req.org.name,
      subdomain: req.org.subdomain,
      custom_domain: req.org.custom_domain,
      logo_url: req.org.logo_url,
      primary_color: req.org.primary_color,
      secondary_color: req.org.secondary_color,
      plan: req.org.plan,
      features: req.org.features,
      limits: req.org.limits,
      usage: req.org.usage,
      trial_ends_at: req.org.trial_ends_at
    });
  } catch (error) {
    console.error('[ORG] Get org error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization settings
router.put('/settings', async (req, res) => {
  try {
    if (!req.org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const { name, logo_url, primary_color, secondary_color } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (logo_url) updates.logo_url = logo_url;
    if (primary_color) updates.primary_color = primary_color;
    if (secondary_color) updates.secondary_color = secondary_color;
    
    const updated = await updateOrganization(req.org.org_id, updates);
    
    res.json({ 
      success: true, 
      organization: updated 
    });
  } catch (error) {
    console.error('[ORG] Update error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Change plan
router.post('/change-plan', async (req, res) => {
  try {
    if (!req.org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    const { plan } = req.body;
    
    if (!['free', 'starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    
    const updated = await changePlan(req.org.org_id, plan);
    
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

// List all organizations (super admin only)
router.get('/list', async (req, res) => {
  try {
    // TODO: Add super admin authentication check
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
