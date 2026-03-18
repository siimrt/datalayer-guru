/**
 * Canonical Audit Resolver — shared between AuditPanel (UI) and PDF report.
 *
 * Determines which canonical events are expected for a page type,
 * checks all 4 detection sources (diff, existingEvents, dataLayerStream, network),
 * and returns structured results.
 */

import { enhanceAuditWithNetworkData, findNetworkMatchForEvent } from '../sidepanel/utils/network-audit-enhancer.js';

// ─── Canonical Events ────────────────────────────────────────────────────────

export const CANONICAL_EVENTS = {
  view_item: { label: 'Product View', platforms: { ga4: 'view_item', google_ads: 'conversion', meta: 'ViewContent', tiktok: 'ViewContent', pinterest: 'pagevisit', snapchat: 'VIEW_CONTENT' } },
  add_to_cart: { label: 'Add to Cart', platforms: { ga4: 'add_to_cart', google_ads: 'conversion', meta: 'AddToCart', tiktok: 'AddToCart', pinterest: 'addtocart', snapchat: 'ADD_CART' } },
  view_item_list: { label: 'Collection View', platforms: { ga4: 'view_item_list', meta: 'ViewCategory', tiktok: 'ViewContent', pinterest: 'viewcategory', snapchat: 'LIST_VIEW' } },
  view_cart: { label: 'View Cart', platforms: { ga4: 'view_cart', meta: 'ViewCart', tiktok: 'ViewCart' } },
  begin_checkout: { label: 'Begin Checkout', platforms: { ga4: 'begin_checkout', google_ads: 'conversion', meta: 'InitiateCheckout', tiktok: 'InitiateCheckout', snapchat: 'START_CHECKOUT' } },
  add_shipping_info: { label: 'Add Shipping Info', platforms: { ga4: 'add_shipping_info' } },
  add_payment_info: { label: 'Add Payment Info', platforms: { ga4: 'add_payment_info', snapchat: 'ADD_BILLING' } },
  purchase: { label: 'Purchase', platforms: { ga4: 'purchase', google_ads: 'conversion', meta: 'Purchase', tiktok: 'PlaceAnOrder', pinterest: 'checkout', snapchat: 'PURCHASE' } },
  search: { label: 'Search', platforms: { ga4: 'search', meta: 'Search', tiktok: 'Search', pinterest: 'search', snapchat: 'SEARCH' } },
};

export const CANONICAL_EVENTS_LEADGEN = {
  generate_lead: { label: 'Lead Generated', platforms: { ga4: 'generate_lead', meta: 'Lead', tiktok: 'SubmitForm', pinterest: 'lead', snapchat: 'SIGN_UP' } },
  contact: { label: 'Contact', platforms: { ga4: 'generate_lead', meta: 'Contact', tiktok: 'Contact' } },
  sign_up: { label: 'Sign Up', platforms: { ga4: 'sign_up', meta: 'CompleteRegistration', tiktok: 'CompleteRegistration', pinterest: 'signup', snapchat: 'SIGN_UP' } },
  schedule: { label: 'Schedule / Demo', platforms: { ga4: 'schedule', meta: 'Schedule' } },
};

// ─── Expected Events per Page Type ───────────────────────────────────────────

export const EXPECTED_EVENTS_BY_PAGE = {
  product: ['view_item', 'add_to_cart'],
  collection: ['view_item_list'],
  cart: ['view_cart'],
  checkout: ['begin_checkout', 'add_shipping_info', 'add_payment_info'],
  thank_you: ['purchase'],
  search: ['search'],
};

