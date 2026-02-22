/**
 * Shopify Extractor — Extracts ecommerce data from Shopify stores.
 */

import { BaseExtractor } from './base-extractor.js';
import { PAGE_TYPES } from '../../shared/constants.js';
import { parsePrice } from '../../shared/utils.js';

export class ShopifyExtractor extends BaseExtractor {
  constructor(cms, pageType) {
    super(cms, pageType);
  }

  async extract(pageContext = {}) {
    let cmsData = {};

    switch (this.pageType) {
      case PAGE_TYPES.PRODUCT:
        cmsData = await this._extractProduct(pageContext);
        break;
      case PAGE_TYPES.COLLECTION:
        cmsData = await this._extractCollection(pageContext);
        break;
      case PAGE_TYPES.CART:
        cmsData = await this._extractCart(pageContext);
        break;
      case PAGE_TYPES.CHECKOUT:
        cmsData = await this._extractCheckout(pageContext);
        break;
      case PAGE_TYPES.THANK_YOU:
        cmsData = await this._extractThankYou(pageContext);
        break;
      case PAGE_TYPES.SEARCH:
        cmsData = this._extractSearch(pageContext);
        break;
      default:
        cmsData = {};
    }

    // Chain fallbacks
    const jsonLd = this.extractFromJsonLd();
    const metaTags = this.extractFromMetaTags();

    return this._mergeData(cmsData, jsonLd, metaTags);
  }

  async _extractProduct(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: ShopifyAnalytics.meta.product
    if (pageContext.shopifyAnalytics?.product) {
      const p = pageContext.shopifyAnalytics.product;
      const rawPrice = p.price || p.variants?.[0]?.price;
      result.product = this._normalizeProduct({
        id: p.id || p.gid,
        name: p.title || p.name,
        price: rawPrice ? rawPrice / 100 : 0, // Shopify prices are in cents
        brand: p.vendor,
        category: p.type,
        variant: p.variant || p.variants?.[0]?.title,
        sku: p.sku || p.variants?.[0]?.sku,
      });
    }

    // Source 2: window.meta.product
    if (pageContext.shopifyProduct && !result.product) {
      const p = pageContext.shopifyProduct;
      const rawPrice = p.price || p.variants?.[0]?.price;
      result.product = this._normalizeProduct({
        id: p.id || p.gid,
        name: p.title || p.name,
        price: rawPrice ? rawPrice / 100 : 0,
        brand: p.vendor,
        category: p.type,
        variant: p.variants?.[0]?.title,
        sku: p.variants?.[0]?.sku,
      });
    }

    // Source 3: Try fetching <url>.json (Shopify product JSON endpoint)
    if (!result.product) {
      try {
        const productJson = await this._fetchProductJson();
        if (productJson) {
          const p = productJson.product || productJson;
          result.product = this._normalizeProduct({
            id: String(p.id),
            name: p.title,
            price: parsePrice(p.variants?.[0]?.price || p.price),
            brand: p.vendor,
            category: p.product_type,
            variant: p.variants?.[0]?.title,
            sku: p.variants?.[0]?.sku,
            imageUrl: p.image?.src || p.images?.[0]?.src,
            url: window.location.href,
            availability: p.variants?.[0]?.available,
            compareAtPrice: p.variants?.[0]?.compare_at_price
              ? parsePrice(p.variants[0].compare_at_price)
              : null,
          });
        }
      } catch (e) {}
    }

    // Source 4: DOM script with product JSON
    if (!result.product) {
      const productDataEl = document.querySelector(
        'script[data-product-json], script[type="application/json"][data-product]'
      );
      if (productDataEl) {
        try {
          const data = JSON.parse(productDataEl.textContent);
          const p = data.product || data;
          result.product = this._normalizeProduct({
            id: String(p.id),
            name: p.title,
            price: parsePrice(p.variants?.[0]?.price || p.price),
            brand: p.vendor,
            category: p.product_type,
            variant: p.variants?.[0]?.title,
            sku: p.variants?.[0]?.sku,
            imageUrl: p.featured_image || p.images?.[0],
            url: window.location.href,
            availability: p.available,
          });
        } catch (e) {}
      }
    }

    // Source 5: Rescue from dataLayer — scan for view_item events with real price
    if (result.product && !result.product.price && pageContext.dataLayer) {
      this._rescuePriceFromDataLayer(result.product, pageContext.dataLayer);
    }

    // Set currency
    result.currency =
      pageContext.shopify?.currency ||
      result.product?.currency ||
      this._getShopifyCurrency(pageContext);

    if (result.product) {
      result.product.currency = result.currency;
      result.product.url = result.product.url || window.location.href;
    }

    return result;
  }

