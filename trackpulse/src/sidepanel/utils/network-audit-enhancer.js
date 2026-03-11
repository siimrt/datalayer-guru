/**
 * Network Audit Enhancer
 *
 * Upgrades audit diff entries from 'missing' to 'network_confirmed'
 * when a matching network request proves the event was actually sent.
 *
 * This solves the Shopify checkout sandbox problem where events fire
 * via network requests but aren't visible in the main page's dataLayer.
 */

// Normalize any platform string (lowercase or titlecase) to the network key (lowercase)
// Handles both diff.expected.platform ('ga4') and AuditPanel labels ('GA4')
const NORMALIZE_PLATFORM = {
  ga4: 'ga4', GA4: 'ga4',
  google_ads: 'google_ads', 'Google Ads': 'google_ads',
  meta: 'meta', Meta: 'meta',
  tiktok: 'tiktok', TikTok: 'tiktok',
  pinterest: 'pinterest', Pinterest: 'pinterest',
  snapchat: 'snapchat', Snapchat: 'snapchat',
  linkedin: 'linkedin', LinkedIn: 'linkedin',
};

/**
 * Check if a network request matches a given platform + event name.
 *
 * Event names match directly across all platforms:
 *   GA4: begin_checkout = network en=begin_checkout
 *   Meta: InitiateCheckout = network ev=InitiateCheckout
 *   TikTok: InitiateCheckout = network event=InitiateCheckout
 *   Pinterest: pagevisit = network event=pagevisit
 */
// Meta event aliases — maps custom SDK event names (e.g. Reaktion) to standard Meta events
const META_EVENT_ALIASES = {
  viewcontent: ['reaktionmicroproductview', 'reaktionmicropageview', 'reaktionmicroviewcontent'],
  addtocart: ['reaktionmicroaddtocart'],
  initiatecheckout: ['reaktionmicroinitiatecheckout'],
  purchase: ['reaktionmicropurchase'],
  search: ['reaktionmicrosearch'],
  addpaymentinfo: ['reaktionmicroaddpaymentinfo'],
};

function findNetworkMatch(platformInput, eventName, networkRequests) {
  const networkPlatform = NORMALIZE_PLATFORM[platformInput];
  if (!networkPlatform || !eventName) return null;

  const eventLower = eventName.toLowerCase();

  // First try exact match (fast path)
  const exact = networkRequests.find(
    (req) => req.platform === networkPlatform && req.eventName === eventName
  );
  if (exact) return exact;

  // Fallback: case-insensitive match (some SDKs use different casing)
  const caseInsensitive = networkRequests.find(
    (req) => req.platform === networkPlatform && req.eventName && req.eventName.toLowerCase() === eventLower
  );
  if (caseInsensitive) return caseInsensitive;

  // Meta: match custom event names (Reaktion, etc.) to standard Meta events
  if (networkPlatform === 'meta') {
    const aliases = META_EVENT_ALIASES[eventLower];
    if (aliases) {
      const aliasMatch = networkRequests.find(
        (req) => req.platform === 'meta' && req.eventName && aliases.includes(req.eventName.toLowerCase())
      );
      if (aliasMatch) return aliasMatch;
    }
  }

  // Google Ads: any conversion/remarketing request matches the generic 'conversion' event
  if (networkPlatform === 'google_ads' && eventLower === 'conversion') {
    return networkRequests.find(
      (req) => req.platform === 'google_ads' && req.eventName && req.eventName.startsWith('conversion')
    ) || null;
  }

  return null;
}

/**
 * Enhance audit diff results with network request data.
 *
 * For each diff entry with status 'missing', look for a matching network
 * request. If found, upgrade status to 'network_confirmed' and attach
 * the network match reference.
 *
 * @param {Array} auditDiff - state.audit.diff array
 * @param {Array} networkRequests - state.networkRequests array
 * @returns {Array} Enhanced diff array (new array, original not mutated)
 */
export function enhanceAuditWithNetworkData(auditDiff, networkRequests) {
  if (!networkRequests || networkRequests.length === 0) return auditDiff;

  return auditDiff.map((diff) => {
    if (diff.status !== 'missing') return diff;

    const platform = diff.expected?.platform || '';
    const eventName = diff.expected?.eventName || '';
    const match = findNetworkMatch(platform, eventName, networkRequests);

    if (match) {
      return {
        ...diff,
        status: 'network_confirmed',
        networkMatch: match,
      };
    }

    return diff;
  });
}

/**
 * Check if a specific platform + event has a network match.
 * Used by AuditPanel for Meta/TikTok events that aren't in the diff array.
 *
 * @param {string} platformInput - 'GA4', 'Meta', 'TikTok', or 'ga4', 'meta', 'tiktok', etc.
 * @param {string} eventName - The expected event name
 * @param {Array} networkRequests - state.networkRequests array
 * @returns {object|null} The matching network request, or null
 */
export function findNetworkMatchForEvent(platformInput, eventName, networkRequests) {
  return findNetworkMatch(platformInput, eventName, networkRequests);
}
