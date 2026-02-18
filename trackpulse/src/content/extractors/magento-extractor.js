/**
 * Magento Extractor — Extracts ecommerce data from Magento 2 / Adobe Commerce stores.
 */

import { BaseExtractor } from './base-extractor.js';
import { PAGE_TYPES } from '../../shared/constants.js';
import { parsePrice } from '../../shared/utils.js';

export class MagentoExtractor extends BaseExtractor {
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

    // Source 1: dataLayer (Magento GTM module)
    const dlProduct = this._getFromDataLayer(pageContext.dataLayer, 'view_item');
    if (dlProduct) {
      result.product = dlProduct.product;
      result.currency = dlProduct.currency;
      return result;
    }

    // Source 2: data-mage-init attributes
    const mageInitEls = document.querySelectorAll('[data-mage-init]');
    for (const el of mageInitEls) {
      try {
        const init = JSON.parse(el.dataset.mageInit);
        // Look for product form data
        const formConfig = init['Magento_Catalog/js/product/view/provider'] ||
          init['catalogAddToCart'] ||
          init['priceBox'];
        if (formConfig) {
          // Price box config has prices
          if (formConfig.prices) {
            const price = formConfig.prices.finalPrice?.amount || 0;
            result.product = this._normalizeProduct({ price });
          }
        }
      } catch (e) {}
    }

    // Source 3: DOM extraction
    if (!result.product) {
      const name = document.querySelector(
        '.page-title span, h1.product-name, [data-ui-id="page-title-wrapper"]'
      )?.textContent?.trim() || '';
      const priceEl = document.querySelector(
        '.product-info-main .price, [data-price-type="finalPrice"] .price'
      );
      const skuEl = document.querySelector(
        '.product.attribute.sku .value, [itemprop="sku"]'
      );
      const imgEl = document.querySelector(
        '.product.media img, .gallery-placeholder img'
      );

      let productId = '';
      const form = document.querySelector('#product_addtocart_form');
      if (form) {
        productId = form.querySelector('[name="product"]')?.value || '';
      }

      result.product = this._normalizeProduct({
        id: productId,
        name,
        price: parsePrice(priceEl?.textContent),
        sku: skuEl?.textContent?.trim() || null,
        imageUrl: imgEl?.src || null,
        url: window.location.href,
      });
    }

    // Get currency
    result.currency = this._getMagentoCurrency(pageContext);
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

    // Source 1: dataLayer
    const dlList = this._getFromDataLayer(pageContext.dataLayer, 'view_item_list');
    if (dlList) {
      result.productImpressions = dlList.items || [];
      result.currency = dlList.currency;
      return result;
    }

    // Source 2: DOM
    const items = document.querySelectorAll(
      '.product-items .product-item, .products-grid .product-item'
    );
    const listName = document.querySelector(
      '.page-title span, h1'
    )?.textContent?.trim() || 'Category';

    const impressions = [];
    for (let i = 0; i < items.length && i < 50; i++) {
      const item = items[i];
      const nameEl = item.querySelector('.product-item-name a, .product-item-link');
      const priceEl = item.querySelector('.price');
      const imgEl = item.querySelector('.product-image-photo');
      const linkEl = item.querySelector('a.product-item-link, a');

      let productId = '';
      const priceBoxEl = item.querySelector('[data-product-id]');
      if (priceBoxEl) productId = priceBoxEl.dataset.productId;

      impressions.push(
        this._normalizeProduct({
          id: productId,
          name: nameEl?.textContent?.trim() || '',
          price: parsePrice(priceEl?.textContent),
          imageUrl: imgEl?.src || null,
          url: linkEl?.href || null,
          position: i,
          listName,
        })
      );
    }

    result.productImpressions = impressions;
    result.currency = this._getMagentoCurrency(pageContext);

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

