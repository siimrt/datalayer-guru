/**
 * Feature access control per plan.
 * Defines exactly which features are available at each plan level.
 */

import { PLANS } from '../shared/plans.js';

/**
 * FEATURE GATE DEFINITIONS
 * Each feature has:
 * - minPlan: minimum plan required
 * - upgradeMessage: shown when user hits the gate
 * - upgradePlan: which plan to suggest for upgrade
 * - limits: optional per-plan usage limits (null = unlimited)
 */
export const FEATURES = {
  // === CMS Detection (always free) ===
  cmsDetection: { minPlan: 'free' },
  pageTypeDetection: { minPlan: 'free' },
  dataExtraction: { minPlan: 'free' },
  dataLayerLive: { minPlan: 'free' },
  pixelDetection: { minPlan: 'free' },
  consentStatus: { minPlan: 'free' },

  // === Event Generation (gated) ===
  eventGeneration: {
    minPlan: 'free',
    freeMode: 'preview', // show blurred code
  },
  eventCopy: {
    minPlan: 'starter',
    upgradeMessage: 'Copy events — available from Starter ($9/mo)',
    upgradePlan: 'starter',
  },
  eventPush: {
    minPlan: 'pro',
    upgradeMessage: 'Push to dataLayer — available in Pro ($19/mo)',
    upgradePlan: 'pro',
  },

  // === CMS Support ===
  cmsShopify: { minPlan: 'free' },
  cmsWooCommerce: { minPlan: 'free' },
  cmsPrestaShop: {
    minPlan: 'starter',
    upgradeMessage: 'PrestaShop support is available from Starter.',
    upgradePlan: 'starter',
  },
  cmsMagento: {
    minPlan: 'pro',
    upgradeMessage: 'Magento/Adobe Commerce support is available in Pro.',
    upgradePlan: 'pro',
  },
  cmsWebflow: {
    minPlan: 'pro',
    upgradeMessage: 'Webflow Commerce support is available in Pro.',
    upgradePlan: 'pro',
  },
  cmsCustom: { minPlan: 'pro' },

  // === Platform Support ===
  platformGA4: { minPlan: 'free' },
  platformMeta: {
    minPlan: 'starter',
    upgradeMessage: 'Generate Meta/Facebook Pixel events — available from Starter.',
    upgradePlan: 'starter',
  },
  platformTikTok: {
    minPlan: 'pro',
    upgradeMessage: 'Generate TikTok Pixel events — available in Pro.',
    upgradePlan: 'pro',
  },
  platformPinterest: {
    minPlan: 'pro',
    upgradeMessage: 'Generate Pinterest Tag events — available in Pro.',
    upgradePlan: 'pro',
  },
  platformSnapchat: {
    minPlan: 'pro',
    upgradeMessage: 'Generate Snapchat Pixel events — available in Pro.',
    upgradePlan: 'pro',
  },

  // === Audit Features ===
  auditDiff: {
    minPlan: 'pro',
    upgradeMessage: 'Event audit & diff — available in Pro ($19/mo)',
    upgradePlan: 'pro',
  },
  consentDiagnostic: { minPlan: 'pro' },

  // === V2 Premium Features ===
  funnelMode: {
    minPlan: 'pro',
    upgradeMessage: 'Funnel Mode — audit entire purchase flows. Available in Pro.',
    upgradePlan: 'pro',
    limits: { pro: 20, agency: null },
  },
  pdfExport: {
    minPlan: 'pro',
    upgradeMessage: 'PDF reports for your clients — available in Pro.',
    upgradePlan: 'pro',
    limits: { pro: 10, agency: null },
  },
  pdfWhiteLabel: {
    minPlan: 'agency',
    upgradeMessage: 'Add your agency logo to reports — available in Agency.',
    upgradePlan: 'agency',
  },
  customTemplates: {
    minPlan: 'pro',
    limits: { pro: 10, agency: null },
  },
  auditHistory: {
    minPlan: 'pro',
    limits: { pro: 30, agency: 90 },
  },
  debugSnippets: {
    minPlan: 'agency',
    upgradeMessage: 'Debug snippet library — available in Agency.',
    upgradePlan: 'agency',
  },
  teamSeats: {
    minPlan: 'agency',
    limits: { agency: 5 },
  },
};

// Domain limits (separate since it's per-plan, not feature-gated)
export const DOMAIN_LIMITS = {
  free: 0,
  starter: 5,
  pro: null,
  agency: null,
};

/**
 * Check if a feature is accessible with the given plan.
 * Returns { allowed: boolean, reason?: string, upgradePlan?: string }
 */
export function checkFeature(featureName, plan) {
  const feature = FEATURES[featureName];
  if (!feature) return { allowed: true };

  const planLevel = PLANS[plan] || 0;
  const requiredLevel = PLANS[feature.minPlan] || 0;
  const allowed = planLevel >= requiredLevel;

  if (allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: feature.upgradeMessage || `This feature requires the ${feature.minPlan} plan.`,
    upgradePlan: feature.upgradePlan || feature.minPlan,
  };
}

/**
 * Get the usage limit for a feature at a given plan.
 * Returns number or null (unlimited).
 */
export function getFeatureLimit(featureName, plan) {
  const feature = FEATURES[featureName];
  if (!feature || !feature.limits) return null;
  return feature.limits[plan] ?? null;
}

/**
 * Check if a specific CMS is supported at the given plan.
 */
export function isCMSSupported(cmsName, plan) {
  const mapping = {
    shopify: 'cmsShopify',
    woocommerce: 'cmsWooCommerce',
    prestashop: 'cmsPrestaShop',
    magento: 'cmsMagento',
    webflow: 'cmsWebflow',
    unknown: 'cmsCustom',
  };
  const key = mapping[cmsName] || `cms${cmsName.charAt(0).toUpperCase() + cmsName.slice(1)}`;
  return checkFeature(key, plan).allowed;
}

/**
 * Check if a specific platform's events are accessible.
 */
export function isPlatformSupported(platformName, plan) {
  const mapping = {
    ga4: 'platformGA4',
    meta: 'platformMeta',
    tiktok: 'platformTikTok',
    pinterest: 'platformPinterest',
    snapchat: 'platformSnapchat',
  };
  const key = mapping[platformName];
  return key ? checkFeature(key, plan).allowed : false;
}

/**
 * Get a summary of what's available at the given plan.
 * Used to show/hide UI elements.
 */
export function getPlanCapabilities(plan) {
  const level = PLANS[plan] || 0;

  return {
    plan,
    canCopyEvents: level >= PLANS.starter,
    canPushEvents: level >= PLANS.pro,
    canAudit: level >= PLANS.pro,
    canExportPDF: level >= PLANS.pro,
    canWhiteLabel: level >= PLANS.agency,
    canFunnelMode: level >= PLANS.pro,
    supportedCMS: getSupportedCMSList(plan),
    supportedPlatforms: getSupportedPlatformsList(plan),
    domainLimit: DOMAIN_LIMITS[plan] ?? null,
    pdfLimit: getFeatureLimit('pdfExport', plan),
    funnelPageLimit: getFeatureLimit('funnelMode', plan),
    templateLimit: getFeatureLimit('customTemplates', plan),
  };
}

function getSupportedCMSList(plan) {
  const all = ['shopify', 'woocommerce', 'prestashop', 'magento', 'webflow'];
  return all.filter((cms) => isCMSSupported(cms, plan));
}

function getSupportedPlatformsList(plan) {
  const all = ['ga4', 'meta', 'tiktok', 'pinterest', 'snapchat'];
  return all.filter((p) => isPlatformSupported(p, plan));
}
