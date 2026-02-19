/**
 * Plan definitions and limits — shared across all contexts.
 */

// Plan hierarchy (higher number = more access)
export const PLANS = {
  free: 0,
  starter: 1,
  pro: 2,
  agency: 3,
};

// Map ExtensionPay plan IDs to internal plan names
export const PLAN_ID_MAP = {
  // Bare plan names (ExtensionPay may return these directly)
  'starter': 'starter',
  'pro': 'pro',
  'agency': 'agency',
  // Suffixed plan IDs (standard format from ExtensionPay dashboard)
  'starter-monthly': 'starter',
  'starter-annual': 'starter',
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
  'agency-monthly': 'agency',
  'agency-annual': 'agency',
};

/**
 * Resolve an internal plan name from an ExtensionPay plan ID string.
 * Strategy:
 *   1. Direct lookup in PLAN_ID_MAP
 *   2. Case-insensitive partial match (highest tier first: agency > pro > starter)
 *   3. Return null if unrecognizable (caller decides fallback)
 */
export function resolvePlanFromId(planId) {
  if (!planId) return null;

  // 1. Direct lookup
  const direct = PLAN_ID_MAP[planId];
  if (direct) return direct;

  // 2. Case-insensitive partial match (check highest tier first)
  const lower = String(planId).toLowerCase();
  if (lower.includes('agency')) return 'agency';
  if (lower.includes('pro')) return 'pro';
  if (lower.includes('starter')) return 'starter';

  // 3. Unrecognizable
  return null;
}

// Plan display configuration
export const PLAN_CONFIG = {
  free: { label: 'FREE', bg: '#2E2E34', text: '#9B9BAE', border: '#3E3E44' },
  starter: { label: 'STARTER', bg: '#1a2744', text: '#5B9BD5', border: '#2a3f5f' },
  pro: { label: 'PRO', bg: '#2a1f4e', text: '#6C5CE7', border: '#3d2d6b' },
  agency: { label: 'AGENCY', bg: '#3a2f1a', text: '#FDCB6E', border: '#5a4a2a' },
};

// Plan pricing (for display in paywalls)
export const PLAN_PRICING = {
  starter: '$9/mo',
  pro: '$19/mo',
  agency: '$49/mo',
};

// Domain limits per plan
export const DOMAIN_LIMITS = {
  free: 0,
  starter: 5,
  pro: null,    // unlimited
  agency: null, // unlimited
};

// PDF export limits per plan per month
export const PDF_LIMITS = {
  free: 0,
  starter: 0,
  pro: 10,
  agency: null, // unlimited
};

// Funnel page limits
export const FUNNEL_LIMITS = {
  free: 0,
  starter: 0,
  pro: 20,
  agency: null, // unlimited
};

// Template limits
export const TEMPLATE_LIMITS = {
  free: 0,
  starter: 0,
  pro: 10,
  agency: null, // unlimited
};

// Audit history (days)
export const AUDIT_HISTORY_LIMITS = {
  free: 0,
  starter: 0,
  pro: 30,
  agency: 90,
};