export const EXPECTED_EVENTS_BY_PAGE_LEADGEN = {
  contact: ['generate_lead', 'contact'],
  form_page: ['generate_lead'],
  demo_request: ['generate_lead', 'schedule'],
  landing_page: ['generate_lead'],
  pricing: ['generate_lead'],
  confirmation: ['generate_lead', 'sign_up'],
  services: ['generate_lead'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract event name from a live dataLayer stream entry.
 * Handles both standard format ({event: 'xxx'}) and gtag format ({0: 'event', 1: 'xxx'}).
 */
export function extractEventNameFromStreamEntry(entry) {
  let data = entry.data;
  if (Array.isArray(data) && data.length === 1) data = data[0];
  if (Array.isArray(data) && data.length > 1) data = data[0];
  if (!data || typeof data !== 'object') return null;

  if (data.event) return data.event;
  if (data['0'] === 'event' && data['1']) return data['1'];
  return null;
}

/**
 * Resolve the effective CAPI event name for a platform event.
 * Uses per-event overrides if set, otherwise falls back to prefix + standard name.
 *
 * @param {string} platform - Platform key (e.g. 'meta', 'tiktok')
 * @param {string} platformEventName - Standard platform event name (e.g. 'ViewContent')
 * @param {object} capiPatterns - Prefix patterns per platform (e.g. { meta: 'meta_capi_' })
 * @param {object} capiOverrides - Per-event overrides (e.g. { meta: { ViewContent: 'meta_capi_view_item' } })
 * @returns {string|null} Effective CAPI event name, or null if no pattern configured
 */
export function getCapiEventName(platform, platformEventName, capiPatterns, capiOverrides) {
  // Check per-event override first
  if (capiOverrides && capiOverrides[platform] && capiOverrides[platform][platformEventName]) {
    return capiOverrides[platform][platformEventName];
  }
  // Fall back to prefix + standard name
  const pattern = capiPatterns && capiPatterns[platform];
  if (!pattern) return null;
  return pattern + platformEventName;
}

// ─── Canonical Audit Resolver ────────────────────────────────────────────────

/**
 * Resolve canonical audit results from the full application state.
 *
 * Checks all 4 detection sources per platform:
 * 1. Enhanced diffs (dataLayer match/partial)
 * 2. existingEvents (initial dataLayer snapshot)
 * 3. dataLayerStream (live events pushed later)
 * 4. findNetworkMatchForEvent (direct network match)
 *
 * @param {object} state - Full application state
 * @returns {{ expectedKeys: string[], results: Array<{ key: string, label: string, platformResults: Array<{ platform: string, eventName: string, status: string, source: string }> }> }}
 */
export function resolveCanonicalAudit(state) {
  const pageType = state.pageType?.pageType || 'unknown';
  const rawDiff = state.audit?.diff || [];
  const existingEvents = state.audit?.existingEvents || [];
  const networkRequests = state.networkRequests || [];
  const dataLayerStream = state.dataLayerStream || [];

  const diffs = enhanceAuditWithNetworkData(rawDiff, networkRequests);

  // Precompute stream event names
  const streamEventNames = new Set();
  const streamEventNamesLower = new Set();
  for (const entry of dataLayerStream) {
    const name = extractEventNameFromStreamEntry(entry);
    if (name) {
      streamEventNames.add(name);
      streamEventNamesLower.add(name.toLowerCase());
    }
  }

  // Detected platforms
  const installedPlatforms = state.detectedPlatforms instanceof Set
    ? state.detectedPlatforms
    : new Set(state.detectedPlatforms || ['ga4']);

  // Site type
  const effectiveSiteType = state.siteTypeOverride || state.siteType?.siteType || 'unknown';
  const isLeadgen = effectiveSiteType === 'leadgen' || effectiveSiteType === 'hybrid';
  const isEcom = effectiveSiteType === 'ecommerce' || effectiveSiteType === 'hybrid';

  // Expected keys
  let expectedKeys = [];
  if (isEcom) expectedKeys.push(...(EXPECTED_EVENTS_BY_PAGE[pageType] || []));
  if (isLeadgen) expectedKeys.push(...(EXPECTED_EVENTS_BY_PAGE_LEADGEN[pageType] || []));
  if (expectedKeys.length === 0) {
    expectedKeys = EXPECTED_EVENTS_BY_PAGE[pageType] || EXPECTED_EVENTS_BY_PAGE_LEADGEN[pageType] || [];
  }

  const allCanonicalEvents = { ...CANONICAL_EVENTS, ...CANONICAL_EVENTS_LEADGEN };

  const results = [];

  for (const key of expectedKeys) {
    const canonical = allCanonicalEvents[key];
    if (!canonical) continue;

    const platformEntries = Object.entries(canonical.platforms)
      .filter(([platform]) => installedPlatforms.has(platform));

    if (platformEntries.length === 0) continue;

    const platformResults = [];

    for (const [platform, eventName] of platformEntries) {
      let status = 'missing';
      let source = '';

      // GA4: network-only detection (dataLayer is fed by CMS, not GA4)
      if (platform === 'ga4') {
        const netMatch = findNetworkMatchForEvent(platform, eventName, networkRequests);
        if (netMatch) {
          status = 'network';
          source = netMatch.source === 'custom_pixel' ? 'Custom Pixel' : 'network';
        }
        platformResults.push({ platform, eventName, status, source });
        continue;
      }

      const eventLower = eventName.toLowerCase();

      // Source 1: Enhanced diffs
      const diffResult = diffs.find((d) => d.expected?.eventName === eventName)
        || diffs.find((d) => d.expected?.eventName && d.expected.eventName.toLowerCase() === eventLower);
      if (diffResult) {
        if (diffResult.status === 'match' || diffResult.status === 'partial') {
          status = 'found'; source = 'dataLayer';
        } else if (diffResult.status === 'network_confirmed') {
          status = 'network';
          source = diffResult.networkMatch?.source === 'custom_pixel' ? 'Custom Pixel' : 'network';
        }
      }

      // Source 2: existingEvents
      if (status === 'missing') {
        const exists = existingEvents.some((e) =>
          e.event === eventName || (e.event && e.event.toLowerCase() === eventLower)
        );
        if (exists) { status = 'found'; source = 'dataLayer'; }
      }

      // Source 3: dataLayerStream
      if (status === 'missing' && (streamEventNames.has(eventName) || streamEventNamesLower.has(eventLower))) {
        status = 'found'; source = 'dataLayer';
      }

      // Source 4: Network fallback
      if (status === 'missing') {
        const netMatch = findNetworkMatchForEvent(platform, eventName, networkRequests);
        if (netMatch) {
          status = 'network';
          source = netMatch.source === 'custom_pixel' ? 'Custom Pixel' : 'network';
        }
      }

      platformResults.push({ platform, eventName, status, source });
    }

    results.push({ key, label: canonical.label, platformResults });
  }

  return { expectedKeys, results, diffs };
}
