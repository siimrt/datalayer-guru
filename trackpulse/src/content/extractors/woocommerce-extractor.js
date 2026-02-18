/**
 * WooCommerce Extractor — Extracts ecommerce data from WooCommerce stores.
 */

import { BaseExtractor } from './base-extractor.js';
import { PAGE_TYPES } from '../../shared/constants.js';
import { parsePrice } from '../../shared/utils.js';

export class WooCommerceExtractor extends BaseExtractor {
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

    // Source 1: Check dataLayer for existing view_item events
    const dlProduct = this._getProductFromDataLayer(pageContext.dataLayer);
    if (dlProduct) {
      result.product = dlProduct;
      result.currency = dlProduct.currency;
      return result;
    }

    // Source 2: DOM extraction
    const productEl = document.querySelector('.product, .single-product .entry-summary');
    if (productEl) {
      const name =
        productEl.querySelector('.product_title, h1.entry-title, h1')?.textContent?.trim() || '';
      const priceEl = productEl.querySelector(
        '.price ins .amount, .price .amount, .woocommerce-Price-amount'
      );
      const price = parsePrice(priceEl?.textContent);
      const sku = productEl.querySelector('.sku')?.textContent?.trim() || null;
      const imgEl = productEl.querySelector(
        '.woocommerce-product-gallery img, .wp-post-image'
      );

      // Try to get product ID from body class or add-to-cart form
      let productId = '';
      const bodyClasses = document.body.className;
      const idMatch = bodyClasses.match(/postid-(\d+)/);
      if (idMatch) productId = idMatch[1];
      if (!productId) {
        const form = document.querySelector('form.cart');
        productId = form?.querySelector('[name="product_id"], [name="add-to-cart"]')?.value || '';
      }

      // Get category from breadcrumb or product meta
      const categoryEl = document.querySelector(
        '.posted_in a, .product_meta .posted_in a, nav.woocommerce-breadcrumb a:nth-last-child(2)'
      );

      // Compare at price (sale)
      const regularPriceEl = productEl.querySelector('.price del .amount');
      const compareAtPrice = regularPriceEl
        ? parsePrice(regularPriceEl.textContent)
        : null;

      result.product = this._normalizeProduct({
        id: productId,
        name,
        price,
        brand: null,
        category: categoryEl?.textContent?.trim() || null,
        variant: null,
        sku,
        imageUrl: imgEl?.src || null,
        url: window.location.href,
        compareAtPrice,
        discount: compareAtPrice ? compareAtPrice - price : null,
      });
    }

    result.currency = this._getWooCurrency(pageContext);
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

    // Check dataLayer for existing view_item_list
    const dlImpressions = this._getImpressionsFromDataLayer(pageContext.dataLayer);
    if (dlImpressions.length > 0) {
      result.productImpressions = dlImpressions;
      result.currency = this._getWooCurrency(pageContext);
      return result;
    }

    // DOM extraction
    const items = document.querySelectorAll(
      '.products .product, ul.products > li'
    );
    const listName = document.querySelector(
      '.woocommerce-products-header__title, .page-title, h1'
    )?.textContent?.trim() || 'Category';

