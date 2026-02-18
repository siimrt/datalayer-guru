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
  'starter-monthly': 'starter',
  'starter-annual': 'starter',
  'pro-monthly': 'pro',
  'pro-annual': 'pro',
  'agency-monthly': 'agency',
  'agency-annual': 'agency',
};

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
