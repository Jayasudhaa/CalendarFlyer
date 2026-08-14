/**
 * Multi-Tenant Middleware
 * Detects organization from subdomain or custom domain
 * Attaches org to request object
 */

const { 
  getOrganizationBySubdomain, 
  getOrganizationByDomain 
} = require('../organizations');

/**
 * Extract subdomain from hostname
 * Examples:
 * - temple1.calendarflyapp.com → temple1
 * - www.calendarflyapp.com → www
 * - calendarflyapp.com → null
 */
function extractSubdomain(hostname) {
  const parts = hostname.split('.');
  
  // If only 2 parts (e.g., "calendarflyapp.com"), no subdomain
  if (parts.length <= 2) return null;
  
  // If www, treat as no subdomain
  if (parts[0] === 'www') return null;
  
  // Otherwise, first part is subdomain
  return parts[0];
}

/**
 * Multi-tenant middleware
 * Attaches req.org to all requests
 */
async function tenantMiddleware(req, res, next) {
  try {
    const hostname = req.hostname || req.get('host') || '';
    
    console.log(`[TENANT] Request from: ${hostname}`);
    
    // Extract subdomain
    const subdomain = extractSubdomain(hostname);
    
    let organization = null;
    
    // Try to find org by subdomain
    if (subdomain) {
      console.log(`[TENANT] Looking up subdomain: ${subdomain}`);
      organization = await getOrganizationBySubdomain(subdomain);
    }
    
    // If not found, try custom domain
    if (!organization && hostname) {
      console.log(`[TENANT] Looking up custom domain: ${hostname}`);
      organization = await getOrganizationByDomain(hostname);
    }
    
    // If still not found, check for localhost/development
    if (!organization && (hostname.includes('localhost') || hostname.includes('127.0.0.1'))) {
      console.log('[TENANT] Development mode - using default org');
      // In development, you can set a default org_id
      const { getOrganization } = require('../organizations');
      organization = await getOrganization(process.env.DEFAULT_ORG_ID || null);
    }
    
    if (organization) {
      console.log(`[TENANT] Organization found: ${organization.name} (${organization.org_id})`);
      req.org = organization;
    } else {
      console.log('[TENANT] No organization found for this domain');
      req.org = null;
    }
    
    next();
  } catch (error) {
    console.error('[TENANT] Error in tenant middleware:', error);
    req.org = null;
    next();
  }
}

/**
 * Require organization middleware
 * Use this to protect routes that require a valid organization
 */
function requireOrganization(req, res, next) {
  if (!req.org) {
    return res.status(404).json({
      error: 'Organization not found',
      message: 'This domain is not associated with any organization. Please check your URL.'
    });
  }
  next();
}

/**
 * Require feature middleware
 * Use this to protect routes based on plan features
 */
function requireFeature(featureName) {
  return (req, res, next) => {
    if (!req.org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }
    
    if (!req.org.features[featureName]) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature requires an upgrade. Your current plan (${req.org.plan}) does not include ${featureName}.`,
        feature: featureName,
        current_plan: req.org.plan,
        upgrade_url: '/pricing'
      });
    }
    
    next();
  };
}

/**
 * Check usage limit middleware
 * Use this to enforce monthly limits
 */
function checkUsageLimit(resourceName) {
  return (req, res, next) => {
    if (!req.org) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }
    
    const limit = req.org.limits[`${resourceName}_per_month`];
    const usage = req.org.usage[`${resourceName}_this_month`];
    
    // -1 means unlimited
    if (limit === -1) {
      return next();
    }
    
    if (usage >= limit) {
      return res.status(429).json({
        error: 'Monthly limit reached',
        message: `You've reached your monthly limit for ${resourceName} (${limit}). Upgrade your plan for more.`,
        resource: resourceName,
        limit: limit,
        current_usage: usage,
        upgrade_url: '/pricing'
      });
    }
    
    next();
  };
}

module.exports = {
  tenantMiddleware,
  requireOrganization,
  requireFeature,
  checkUsageLimit,
  extractSubdomain
};
