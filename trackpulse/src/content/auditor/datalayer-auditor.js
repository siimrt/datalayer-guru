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
        // Has a known ecommerce event name (standard format)
        if (entry.event && ecommerceEventNames.has(entry.event)) return true;
        // gtag-style push: {0: 'event', 1: 'view_item', 2: {items: [...]}}
        if (entry['0'] === 'event' && ecommerceEventNames.has(entry['1'])) return true;
        return false;
      })
      .map((entry, index) => {
        // Extract event name: standard format or gtag format
        let eventName = entry.event;
        let data = entry;
        let hasEcommerce = !!entry.ecommerce;

        if (!eventName && entry['0'] === 'event' && entry['1']) {
          eventName = entry['1'];
          const params = entry['2'] || {};

          // Normalize gtag flat format into standard ecommerce wrapper
          // gtag pushes: {0:'event', 1:'add_to_cart', 2:{value, currency, items, ecomm_prodid, ...}}
          const ecomFields = ['value', 'currency', 'tax', 'shipping', 'coupon',
            'transaction_id', 'affiliation', 'item_list_id', 'item_list_name'];
          const ecomData = {};
          for (const f of ecomFields) {
            if (f in params) ecomData[f] = params[f];
          }
          if (params.items) ecomData.items = params.items;
          if (params.ecommerce && typeof params.ecommerce === 'object') {
            Object.assign(ecomData, params.ecommerce);
          }

          // Map Shopify ecomm_* fields as fallbacks for standard GA4 fields
          if (!('value' in ecomData) && params.ecomm_totalvalue != null) {
            ecomData.value = params.ecomm_totalvalue;
          }

          data = { event: eventName };
          if (Object.keys(ecomData).length > 0) {
            data.ecommerce = ecomData;
            hasEcommerce = true;
          }
          // Preserve non-ecommerce top-level fields (skip ecom-related)
          const skip = new Set([...ecomFields, 'items', 'ecommerce']);
          for (const [k, v] of Object.entries(params)) {
            if (!skip.has(k) && !k.startsWith('ecomm_')) data[k] = v;
          }
        }

        return {
          index,
          event: eventName || 'unknown',
          data,
          hasEcommerce,
          timestamp: entry['gtm.uniqueEventId'] || null,
        };
      });
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
