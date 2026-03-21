/**
 * Feature access control per plan.
 * V2.1: Simplified two-tier model (Free + Pro).
 *
 * Principle: Free shows the value, Pro lets you exploit it.
 * - All detection, generation, and audit features are FREE
 * - Actions (copy, push, export, funnel, CAPI config) are PRO
 */

import { PLANS } from '../shared/plans.js';

// Dev mode: extension loaded unpacked (no update_url) — bypass all gates
let _isDevMode = null;
function isDevMode() {
  if (_isDevMode === null) {
    try {
      _isDevMode = !chrome.runtime.getManifest().update_url;
    } catch (e) { _isDevMode = false; }
  }
  return _isDevMode;
}

/**
 * FEATURE GATE DEFINITIONS
 * Only 5 gated features — everything else is free.
 */
export const FEATURES = {
  eventCopy: {
    minPlan: 'pro',
    upgradeMessage: 'Copy events to clipboard — available in Pro.',
    upgradePlan: 'pro',
  },
  eventPush: {
    minPlan: 'pro',
    upgradeMessage: 'Push events to dataLayer for testing — available in Pro.',
    upgradePlan: 'pro',
  },
  pdfExport: {
    minPlan: 'pro',
    upgradeMessage: 'Export professional PDF audit reports — available in Pro.',
    upgradePlan: 'pro',
  },
  funnelMode: {
    minPlan: 'pro',
    upgradeMessage: 'Audit entire purchase funnels across multiple pages — available in Pro.',
    upgradePlan: 'pro',
  },
  capiConfig: {
    minPlan: 'pro',
    upgradeMessage: 'Customise CAPI event names — available in Pro.',
    upgradePlan: 'pro',
  },
};

/**
 * Check if a feature is accessible with the given plan.
 * Returns { allowed: boolean, reason?: string, upgradePlan?: string }
 */
export function checkFeature(featureName, plan) {
  // Dev mode: everything unlocked (unless plan is explicitly 'free' from simulate toggle)
  if (isDevMode() && plan !== 'free') return { allowed: true };

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
    reason: feature.upgradeMessage || 'This feature requires the Pro plan.',
    upgradePlan: feature.upgradePlan || 'pro',
  };
}

/**
 * Get a summary of what's available at the given plan.
 * Used to show/hide UI elements.
 */
export function getPlanCapabilities(plan) {
  // Dev mode: full access (unless plan is explicitly 'free' from simulate toggle)
  if (isDevMode() && plan !== 'free') {
    return {
      plan: 'pro',
      canCopyEvents: true,
      canPushEvents: true,
      canExportPDF: true,
      canFunnelMode: true,
      canCapiConfig: true,
    };
  }

  const level = PLANS[plan] || 0;
  const isPro = level >= PLANS.pro;

  return {
    plan,
    canCopyEvents: isPro,
    canPushEvents: isPro,
    canExportPDF: isPro,
    canFunnelMode: isPro,
    canCapiConfig: isPro,
  };
}
