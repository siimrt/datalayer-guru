/**
 * PostHog Analytics Module for Traacky Extension.
 * Uses posthog-js-lite (MV3 compatible, no remote code execution).
 *
 * Setup:
 *   1. Copy .env.example to .env.local
 *   2. Set VITE_POSTHOG_KEY=phc_xxx (from PostHog project settings)
 *   3. Rebuild — the key is injected at build time via Vite, never committed.
 *
 * Docs: https://posthog.com/docs/libraries/js-lite (npm: posthog-js-lite)
 */

import PostHog from 'posthog-js-lite';

// ---- Configuration (injected at build time by Vite) ----
const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

// ---- Singleton ----
let posthog = null;

/**
 * Initialize PostHog analytics.
 * Call once at app startup (sidepanel open).
 * No-op if API key is not configured.
 */
export function initAnalytics() {
  if (posthog) return; // Already initialized
  if (!POSTHOG_API_KEY) {
    console.debug('[Traacky Analytics] VITE_POSTHOG_KEY not set — analytics disabled.');
    return;
  }

  try {
    posthog = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      flushAt: 10,         // Batch up to 10 events before flushing
      flushInterval: 30000, // Flush every 30s
    });

    // Generate or retrieve a stable anonymous ID from chrome.storage
    chrome.storage.local.get('tp_analytics_id', (data) => {
      let anonId = data.tp_analytics_id;
      if (!anonId) {
        anonId = 'tp_' + crypto.randomUUID();
        chrome.storage.local.set({ tp_analytics_id: anonId });
      }
      posthog.identify(anonId);
    });

    console.debug('[Traacky Analytics] PostHog initialized.');
  } catch (e) {
    console.warn('[Traacky Analytics] Init failed:', e);
    posthog = null;
  }
}

/**
 * Track a named event with optional properties.
 */
export function trackEvent(eventName, properties = {}) {
  if (!posthog) return;
  try {
    posthog.capture(eventName, properties);
  } catch (e) {
    // Silent — never break the app for analytics
  }
}

/**
 * Identify the user and set person properties (plan, email).
 * posthog-js-lite identify(distinctId, properties):
 *   - distinctId: if undefined, keeps the current ID
 *   - properties: flat object treated as $set (person properties)
 */
export function identifyUser(plan, email) {
  if (!posthog) return;
  try {
    const props = { plan };
    if (email) props.email = email;
    posthog.identify(undefined, props);
  } catch (e) {}
}

/**
 * Reset analytics state (e.g. on logout / extension reset).
 */
export function resetAnalytics() {
  if (!posthog) return;
  try {
    posthog.reset();
  } catch (e) {}
}