  async _extractCollection(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Try to get collection name from the URL or page title
    const collectionName = this._getCollectionName();

    // Source 1: Parse product cards from DOM
    const productCards = document.querySelectorAll(
      '[data-product-id], .product-card, .product-item, .grid-product, .product-grid-item, .product'
    );

    const impressions = [];
    for (let i = 0; i < productCards.length && i < 50; i++) {
      const card = productCards[i];
      const product = this._extractProductFromCard(card, i, collectionName);
      if (product && product.name) {
        impressions.push(product);
      }
    }

    // Source 2: Fallback to dataLayer — if DOM extraction found nothing,
    // check for an existing view_item_list event with items
    if (impressions.length === 0 && pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        const evt = entry?.event || (entry?.['0'] === 'event' ? entry['1'] : null);
        const ecom = entry?.ecommerce || entry?.['2']?.ecommerce || entry?.['2'];
        if (evt === 'view_item_list' && ecom?.items?.length > 0) {
          for (let i = 0; i < ecom.items.length && i < 50; i++) {
            const item = ecom.items[i];
            impressions.push(this._normalizeProduct({
              id: item.item_id || item.id,
              name: item.item_name || item.name,
              price: item.price,
              brand: item.item_brand || item.brand,
              category: item.item_category || item.category,
              variant: item.item_variant || item.variant,
              sku: item.sku || item.item_id,
              quantity: item.quantity,
              url: item.url,
              position: item.index ?? i,
              listName: ecom.item_list_name || collectionName,
              discount: item.discount,
            }));
          }
          break;
        }
      }
    }

    result.productImpressions = impressions;
    result.currency =
      pageContext.shopify?.currency ||
      this._getShopifyCurrency(pageContext);

