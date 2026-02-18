/**
 * TikTok Pixel Generator — Generates ttq.track(...) calls.
 */

import { PAGE_TYPES } from '../../shared/constants.js';

export class TikTokGenerator {
  /**
   * Generate TikTok Pixel events based on page type and extracted data.
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
          events.push(this._viewContentList(ecommerceData));
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
          events.push(this._placeAnOrder(ecommerceData));
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
      content_id: product.id || product.sku || '',
      content_type: 'product',
      content_name: product.name,
      value: product.price,
      currency,
    };

    if (product.quantity) params.quantity = product.quantity;
    if (product.brand) params.brand = product.brand;

    return this._createEvent('ViewContent', params, PAGE_TYPES.PRODUCT);
  }

  _viewContentList(data) {
    const currency = data.currency || 'USD';
    const contents = data.productImpressions.slice(0, 20).map((p) => ({
      content_id: p.id || p.sku || '',
      content_name: p.name,
      quantity: p.quantity || 1,
      price: p.price,
    }));

    const params = {
      contents,
      content_type: 'product',
      currency,
    };

    return this._createEvent('ViewContent', params, PAGE_TYPES.COLLECTION);
  }

  _viewCart(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const contents = cart.items.map((p) => ({
      content_id: p.id || p.sku || '',
      content_name: p.name,
      quantity: p.quantity || 1,
      price: p.price,
    }));

    const params = {
      contents,
      value: cart.totalValue,
      currency,
    };

    return this._createEvent('ViewCart', params, PAGE_TYPES.CART);
  }

  _initiateCheckout(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const contents = cart.items.map((p) => ({
      content_id: p.id || p.sku || '',
      content_name: p.name,
      quantity: p.quantity || 1,
      price: p.price,
    }));

    const params = {
      contents,
      value: cart.totalValue,
      currency,
    };

    return this._createEvent('InitiateCheckout', params, PAGE_TYPES.CHECKOUT);
  }

  _placeAnOrder(data) {
    const order = data.order;
    const currency = order.currency || data.currency || 'USD';

    const contents = order.items.map((p) => ({
      content_id: p.id || p.sku || '',
      content_name: p.name,
      quantity: p.quantity || 1,
      price: p.price,
    }));

    const params = {
      contents,
      value: order.value,
      currency,
      order_id: order.transactionId,
    };

    return this._createEvent('PlaceAnOrder', params, PAGE_TYPES.THANK_YOU);
  }

  _search(data) {
    const query =
      data.searchTerm ||
      new URLSearchParams(window.location.search).get('q') ||
      new URLSearchParams(window.location.search).get('s') ||
      '';

    const params = {
      query,
    };

    return this._createEvent('Search', params, PAGE_TYPES.SEARCH);
  }

  _createEvent(eventName, params, pageType) {
    const code = `ttq.track('${eventName}', ${JSON.stringify(params, null, 2)});`;

    return {
      platform: 'tiktok',
      eventName,
      code,
      data: params,
      pageType,
    };
  }
}
