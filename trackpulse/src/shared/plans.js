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

// Plan display configuration (uses rgba for dual-theme support)
export const PLAN_CONFIG = {
  free: { label: 'FREE', bg: 'rgba(155, 155, 174, 0.12)', text: 'var(--tp-text-muted)', border: 'rgba(155, 155, 174, 0.2)' },
  starter: { label: 'STARTER', bg: 'rgba(91, 155, 213, 0.12)', text: '#5B9BD5', border: 'rgba(91, 155, 213, 0.2)' },
  pro: { label: 'PRO', bg: 'rgba(108, 92, 231, 0.12)', text: '#6C5CE7', border: 'rgba(108, 92, 231, 0.2)' },
  agency: { label: 'AGENCY', bg: 'rgba(253, 203, 110, 0.15)', text: '#D4A017', border: 'rgba(253, 203, 110, 0.25)' },
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
