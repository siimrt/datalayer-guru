/**
 * PostHog Analytics Module for TrackPulse Extension.
 * Uses posthog-js-lite (MV3 compatible, no remote code execution).
 *
 * Setup: Replace POSTHOG_API_KEY with your PostHog project API key.
 * Dashboard: https://app.posthog.com
 */

import PostHog from 'posthog-js-lite';

// ---- Configuration ----
const POSTHOG_API_KEY = '__POSTHOG_API_KEY__'; // TODO: Replace with your PostHog project API key
const POSTHOG_HOST = 'https://eu.i.posthog.com'; // EU region; use 'https://us.i.posthog.com' for US

// ---- Singleton ----
let posthog = null;

/**
 * Initialize PostHog analytics.
 * Call once at app startup (sidepanel open).
 * No-op if API key is not configured.
 */
export function initAnalytics() {
  if (posthog) return; // Already initialized
  if (!POSTHOG_API_KEY || POSTHOG_API_KEY === '__POSTHOG_API_KEY__') {
    console.debug('[TrackPulse Analytics] PostHog API key not configured — analytics disabled.');
    return;
  }

  try {
    posthog = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      flushAt: 10,       // Batch up to 10 events before flushing
      flushInterval: 30000, // Flush every 30s
      captureMode: 'json',
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

    console.debug('[TrackPulse Analytics] PostHog initialized.');
  } catch (e) {
    console.warn('[TrackPulse Analytics] Init failed:', e);
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
 * Identify the user (e.g. after plan resolution).
 * Sets person properties on the PostHog user profile.
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