    const impressions = [];
    for (let i = 0; i < items.length && i < 50; i++) {
      const item = items[i];
      const name = item.querySelector(
        '.woocommerce-loop-product__title, h2, .product-title'
      )?.textContent?.trim() || '';
      const priceEl = item.querySelector('.price ins .amount, .price .amount');
      const linkEl = item.querySelector('a.woocommerce-LoopProduct-link, a[href*="/product/"]');
      const imgEl = item.querySelector('img');

      let productId = '';
      const classes = item.className;
      const idMatch = classes.match(/post-(\d+)/);
      if (idMatch) productId = idMatch[1];

      impressions.push(
        this._normalizeProduct({
          id: productId,
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
    result.currency = this._getWooCurrency(pageContext);

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

    // Check dataLayer first
    const dlCart = this._getCartFromDataLayer(pageContext.dataLayer);
    if (dlCart) {
      result.cart = dlCart;
      result.currency = dlCart.currency || this._getWooCurrency(pageContext);
      return result;
    }

    // DOM extraction
    const rows = document.querySelectorAll('.woocommerce-cart-form .cart_item');
    const items = [];

    for (const row of rows) {
      const nameEl = row.querySelector('.product-name a');
      const priceEl = row.querySelector('.product-price .amount');
      const qtyEl = row.querySelector('.product-quantity input, .qty');
      const imgEl = row.querySelector('.product-thumbnail img');

      items.push(
        this._normalizeProduct({
          id: '',
          name: nameEl?.textContent?.trim() || '',
          price: parsePrice(priceEl?.textContent),
          quantity: parseInt(qtyEl?.value || qtyEl?.textContent) || 1,
          imageUrl: imgEl?.src || null,
          url: nameEl?.href || null,
        })
      );
    }

    const totalEl = document.querySelector('.order-total .amount, .cart-subtotal .amount');
    const totalValue = parsePrice(totalEl?.textContent);

    result.cart = this._normalizeCart({
      items,
      totalValue,
      currency: this._getWooCurrency(pageContext),
    });
    result.currency = this._getWooCurrency(pageContext);

    return result;
  }

  _extractCheckout(pageContext) {
    // Similar to cart — checkout page usually has cart items
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

    // Check dataLayer for purchase event
    const dlPurchase = this._getPurchaseFromDataLayer(pageContext.dataLayer);
    if (dlPurchase) {
      result.order = dlPurchase;
      result.currency = dlPurchase.currency || this._getWooCurrency(pageContext);
      return result;
    }

    // DOM extraction from order confirmation
    const orderEl = document.querySelector('.woocommerce-order');
    if (orderEl) {
      const orderNumber =
        orderEl.querySelector('.woocommerce-order-overview__order strong, .order strong')
          ?.textContent?.trim() || '';
      const totalEl = orderEl.querySelector(
        '.woocommerce-order-overview__total strong .amount, .order-total .amount'
      );

      // Extract items from order table
      const rows = orderEl.querySelectorAll('.woocommerce-table--order-details .order_item, table.order_details tr');
      const items = [];
      for (const row of rows) {
        const nameEl = row.querySelector('.product-name, td:first-child');
        const name = nameEl?.textContent?.trim() || '';
        const qtyMatch = name.match(/×\s*(\d+)/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
        const cleanName = name.replace(/×\s*\d+/, '').trim();
        const priceEl = row.querySelector('.product-total .amount, td:last-child .amount');

        items.push(
          this._normalizeProduct({
            name: cleanName,
            price: parsePrice(priceEl?.textContent) / quantity,
            quantity,
          })
        );
      }

      result.order = this._normalizeOrder({
        transactionId: orderNumber,
        value: parsePrice(totalEl?.textContent),
        items,
        currency: this._getWooCurrency(pageContext),
      });
      result.currency = this._getWooCurrency(pageContext);
    }

    return result;
  }

  _extractSearch(pageContext) {
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('s') || '';

    return {
      currency: this._getWooCurrency(pageContext),
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
      searchTerm,
    };
  }

  // --- DataLayer helpers ---

  _getProductFromDataLayer(dataLayer) {
    if (!dataLayer) return null;
    for (const entry of dataLayer) {
      if (entry?.ecommerce?.items?.[0] && entry.event === 'view_item') {
        const item = entry.ecommerce.items[0];
        return this._normalizeProduct({
          id: item.item_id,
          name: item.item_name,
          price: item.price,
          brand: item.item_brand,
          category: item.item_category,
          variant: item.item_variant,
          currency: entry.ecommerce.currency,
        });
      }
    }
    return null;
  }

  _getImpressionsFromDataLayer(dataLayer) {
    if (!dataLayer) return [];
    for (const entry of dataLayer) {
      if (entry?.ecommerce?.items && entry.event === 'view_item_list') {
        return entry.ecommerce.items.map((item, i) =>
          this._normalizeProduct({
            id: item.item_id,
            name: item.item_name,
            price: item.price,
            brand: item.item_brand,
            category: item.item_category,
            position: item.index ?? i,
            listName: item.item_list_name,
          })
        );
      }
    }
    return [];
  }

  _getCartFromDataLayer(dataLayer) {
    if (!dataLayer) return null;
    for (const entry of dataLayer) {
      if (entry?.ecommerce?.items && entry.event === 'view_cart') {
        const items = entry.ecommerce.items.map((item) =>
          this._normalizeProduct({
            id: item.item_id,
            name: item.item_name,
            price: item.price,
            quantity: item.quantity,
          })
        );
        return this._normalizeCart({
          items,
          totalValue: entry.ecommerce.value,
          currency: entry.ecommerce.currency,
        });
      }
    }
    return null;
  }

  _getPurchaseFromDataLayer(dataLayer) {
    if (!dataLayer) return null;
    for (const entry of dataLayer) {
      if (entry?.ecommerce?.items && entry.event === 'purchase') {
        const items = entry.ecommerce.items.map((item) =>
          this._normalizeProduct({
            id: item.item_id,
            name: item.item_name,
            price: item.price,
            quantity: item.quantity,
          })
        );
        return this._normalizeOrder({
          transactionId: entry.ecommerce.transaction_id,
          value: entry.ecommerce.value,
          tax: entry.ecommerce.tax,
          shipping: entry.ecommerce.shipping,
          currency: entry.ecommerce.currency,
          coupon: entry.ecommerce.coupon,
          items,
        });
      }
    }
    return null;
  }

  _getWooCurrency(pageContext) {
    // Try dataLayer
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        if (entry?.ecommerce?.currency) return entry.ecommerce.currency;
      }
    }
    // Try WC params
    if (pageContext.wcParams?.currency) return pageContext.wcParams.currency;
    // Try meta tag
    const meta = document.querySelector('meta[property="og:price:currency"]');
    if (meta?.content) return meta.content;
    return 'USD';
  }
}
