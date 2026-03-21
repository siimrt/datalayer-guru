/**
 * Plan definitions — shared across all contexts.
 * V2.1: Simplified to Free + Pro (two-tier model).
 */

// Plan hierarchy (higher number = more access)
export const PLANS = {
  free: 0,
  pro: 1,
};

// Whitelist of valid plan names — reject anything not in this set
export const VALID_PLANS = new Set(Object.keys(PLANS));

// Map ExtensionPay plan IDs to internal plan names
export const PLAN_ID_MAP = {
  // Bare plan names (ExtensionPay may return these directly)
  'pro': 'pro',
  // Suffixed plan IDs (standard format from ExtensionPay dashboard)
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
  // Legacy plan IDs — map to pro for existing subscribers
  'starter': 'pro',
  'starter-monthly': 'pro',
  'starter-annual': 'pro',
  'agency': 'pro',
  'agency-monthly': 'pro',
  'agency-annual': 'pro',
};

/**
 * Resolve an internal plan name from an ExtensionPay plan ID string.
 * Strategy:
 *   1. Direct lookup in PLAN_ID_MAP
 *   2. Case-insensitive partial match
 *   3. Return null if unrecognizable (caller decides fallback)
 */
export function resolvePlanFromId(planId) {
  if (!planId) return null;

  // 1. Direct lookup
  const direct = PLAN_ID_MAP[planId];
  if (direct) return direct;

  // 2. Case-insensitive partial match
  const lower = String(planId).toLowerCase();
  if (lower.includes('agency') || lower.includes('pro') || lower.includes('starter')) return 'pro';

  // 3. Unrecognizable
  return null;
}

// Plan display configuration
export const PLAN_CONFIG = {
  free: { label: 'FREE', bg: 'rgba(155, 155, 174, 0.12)', text: 'var(--tp-text-muted)', border: 'rgba(155, 155, 174, 0.2)' },
  pro: { label: 'PRO', bg: 'rgba(0, 109, 119, 0.12)', text: '#006d77', border: 'rgba(0, 109, 119, 0.2)' },
};

// Plan pricing (for display in paywalls)
export const PLAN_PRICING = {
  pro: '€25/mo',
};
