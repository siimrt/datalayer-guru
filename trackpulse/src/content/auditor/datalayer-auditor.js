/**
 * DataLayer Auditor — Reads the current page's dataLayer array
 * and extracts ecommerce-relevant events.
 */

export class DataLayerAuditor {
  constructor(pageContext = {}) {
    this.dataLayer = pageContext.dataLayer || [];
  }

  /**
   * Get all ecommerce events currently in dataLayer.
   * An ecommerce event is one that has an `ecommerce` key or matches known event names.
   */
  getEcommerceEvents() {
    const ecommerceEventNames = new Set([
      'view_item',
      'view_item_list',
      'select_item',
      'add_to_cart',
      'remove_from_cart',
      'view_cart',
      'begin_checkout',
      'add_shipping_info',
      'add_payment_info',
      'purchase',
      'refund',
      'view_promotion',
      'select_promotion',
      'search',
    ]);

    return this.dataLayer
      .filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        // Has ecommerce key
        if (entry.ecommerce) return true;
        // Has a known ecommerce event name
        if (entry.event && ecommerceEventNames.has(entry.event)) return true;
        return false;
      })
      .map((entry, index) => ({
        index,
        event: entry.event || 'unknown',
        data: entry,
        hasEcommerce: !!entry.ecommerce,
        timestamp: entry['gtm.uniqueEventId'] || null,
      }));
  }

  /**
   * Get all events in the dataLayer.
   */
  getAllEvents() {
    return this.dataLayer
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry, index) => ({
        index,
        event: entry.event || (Array.isArray(entry) ? entry[0] : 'data'),
        data: entry,
        hasEcommerce: !!entry.ecommerce,
      }));
  }

  /**
   * Check if a specific event type exists in the dataLayer.
   */
  hasEvent(eventName) {
    return this.dataLayer.some(
      (entry) => entry?.event === eventName
    );
  }

  /**
   * Find the first event matching the given name.
   */
  findEvent(eventName) {
    return this.dataLayer.find(
      (entry) => entry?.event === eventName
    ) || null;
  }

  /**
   * Get ecommerce events matching a specific GA4 event name.
   */
  getEventsByName(eventName) {
    return this.dataLayer.filter(
      (entry) => entry?.event === eventName
    );
  }
}