    // Source 1: dataLayer
    const dlCart = this._getFromDataLayer(pageContext.dataLayer, 'view_cart');
    if (dlCart) {
      result.cart = {
        items: dlCart.items || [],
        totalValue: dlCart.value || 0,
        currency: dlCart.currency,
        coupon: dlCart.coupon || null,
        itemCount: (dlCart.items || []).reduce((s, i) => s + (i.quantity || 1), 0),
      };
      result.currency = dlCart.currency;
      return result;
    }

    // Source 2: DOM
    const rows = document.querySelectorAll('.cart.item, .cart-item');
    const items = [];
    for (const row of rows) {
      const nameEl = row.querySelector('.product-item-name a, .product-name');
      const priceEl = row.querySelector('.price');
      const qtyEl = row.querySelector('input.qty, .qty input');

      items.push(
        this._normalizeProduct({
          name: nameEl?.textContent?.trim() || '',
          price: parsePrice(priceEl?.textContent),
          quantity: parseInt(qtyEl?.value) || 1,
          url: nameEl?.href || null,
        })
      );
    }

    const totalEl = document.querySelector('.grand.totals .price, .order-total .price');

    result.cart = this._normalizeCart({
      items,
      totalValue: parsePrice(totalEl?.textContent),
      currency: this._getMagentoCurrency(pageContext),
    });
    result.currency = this._getMagentoCurrency(pageContext);

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

    // Source 1: dataLayer purchase event
    const dlPurchase = this._getFromDataLayer(pageContext.dataLayer, 'purchase');
    if (dlPurchase) {
      result.order = this._normalizeOrder({
        transactionId: dlPurchase.transaction_id,
        value: dlPurchase.value,
        tax: dlPurchase.tax,
        shipping: dlPurchase.shipping,
        currency: dlPurchase.currency,
        coupon: dlPurchase.coupon,
        items: dlPurchase.items || [],
      });
      result.currency = dlPurchase.currency;
      return result;
    }

    // Source 2: DOM
    const orderIdEl = document.querySelector(
      '.checkout-success .order-number, .checkout-success p a'
    );
    const totalEl = document.querySelector('.grand.totals .price');

    result.order = this._normalizeOrder({
      transactionId: orderIdEl?.textContent?.trim() || '',
      value: parsePrice(totalEl?.textContent),
      currency: this._getMagentoCurrency(pageContext),
      items: [],
    });
    result.currency = this._getMagentoCurrency(pageContext);

    return result;
  }

  _extractSearch(pageContext) {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('q') || '';

    return {
      currency: this._getMagentoCurrency(pageContext),
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
      searchTerm,
    };
  }

  _getFromDataLayer(dataLayer, eventName) {
    if (!dataLayer) return null;
    for (const entry of dataLayer) {
      if (entry?.event === eventName && entry?.ecommerce) {
        const ecom = entry.ecommerce;
        return {
          currency: ecom.currency,
          value: ecom.value,
          transaction_id: ecom.transaction_id,
          tax: ecom.tax,
          shipping: ecom.shipping,
          coupon: ecom.coupon,
          product: ecom.items?.[0]
            ? this._normalizeProduct({
                id: ecom.items[0].item_id,
                name: ecom.items[0].item_name,
                price: ecom.items[0].price,
                brand: ecom.items[0].item_brand,
                category: ecom.items[0].item_category,
                variant: ecom.items[0].item_variant,
                quantity: ecom.items[0].quantity,
              })
            : null,
          items: (ecom.items || []).map((item, i) =>
            this._normalizeProduct({
              id: item.item_id,
              name: item.item_name,
              price: item.price,
              brand: item.item_brand,
              category: item.item_category,
              variant: item.item_variant,
              quantity: item.quantity,
              position: item.index ?? i,
              listName: item.item_list_name,
            })
          ),
        };
      }
    }
    return null;
  }

  _getMagentoCurrency(pageContext) {
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        if (entry?.ecommerce?.currency) return entry.ecommerce.currency;
      }
    }
    const meta = document.querySelector('meta[property="product:price:currency"]');
    if (meta?.content) return meta.content;
    return 'USD';
  }
}
