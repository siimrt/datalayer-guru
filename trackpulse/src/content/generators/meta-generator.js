/**
 * Meta/Facebook Pixel Generator — Generates fbq('track', ...) calls.
 */

import { PAGE_TYPES } from '../../shared/constants.js';

export class MetaGenerator {
  /**
   * Generate Meta Pixel events based on page type and extracted data.
   *
   * @param {string} pageType
   * @param {Object} ecommerceData
   * @returns {Array<GeneratedEvent>}
   */
  generate(pageType, ecommerceData) {
    if (!ecommerceData) return [];

    const events = [];

    switch (pageType) {
      case PAGE_TYPES.PRODUCT:
        if (ecommerceData.product) {
          events.push(this._viewContent(ecommerceData));
        }
        break;

      case PAGE_TYPES.COLLECTION:
        if (ecommerceData.productImpressions?.length > 0) {
          events.push(this._viewCategory(ecommerceData));
        }
        break;

      case PAGE_TYPES.CART:
        if (ecommerceData.cart) {
          events.push(this._viewCart(ecommerceData));
        }
        break;

      case PAGE_TYPES.CHECKOUT:
        if (ecommerceData.cart) {
          events.push(this._initiateCheckout(ecommerceData));
        }
        break;

      case PAGE_TYPES.THANK_YOU:
        if (ecommerceData.order) {
          events.push(this._purchase(ecommerceData));
        }
        break;

      case PAGE_TYPES.SEARCH:
        events.push(this._search(ecommerceData));
        break;
    }

    return events;
  }

  _viewContent(data) {
    const product = data.product;
    const currency = data.currency || product.currency || 'USD';

    const params = {
      content_ids: [product.id || product.sku || ''],
      content_type: 'product',
      content_name: product.name,
      value: product.price,
      currency,
    };

    if (product.category) params.content_category = product.category;

    return this._createEvent('ViewContent', params, PAGE_TYPES.PRODUCT);
  }

  _viewCategory(data) {
    const currency = data.currency || 'USD';
    const contentIds = data.productImpressions
      .slice(0, 10)
      .map((p) => p.id || p.sku || '')
      .filter(Boolean);

    const listName = data.productImpressions[0]?.listName || 'Collection';

    const params = {
      content_type: 'product',
      content_ids: contentIds,
      content_category: listName,
    };

    return this._createEvent('ViewCategory', params, PAGE_TYPES.COLLECTION);
  }

  _viewCart(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const contentIds = cart.items
      .map((p) => p.id || p.sku || '')
      .filter(Boolean);

    const params = {
      content_ids: contentIds,
      content_type: 'product',
      value: cart.totalValue,
      currency,
      num_items: cart.itemCount || cart.items.length,
    };

    return this._createEvent('ViewCart', params, PAGE_TYPES.CART);
  }

  _initiateCheckout(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const contentIds = cart.items
      .map((p) => p.id || p.sku || '')
      .filter(Boolean);

    const params = {
      content_ids: contentIds,
      content_type: 'product',
      value: cart.totalValue,
      currency,
      num_items: cart.itemCount || cart.items.length,
    };

    return this._createEvent('InitiateCheckout', params, PAGE_TYPES.CHECKOUT);
  }

  _purchase(data) {
    const order = data.order;
    const currency = order.currency || data.currency || 'USD';

    const contentIds = order.items
      .map((p) => p.id || p.sku || '')
      .filter(Boolean);

    const params = {
      content_ids: contentIds,
      content_type: 'product',
      value: order.value,
      currency,
      order_id: order.transactionId,
      num_items: order.items.length,
    };

    return this._createEvent('Purchase', params, PAGE_TYPES.THANK_YOU);
  }

  _search(data) {
    const searchTerm =
      data.searchTerm ||
      new URLSearchParams(window.location.search).get('q') ||
      new URLSearchParams(window.location.search).get('s') ||
      '';

    const params = {
      search_string: searchTerm,
    };

    if (data.productImpressions?.length > 0) {
      params.content_ids = data.productImpressions
        .slice(0, 10)
        .map((p) => p.id || '')
        .filter(Boolean);
    }

    return this._createEvent('Search', params, PAGE_TYPES.SEARCH);
  }

  _createEvent(eventName, params, pageType) {
    const code = `fbq('track', '${eventName}', ${JSON.stringify(params, null, 2)});`;

    return {
      platform: 'meta',
      eventName,
      code,
      data: params,
      pageType,
    };
  }
}
