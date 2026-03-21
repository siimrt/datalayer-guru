/**
 * Network Quality Auditor
 *
 * Analyzes captured network requests for dedup and data quality signals.
 * Returns per-event quality flags used by AuditPanel to show inline badges.
 *
 * Pure function — no DOM access, no chrome API calls.
 */

// Conversion events by platform (events where dedup matters)
const CONVERSION_EVENTS = {
  ga4: new Set(['purchase', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'generate_lead', 'sign_up']),
  meta: new Set(['Purchase', 'AddToCart', 'InitiateCheckout', 'Lead', 'CompleteRegistration', 'AddPaymentInfo']),
  tiktok: new Set(['CompletePayment', 'PlaceAnOrder', 'AddToCart', 'InitiateCheckout', 'SubmitForm', 'CompleteRegistration']),
  pinterest: new Set(['checkout', 'addtocart', 'lead', 'signup']),
  snapchat: new Set(['PURCHASE', 'ADD_CART', 'START_CHECKOUT', 'SIGN_UP']),
  google_ads: new Set(['conversion']),
  linkedin: new Set(['conversion']),
};

// Platforms where advanced matching / user data is relevant
const USER_DATA_PLATFORMS = new Set(['meta', 'tiktok', 'pinterest']);

/**
 * Check if an event is a conversion event for the given platform.
 *
 * @param {string} platform - Platform key (e.g. 'ga4', 'meta', 'tiktok')
 * @param {string} eventName - The event name to check
 * @returns {boolean}
 */
export function isConversionEvent(platform, eventName) {
  const events = CONVERSION_EVENTS[platform];
  return events ? events.has(eventName) : false;
}

/**
 * Check if a platform supports advanced matching / user data signals.
 *
 * @param {string} platform - Platform key
 * @returns {boolean}
 */
export function supportsUserData(platform) {
  return USER_DATA_PLATFORMS.has(platform);
}

/**
 * Analyze network requests for quality signals.
 *
 * For each unique platform::eventName pair, produces quality flags:
 * - dedupPresent: whether an event_id or transaction_id was found
 * - userDataPresent: whether advanced matching / user data was detected
 * - valuePresent: whether a monetary value was included
 * - isDuplicate: whether the same transaction_id was sent more than once
 *
 * @param {Array} networkRequests - state.networkRequests (each entry has .dedup and .quality from parsers)
 * @param {string} pageHostname - Current page hostname (reserved for future per-domain logic)
 * @returns {{ eventQuality: Map<string, { dedupPresent: boolean, userDataPresent: boolean, valuePresent: boolean, isDuplicate: boolean }> }}
 */
export function auditNetworkQuality(networkRequests, pageHostname) {
  const eventQuality = new Map();

  if (!networkRequests || networkRequests.length === 0) {
    return { eventQuality };
  }

  // Track transaction IDs per platform to detect duplicates
  const txnTracker = new Map(); // key: `${platform}::${transactionId}` -> count

  for (const req of networkRequests) {
    if (!req.platform || !req.eventName) continue;

    const key = `${req.platform}::${req.eventName}`;
    const dedup = req.dedup || { eventId: null, transactionId: null };
    const quality = req.quality || { userDataFields: [], userDataCount: 0, hasAdvancedMatching: false, hasValue: false, hasCurrency: false, hasItems: false };

    const dedupPresent = !!(dedup.eventId || dedup.transactionId);
    const userDataPresent = quality.hasAdvancedMatching;
    const valuePresent = quality.hasValue;

    // Track transaction IDs for duplicate detection
    if (dedup.transactionId) {
      const txnKey = `${req.platform}::${dedup.transactionId}`;
      txnTracker.set(txnKey, (txnTracker.get(txnKey) || 0) + 1);
    }

    // If we already have an entry for this key, merge (keep best signals)
    const existing = eventQuality.get(key);
    if (existing) {
      existing.dedupPresent = existing.dedupPresent || dedupPresent;
      existing.userDataPresent = existing.userDataPresent || userDataPresent;
      existing.valuePresent = existing.valuePresent || valuePresent;
    } else {
      eventQuality.set(key, {
        dedupPresent,
        userDataPresent,
        valuePresent,
        isDuplicate: false, // resolved in second pass
      });
    }
  }

  // Second pass: mark duplicates where the same transaction ID appears more than once
  for (const req of networkRequests) {
    if (!req.dedup?.transactionId || !req.eventName) continue;
    const txnKey = `${req.platform}::${req.dedup.transactionId}`;
    if ((txnTracker.get(txnKey) || 0) > 1) {
      const key = `${req.platform}::${req.eventName}`;
      const entry = eventQuality.get(key);
      if (entry) entry.isDuplicate = true;
    }
  }

  return { eventQuality };
}
