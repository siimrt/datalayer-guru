/**
 * Pinterest Tag Generator — Generates pintrk('track', ...) calls.
 */

import { PAGE_TYPES } from '../../shared/constants.js';

export class PinterestGenerator {
  /**
   * Generate Pinterest Tag events based on page type and extracted data.
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
          events.push(this._pageVisit(ecommerceData));
        }
        break;

      case PAGE_TYPES.COLLECTION:
        if (ecommerceData.productImpressions?.length > 0) {
          events.push(this._viewCategory(ecommerceData));
        }
        break;

      case PAGE_TYPES.CART:
        if (ecommerceData.cart) {
          events.push(this._addToCart(ecommerceData));
        }
        break;

      case PAGE_TYPES.THANK_YOU:
        if (ecommerceData.order) {
          events.push(this._checkout(ecommerceData));
        }
        break;

      case PAGE_TYPES.SEARCH:
        events.push(this._search(ecommerceData));
        break;
    }

    return events;
  }

  _pageVisit(data) {
    const product = data.product;
    const currency = data.currency || product.currency || 'USD';

    const params = {
      product_id: product.id || product.sku || '',
      product_name: product.name,
      product_price: product.price,
      product_currency: currency,
    };

    if (product.category) params.product_category = product.category;
    if (product.brand) params.product_brand = product.brand;

    return this._createEvent('pagevisit', params, PAGE_TYPES.PRODUCT);
  }

  _viewCategory(data) {
    const listName = data.productImpressions[0]?.listName || 'Collection';
    const lineItems = data.productImpressions.slice(0, 20).map((p) => ({
      product_id: p.id || p.sku || '',
      product_name: p.name,
      product_price: p.price,
      product_quantity: p.quantity || 1,
    }));

    const params = {
      product_category: listName,
      line_items: lineItems,
    };

    return this._createEvent('viewcategory', params, PAGE_TYPES.COLLECTION);
  }

  _addToCart(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const lineItems = cart.items.map((p) => ({
      product_id: p.id || p.sku || '',
      product_name: p.name,
      product_price: p.price,
      product_quantity: p.quantity || 1,
    }));

    const params = {
      value: cart.totalValue,
      currency,
      line_items: lineItems,
    };

    return this._createEvent('addtocart', params, PAGE_TYPES.CART);
  }

  _checkout(data) {
    const order = data.order;
    const currency = order.currency || data.currency || 'USD';

    const lineItems = order.items.map((p) => ({
      product_id: p.id || p.sku || '',
      product_name: p.name,
      product_price: p.price,
      product_quantity: p.quantity || 1,
    }));

    const params = {
      value: order.value,
      currency,
      order_id: order.transactionId,
      line_items: lineItems,
    };

    return this._createEvent('checkout', params, PAGE_TYPES.THANK_YOU);
  }

  _search(data) {
    const searchQuery =
      data.searchTerm ||
      new URLSearchParams(window.location.search).get('q') ||
      new URLSearchParams(window.location.search).get('s') ||
      '';

    const params = {
      search_query: searchQuery,
    };

    return this._createEvent('search', params, PAGE_TYPES.SEARCH);
  }

  _createEvent(eventName, params, pageType) {
    const code = `pintrk('track', '${eventName}', ${JSON.stringify(params, null, 2)});`;

    return {
      platform: 'pinterest',
      eventName,
      code,
      data: params,
      pageType,
    };
  }
}
