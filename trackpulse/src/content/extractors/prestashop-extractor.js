/**
 * PrestaShop Extractor — Extracts ecommerce data from PrestaShop stores.
 */

import { BaseExtractor } from './base-extractor.js';
import { PAGE_TYPES } from '../../shared/constants.js';
import { parsePrice } from '../../shared/utils.js';

export class PrestaShopExtractor extends BaseExtractor {
  constructor(cms, pageType) {
    super(cms, pageType);
  }

  async extract(pageContext = {}) {
    let cmsData = {};

    switch (this.pageType) {
      case PAGE_TYPES.PRODUCT:
        cmsData = this._extractProduct(pageContext);
        break;
      case PAGE_TYPES.COLLECTION:
        cmsData = this._extractCollection(pageContext);
        break;
      case PAGE_TYPES.CART:
        cmsData = this._extractCart(pageContext);
        break;
      case PAGE_TYPES.CHECKOUT:
        cmsData = this._extractCheckout(pageContext);
        break;
      case PAGE_TYPES.THANK_YOU:
        cmsData = this._extractThankYou(pageContext);
        break;
      case PAGE_TYPES.SEARCH:
        cmsData = this._extractSearch(pageContext);
        break;
      default:
        cmsData = {};
    }

    const jsonLd = this.extractFromJsonLd();
    const metaTags = this.extractFromMetaTags();

    return this._mergeData(cmsData, jsonLd, metaTags);
  }

  _extractProduct(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: prestashop.product JS object
    if (pageContext.prestashop?.product) {
      const p = pageContext.prestashop.product;
      result.product = this._normalizeProduct({
        id: String(p.id || p.id_product || ''),
        name: p.name || '',
        price: parsePrice(p.price_amount || p.price),
        currency: pageContext.prestashop.currency?.iso_code || null,
        brand: p.manufacturer_name || null,
        category: p.category_name || p.category || null,
        variant: p.attributes_values
          ? Object.values(p.attributes_values).join(' / ')
          : null,
        sku: p.reference || null,
        imageUrl: p.cover?.large?.url || p.cover?.bySize?.medium_default?.url || null,
        url: p.canonical_url || window.location.href,
        availability: p.availability === 'available' || p.quantity > 0,
        compareAtPrice: p.has_discount
          ? parsePrice(p.regular_price_amount || p.regular_price)
          : null,
        discount: p.has_discount
          ? parsePrice(p.discount_amount_to_display || p.discount_amount)
          : null,
      });
      result.currency = pageContext.prestashop.currency?.iso_code;
    }

    // Source 2: DOM data-product attribute
    if (!result.product) {
      const productDataEl = document.querySelector('[data-product]');
      if (productDataEl) {
        try {
          const p = JSON.parse(productDataEl.dataset.product);
          result.product = this._normalizeProduct({
            id: String(p.id || ''),
            name: p.name || '',
            price: parsePrice(p.price_amount || p.price),
            brand: p.manufacturer_name || null,
            category: p.category_name || null,
            sku: p.reference || null,
          });
        } catch (e) {}
      }
    }

    if (!result.currency) {
      result.currency = this._getPSCurrency(pageContext);
    }
    if (result.product) {
      result.product.currency = result.currency;
    }

    return result;
  }

  _extractCollection(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: prestashop.listing.products
    if (pageContext.prestashop?.listing?.products) {
      result.productImpressions = pageContext.prestashop.listing.products.map(
        (p, i) =>
          this._normalizeProduct({
            id: String(p.id || p.id_product || ''),
            name: p.name || '',
            price: parsePrice(p.price_amount || p.price),
            brand: p.manufacturer_name || null,
            category: null,
            sku: p.reference || null,
            imageUrl: p.cover?.medium?.url || null,
            url: p.canonical_url || p.url || null,
            position: i,
            listName: pageContext.prestashop.listing?.label || 'Category',
          })
      );
      result.currency = this._getPSCurrency(pageContext);
      return result;
    }

    // Source 2: DOM extraction
    const items = document.querySelectorAll(
      '.js-product-miniature, .product-miniature'
    );
    const impressions = [];
    for (let i = 0; i < items.length && i < 50; i++) {
      const item = items[i];
      const nameEl = item.querySelector('.product-title a, h3 a');
      const priceEl = item.querySelector('.product-price-and-shipping .price, .price');
      const imgEl = item.querySelector('img');
      const linkEl = item.querySelector('a');

      impressions.push(
        this._normalizeProduct({
          id: item.dataset.idProduct || '',
          name: nameEl?.textContent?.trim() || '',
          price: parsePrice(priceEl?.textContent),
          imageUrl: imgEl?.src || null,
          url: linkEl?.href || null,
          position: i,
        })
      );
    }

    result.productImpressions = impressions;
    result.currency = this._getPSCurrency(pageContext);

    return result;
  }

  _extractCart(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: prestashop.cart
    if (pageContext.prestashop?.cart) {
      const cart = pageContext.prestashop.cart;
      const items = (cart.products || []).map((p) =>
        this._normalizeProduct({
          id: String(p.id || p.id_product || ''),
          name: p.name || '',
          price: parsePrice(p.price_amount || p.price),
          quantity: p.quantity || 1,
          variant: p.attributes_small || null,
          sku: p.reference || null,
          imageUrl: p.cover?.medium?.url || null,
        })
      );

      result.cart = this._normalizeCart({
        items,
        totalValue: parsePrice(cart.totals?.total?.amount || cart.totals?.total_including_tax?.amount || 0),
        currency: this._getPSCurrency(pageContext),
        coupon: cart.vouchers?.added?.[0]?.name || null,
      });
      result.currency = this._getPSCurrency(pageContext);
    }

    return result;
  }

  _extractCheckout(pageContext) {
    return this._extractCart(pageContext);
  }

  _extractThankYou(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // PrestaShop order confirmation: prestashop.order or DOM
    if (pageContext.prestashop?.order) {
      const order = pageContext.prestashop.order;
      const items = (order.products || []).map((p) =>
        this._normalizeProduct({
          id: String(p.id || p.id_product || ''),
          name: p.name || '',
          price: parsePrice(p.price_amount || p.price),
          quantity: p.quantity || 1,
          sku: p.reference || null,
        })
      );

      result.order = this._normalizeOrder({
        transactionId: String(order.details?.reference || order.id || ''),
        value: parsePrice(order.totals?.total?.amount || 0),
        shipping: parsePrice(order.totals?.total_shipping?.amount || 0),
        tax: parsePrice(order.totals?.total_tax?.amount || 0),
        currency: this._getPSCurrency(pageContext),
        items,
      });
      result.currency = this._getPSCurrency(pageContext);
    }

    return result;
  }

  _extractSearch(pageContext) {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('s') || params.get('search_query') || '';

    return {
      currency: this._getPSCurrency(pageContext),
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
      searchTerm,
    };
  }

  _getPSCurrency(pageContext) {
    return pageContext.prestashop?.currency?.iso_code || 'EUR';
  }
}
