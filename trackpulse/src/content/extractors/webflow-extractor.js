/**
 * Webflow Extractor — Extracts ecommerce data from Webflow (+ Webflow Ecommerce) sites.
 */

import { BaseExtractor } from './base-extractor.js';
import { PAGE_TYPES } from '../../shared/constants.js';
import { parsePrice } from '../../shared/utils.js';

export class WebflowExtractor extends BaseExtractor {
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

    // Webflow Ecommerce product wrapper
    const productWrapper = document.querySelector(
      '.w-commerce-commerceproductwrapper, [data-wf-product]'
    );

    if (productWrapper) {
      const name = document.querySelector(
        '.w-commerce-commerceproductname, h1, [data-wf-product-name]'
      )?.textContent?.trim() || '';

      const priceEl = document.querySelector(
        '.w-commerce-commerceproductprice, [data-wf-product-price]'
      );
      const price = parsePrice(priceEl?.textContent);

      const skuEl = document.querySelector(
        '.w-commerce-commerceproductsku, [data-wf-product-sku]'
      );

      const imgEl = document.querySelector(
        '.w-commerce-commerceproductimage img, [data-wf-product-image] img'
      );

      const descEl = document.querySelector(
        '.w-commerce-commerceproductdescription, [data-wf-product-description]'
      );

      // Try to get product ID from data attributes
      let productId = productWrapper.dataset.commerceProductId ||
        productWrapper.dataset.wfProduct || '';

      result.product = this._normalizeProduct({
        id: productId,
        name,
        price,
        sku: skuEl?.textContent?.trim() || null,
        imageUrl: imgEl?.src || null,
        url: window.location.href,
      });
    }

    // Try DOM heuristics for non-Webflow-Ecommerce product pages
    if (!result.product) {
      const name = document.querySelector('h1')?.textContent?.trim() || '';
      const priceEl = document.querySelector('[class*="price"], [data-wf-price]');
      const imgEl = document.querySelector('.product-image img, main img');

      if (name && priceEl) {
        result.product = this._normalizeProduct({
          name,
          price: parsePrice(priceEl?.textContent),
          imageUrl: imgEl?.src || null,
          url: window.location.href,
        });
      }
    }

    result.currency = this._getWebflowCurrency();
    if (result.product) result.product.currency = result.currency;

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

    // Webflow dynamic lists
    const listItems = document.querySelectorAll(
      '.w-dyn-item, .collection-item'
    );

    const listName = document.querySelector('h1, .page-title')?.textContent?.trim() || 'Collection';
    const impressions = [];

    for (let i = 0; i < listItems.length && i < 50; i++) {
      const item = listItems[i];
      const nameEl = item.querySelector('h2, h3, a, [class*="name"], [class*="title"]');
      const priceEl = item.querySelector('[class*="price"]');
      const imgEl = item.querySelector('img');
      const linkEl = item.querySelector('a');

      const name = nameEl?.textContent?.trim() || '';
      if (!name) continue;

      impressions.push(
        this._normalizeProduct({
          name,
          price: parsePrice(priceEl?.textContent),
          imageUrl: imgEl?.src || null,
          url: linkEl?.href || null,
          position: i,
          listName,
        })
      );
    }

    result.productImpressions = impressions;
    result.currency = this._getWebflowCurrency();

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

    // Webflow cart is limited — try DOM
    const cartItems = document.querySelectorAll(
      '.w-commerce-commercecartitem'
    );
    const items = [];

    for (const cartItem of cartItems) {
      const nameEl = cartItem.querySelector(
        '.w-commerce-commercecartproductname'
      );
      const priceEl = cartItem.querySelector(
        '.w-commerce-commercecartproductprice'
      );
      const qtyEl = cartItem.querySelector(
        '.w-commerce-commercecartquantity input'
      );

      items.push(
        this._normalizeProduct({
          name: nameEl?.textContent?.trim() || '',
          price: parsePrice(priceEl?.textContent),
          quantity: parseInt(qtyEl?.value) || 1,
        })
      );
    }

    const totalEl = document.querySelector(
      '.w-commerce-commercecarttotal, .w-commerce-commercecheckoutordertotal'
    );

    result.cart = this._normalizeCart({
      items,
      totalValue: parsePrice(totalEl?.textContent),
      currency: this._getWebflowCurrency(),
    });
    result.currency = this._getWebflowCurrency();

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

    // Webflow order confirmation
    const orderConfirm = document.querySelector(
      '.w-commerce-commerceorderconfirmationcontainer'
    );

    if (orderConfirm) {
      const items = [];
      const orderItems = orderConfirm.querySelectorAll(
        '.w-commerce-commerceorderitem'
      );
      for (const item of orderItems) {
        const nameEl = item.querySelector('[class*="name"]');
        const priceEl = item.querySelector('[class*="price"]');
        const qtyEl = item.querySelector('[class*="quantity"]');

        items.push(
          this._normalizeProduct({
            name: nameEl?.textContent?.trim() || '',
            price: parsePrice(priceEl?.textContent),
            quantity: parseInt(qtyEl?.textContent) || 1,
          })
        );
      }

      const totalEl = orderConfirm.querySelector('[class*="total"]');

      result.order = this._normalizeOrder({
        transactionId: '',
        value: parsePrice(totalEl?.textContent),
        currency: this._getWebflowCurrency(),
        items,
      });
    }

    result.currency = this._getWebflowCurrency();
    return result;
  }

  _extractSearch(pageContext) {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('query') || params.get('q') || '';

    return {
      currency: this._getWebflowCurrency(),
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
      searchTerm,
    };
  }

  _getWebflowCurrency() {
    const meta = document.querySelector('meta[property="og:price:currency"]');
    if (meta?.content) return meta.content;
    // Try to detect from price elements
    const priceEl = document.querySelector(
      '.w-commerce-commerceproductprice, [class*="price"]'
    );
    if (priceEl) {
      const text = priceEl.textContent || '';
      if (text.includes('$')) return 'USD';
      if (text.includes('€')) return 'EUR';
      if (text.includes('£')) return 'GBP';
    }
    return 'USD';
  }
}
