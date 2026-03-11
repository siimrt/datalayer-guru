/**
 * GA4 Generator — Generates GA4-compliant dataLayer.push() events
 * following Google's ecommerce documentation exactly.
 */

import { PAGE_TYPES } from '../../shared/constants.js';

export class GA4Generator {
  /**
   * Generate GA4 events based on page type and extracted ecommerce data.
   *
   * @param {string} pageType
   * @param {Object} ecommerceData - Normalized ecommerce data from extractor
   * @returns {Array<GeneratedEvent>}
   */
  generate(pageType, ecommerceData) {
    if (!ecommerceData) return [];

    const events = [];

    switch (pageType) {
      case PAGE_TYPES.PRODUCT:
        if (ecommerceData.product) {
          events.push(this._viewItem(ecommerceData));
        }
        break;

      case PAGE_TYPES.COLLECTION:
        if (ecommerceData.productImpressions?.length > 0) {
          events.push(this._viewItemList(ecommerceData));
        }
        break;

      case PAGE_TYPES.CART:
        if (ecommerceData.cart) {
          events.push(this._viewCart(ecommerceData));
        }
        break;

      case PAGE_TYPES.CHECKOUT:
        if (ecommerceData.cart) {
          events.push(this._beginCheckout(ecommerceData));
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

    // Always generate page_view
    events.push(this._pageView());

    return events;
  }

  _viewItem(data) {
    const product = data.product;
    const currency = data.currency || product.currency || 'USD';
    const items = [this._formatItem(product, 0)];

    const eventObj = {
      event: 'view_item',
      ecommerce: {
        currency,
        value: product.price,
        items,
      },
    };

    return this._createEvent('view_item', eventObj, PAGE_TYPES.PRODUCT);
  }

  _viewItemList(data) {
    const currency = data.currency || data.productImpressions[0]?.currency || 'USD';
    const listName = data.productImpressions[0]?.listName || 'Collection';
    const listId = listName.toLowerCase().replace(/\s+/g, '_');

    const items = data.productImpressions.map((p, i) =>
      this._formatItem(p, p.position ?? i, listId, listName)
    );

    const eventObj = {
      event: 'view_item_list',
      ecommerce: {
        item_list_id: listId,
        item_list_name: listName,
        items,
      },
    };

    return this._createEvent('view_item_list', eventObj, PAGE_TYPES.COLLECTION);
  }

  _viewCart(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const items = cart.items.map((p, i) => this._formatItem(p, i));

    const eventObj = {
      event: 'view_cart',
      ecommerce: {
        currency,
        value: cart.totalValue,
        items,
      },
    };

    return this._createEvent('view_cart', eventObj, PAGE_TYPES.CART);
  }

  _beginCheckout(data) {
    const cart = data.cart;
    const currency = cart.currency || data.currency || 'USD';

    const items = cart.items.map((p, i) => this._formatItem(p, i));

    const eventObj = {
      event: 'begin_checkout',
      ecommerce: {
        currency,
        value: cart.totalValue,
        items,
      },
    };

    if (cart.coupon) {
      eventObj.ecommerce.coupon = cart.coupon;
    }

    return this._createEvent('begin_checkout', eventObj, PAGE_TYPES.CHECKOUT);
  }

  _purchase(data) {
    const order = data.order;
    const currency = order.currency || data.currency || 'USD';

    const items = order.items.map((p, i) => this._formatItem(p, i));

    const eventObj = {
      event: 'purchase',
      ecommerce: {
        transaction_id: order.transactionId,
        value: order.value,
        currency,
        items,
      },
    };

    if (order.tax != null) eventObj.ecommerce.tax = order.tax;
    if (order.shipping != null) eventObj.ecommerce.shipping = order.shipping;
    if (order.coupon) eventObj.ecommerce.coupon = order.coupon;
    if (order.affiliation) eventObj.ecommerce.affiliation = order.affiliation;

    return this._createEvent('purchase', eventObj, PAGE_TYPES.THANK_YOU);
  }

  _search(data) {
    const searchTerm =
      data.searchTerm ||
      new URLSearchParams(window.location.search).get('q') ||
      new URLSearchParams(window.location.search).get('s') ||
      '';

    const eventObj = {
      event: 'search',
      search_term: searchTerm,
    };

    return this._createEvent('search', eventObj, PAGE_TYPES.SEARCH);
  }

  _pageView() {
    const eventObj = {
      event: 'page_view',
      page_title: document.title,
      page_location: window.location.href,
    };

    return this._createEvent('page_view', eventObj, 'any');
  }

  /**
   * Format a product into a GA4 items[] item following the spec exactly.
   */
  _formatItem(product, index = 0, listId = null, listName = null) {
    const item = {};

    if (product.id || product.sku) item.item_id = product.sku || product.id;
    if (product.name) item.item_name = product.name;
    if (product.brand) item.item_brand = product.brand;

    // Categories — split by " > " or "/" if present
    if (product.category) {
      const cats = product.category.split(/\s*[>\/]\s*/);
      if (cats[0]) item.item_category = cats[0];
      if (cats[1]) item.item_category2 = cats[1];
      if (cats[2]) item.item_category3 = cats[2];
      if (cats[3]) item.item_category4 = cats[3];
      if (cats[4]) item.item_category5 = cats[4];
    }

    if (product.variant) item.item_variant = product.variant;
    if (product.price != null) item.price = product.price;
    if (product.quantity != null) item.quantity = product.quantity;
    if (product.discount) item.discount = product.discount;

    item.index = index;

    if (listId || product.listId) item.item_list_id = listId || product.listId;
    if (listName || product.listName) item.item_list_name = listName || product.listName;

    return item;
  }

  /**
   * Create a GeneratedEvent object with formatted code string.
   */
  _createEvent(eventName, eventObj, pageType) {
    const code =
      `dataLayer.push({ ecommerce: null });\ndataLayer.push(${JSON.stringify(eventObj, null, 2)});`;

    return {
      platform: 'ga4',
      eventName,
      code,
      data: eventObj,
      pageType,
    };
  }
}
