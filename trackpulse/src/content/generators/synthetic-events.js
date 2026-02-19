/**
 * Synthetic Event Generator
 * Builds fake GA4 ecommerce events using real extracted page data + synthetic extras.
 * Used by the Quick Push UI in the sidepanel to test tracking without real actions.
 */

import { PAGE_TYPES } from '../../shared/constants.js';

/**
 * Given a page type and extracted ecommerce data, return an array of
 * synthetic events that are contextually relevant for pushing.
 *
 * @param {string} pageType - Detected page type
 * @param {Object} ecommerceData - Normalized ecommerce data from extractors
 * @returns {Array<{eventName: string, label: string, code: string, data: Object}>}
 */
export function getSyntheticEvents(pageType, ecommerceData) {
  if (!ecommerceData) return [];

  const events = [];

  switch (pageType) {
    case PAGE_TYPES.PRODUCT:
      if (ecommerceData.product) {
        events.push(buildAddToCart(ecommerceData));
      }
      break;

    case PAGE_TYPES.CART:
      if (ecommerceData.cart?.items?.length) {
        events.push(buildAddToCartFromCart(ecommerceData));
      }
      break;

    case PAGE_TYPES.CHECKOUT:
      if (ecommerceData.cart?.items?.length) {
        events.push(buildAddShippingInfo(ecommerceData));
        events.push(buildAddPaymentInfo(ecommerceData));
        events.push(buildPurchase(ecommerceData));
      }
      break;

    case PAGE_TYPES.THANK_YOU:
      if (ecommerceData.order) {
        events.push(buildPurchaseFromOrder(ecommerceData));
      }
      break;
  }

  return events.filter(Boolean);
}

// --- Event Builders ---

function buildAddToCart(data) {
  const product = data.product;
  const currency = data.currency || product.currency || 'USD';
  const item = formatItem(product, 0);
  item.quantity = 1;

  const eventObj = {
    event: 'add_to_cart',
    ecommerce: {
      currency,
      value: product.price,
      items: [item],
    },
  };

  return createSyntheticEvent('add_to_cart', 'Add to Cart', eventObj);
}

function buildAddToCartFromCart(data) {
  const cart = data.cart;
  const currency = cart.currency || data.currency || 'USD';
  const firstItem = cart.items[0];
  if (!firstItem) return null;

  const item = formatItem(firstItem, 0);
  item.quantity = 1;

  const eventObj = {
    event: 'add_to_cart',
    ecommerce: {
      currency,
      value: firstItem.price,
      items: [item],
    },
  };

  return createSyntheticEvent('add_to_cart', 'Add to Cart', eventObj);
}

function buildAddShippingInfo(data) {
  const cart = data.cart;
  const currency = cart.currency || data.currency || 'USD';
  const items = cart.items.map((p, i) => formatItem(p, i));

  const eventObj = {
    event: 'add_shipping_info',
    ecommerce: {
      currency,
      value: cart.totalValue,
      shipping_tier: 'Standard',
      items,
    },
  };

  if (cart.coupon) {
    eventObj.ecommerce.coupon = cart.coupon;
  }

  return createSyntheticEvent('add_shipping_info', 'Shipping Info', eventObj);
}

function buildAddPaymentInfo(data) {
  const cart = data.cart;
  const currency = cart.currency || data.currency || 'USD';
  const items = cart.items.map((p, i) => formatItem(p, i));

  const eventObj = {
    event: 'add_payment_info',
    ecommerce: {
      currency,
      value: cart.totalValue,
      payment_type: 'Credit Card',
      items,
    },
  };

  if (cart.coupon) {
    eventObj.ecommerce.coupon = cart.coupon;
  }

  return createSyntheticEvent('add_payment_info', 'Payment Info', eventObj);
}

function buildPurchase(data) {
  const cart = data.cart;
  const currency = cart.currency || data.currency || 'USD';
  const items = cart.items.map((p, i) => formatItem(p, i));

  const syntheticTax = Math.round(cart.totalValue * 0.08 * 100) / 100;
  const syntheticShipping = 5.99;
  const totalWithExtras = Math.round((cart.totalValue + syntheticTax + syntheticShipping) * 100) / 100;

  const eventObj = {
    event: 'purchase',
    ecommerce: {
      transaction_id: `TP-${Date.now()}`,
      currency,
      value: totalWithExtras,
      tax: syntheticTax,
      shipping: syntheticShipping,
      items,
    },
  };

  if (cart.coupon) {
    eventObj.ecommerce.coupon = cart.coupon;
  }

  return createSyntheticEvent('purchase', 'Purchase', eventObj);
}

function buildPurchaseFromOrder(data) {
  const order = data.order;
  const currency = order.currency || data.currency || 'USD';
  const items = order.items.map((p, i) => formatItem(p, i));

  const eventObj = {
    event: 'purchase',
    ecommerce: {
      transaction_id: order.transactionId || `TP-${Date.now()}`,
      currency,
      value: order.value,
      items,
    },
  };

  if (order.tax != null) eventObj.ecommerce.tax = order.tax;
  if (order.shipping != null) eventObj.ecommerce.shipping = order.shipping;
  if (order.coupon) eventObj.ecommerce.coupon = order.coupon;

  return createSyntheticEvent('purchase', 'Purchase (replay)', eventObj);
}

// --- Helpers ---

function formatItem(product, index = 0) {
  const item = {};

  if (product.id || product.sku) item.item_id = product.sku || product.id;
  if (product.name) item.item_name = product.name;
  if (product.brand) item.item_brand = product.brand;

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

  return item;
}

function createSyntheticEvent(eventName, label, eventObj) {
  return {
    eventName,
    label,
    code: `dataLayer.push({ ecommerce: null });\ndataLayer.push(${JSON.stringify(eventObj, null, 2)});`,
    data: eventObj,
  };
}