    return result;
  }

  async _extractCart(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: Fetch /cart.js (Shopify AJAX Cart API)
    try {
      const response = await fetch('/cart.js');
      if (response.ok) {
        const cartData = await response.json();
        const items = (cartData.items || []).map((item) =>
          this._normalizeProduct({
            id: String(item.product_id || item.id),
            name: item.product_title || item.title,
            price: item.price / 100,
            brand: item.vendor,
            category: item.product_type,
            variant: item.variant_title,
            sku: item.sku,
            quantity: item.quantity,
            imageUrl: item.image || item.featured_image?.url,
            url: item.url,
          })
        );

        result.cart = {
          items,
          totalValue: cartData.total_price / 100,
          currency: cartData.currency || pageContext.shopify?.currency,
          coupon: null,
          itemCount: cartData.item_count,
        };
        result.currency = cartData.currency || pageContext.shopify?.currency;
      }
    } catch (e) {}

    return result;
  }

  async _extractCheckout(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Shopify checkout has limited access
    // Try Shopify.Checkout object from pageContext
    if (pageContext.shopify?.checkout) {
      const co = pageContext.shopify.checkout;
      const items = (co.line_items || []).map((item) =>
        this._normalizeProduct({
          id: String(item.product_id || item.id),
          name: item.title,
          price: parsePrice(item.price),
          variant: item.variant_title,
          sku: item.sku,
          quantity: item.quantity,
          imageUrl: item.image_url,
        })
      );

      result.cart = {
        items,
        totalValue: parsePrice(co.total_price || co.payment_due),
        currency: co.currency || co.presentment_currency,
        coupon: co.discount?.code || null,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      };
      result.currency = co.currency || co.presentment_currency;
    }

    // Fallback to the cart data if available
    if (!result.cart) {
      const cartResult = await this._extractCart(pageContext);
      if (cartResult.cart) {
        result.cart = cartResult.cart;
        result.currency = cartResult.currency;
      }
    }

    return result;
  }

  async _extractThankYou(pageContext) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    // Source 1: Shopify.checkout object (available on thank you page)
    if (pageContext.shopifyCheckoutData) {
      const co = pageContext.shopifyCheckoutData;
      const items = (co.line_items || []).map((item) =>
        this._normalizeProduct({
          id: String(item.product_id || item.id),
          name: item.title,
          price: parsePrice(item.price),
          variant: item.variant_title,
          sku: item.sku,
          quantity: item.quantity,
          imageUrl: item.image_url,
        })
      );

      const tax = co.tax_lines
        ? co.tax_lines.reduce((sum, t) => sum + parsePrice(t.price), 0)
        : parsePrice(co.total_tax);

      result.order = this._normalizeOrder({
        transactionId: String(co.order_id || co.order_number || co.id || ''),
        value: parsePrice(co.total_price || co.payment_due),
        tax,
        shipping: parsePrice(co.shipping_rate?.price || co.total_shipping || 0),
        currency: co.currency || co.presentment_currency,
        coupon:
          co.discount?.code ||
          co.discount_applications?.[0]?.title ||
          null,
        items,
        paymentMethod: co.payment_method || co.gateway || null,
        affiliation: pageContext.shopify?.shop || null,
      });

      result.currency = co.currency || co.presentment_currency;
    }

    return result;
  }

  /**
   * Rescue price from dataLayer when CMS sources failed.
   * Scans for view_item / detail events that contain item price.
   */
  _rescuePriceFromDataLayer(product, dataLayer) {
    for (const entry of dataLayer) {
      try {
        // Standard dataLayer push: { event: 'view_item', ecommerce: { items: [...] } }
        const evt = entry?.event || (entry?.['0'] === 'event' ? entry['1'] : null);
        if (evt !== 'view_item' && evt !== 'view_item_list' && evt !== 'add_to_cart') continue;

        const ecom = entry?.ecommerce || entry?.['2']?.ecommerce || entry?.['2'];
        const items = ecom?.items || ecom?.products || [];
        if (!items.length) continue;

        // Find an item with a real price
        const item = items.find((i) => i.price > 0) || items[0];
        if (item?.price > 0) {
          product.price = parsePrice(item.price);
          // Also fill other missing fields from DL
          if (!product.name) product.name = item.item_name || item.name || product.name;
          if (!product.brand) product.brand = item.item_brand || item.brand || product.brand;
          if (!product.category) product.category = item.item_category || item.category || product.category;
          if (!product.variant) product.variant = item.item_variant || item.variant || product.variant;
          if (!product.id) product.id = String(item.item_id || item.id || product.id);
          break;
        }
      } catch (e) {}
    }
  }

  _extractSearch(pageContext) {
    // Search term is typically in the URL query parameter
    const params = new URLSearchParams(window.location.search);
    const searchTerm = params.get('q') || params.get('query') || '';

    return {
      currency: pageContext.shopify?.currency || null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
      searchTerm,
    };
  }

  // --- Helper methods ---

  async _fetchProductJson() {
    try {
      const url = window.location.pathname.replace(/\/$/, '') + '.json';
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {}
    return null;
  }

  _getShopifyCurrency(pageContext) {
    // Try multiple sources
    if (pageContext.shopify?.currency) return pageContext.shopify.currency;
    // Check meta tag
    const meta = document.querySelector(
      'meta[property="og:price:currency"], meta[name="currency"]'
    );
    if (meta?.content) return meta.content;
    // Default
    return 'USD';
  }

  _getCollectionName() {
    // Try to get from URL
    const match = window.location.pathname.match(/\/collections\/([^/?]+)/);
    if (match) {
      return match[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    // Try page title
    return document.title.split('–')[0]?.trim() || 'Collection';
  }

  _extractProductFromCard(card, index, listName) {
    const nameEl = card.querySelector(
      '.product-card__title, .product-title, .product__title, h3, h2, [data-product-title]'
    );
    const priceEl = card.querySelector(
      '.price, .product-price, .product-card__price, [data-product-price], .money'
    );
    const linkEl = card.querySelector('a[href*="/products/"]');
    const imgEl = card.querySelector('img');

    return {
      id: card.dataset.productId || card.dataset.id || '',
      name: nameEl?.textContent?.trim() || '',
      price: parsePrice(priceEl?.textContent),
      currency: null,
      brand: null,
      category: null,
      variant: null,
      sku: null,
      quantity: 1,
      imageUrl: imgEl?.src || imgEl?.dataset?.src || null,
      url: linkEl?.href || null,
      availability: null,
      position: index,
      listName,
      compareAtPrice: null,
      discount: null,
    };
  }
}
