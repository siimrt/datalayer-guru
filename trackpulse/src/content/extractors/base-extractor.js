/**
 * Base Extractor — Abstract base class for all CMS-specific extractors.
 * Provides fallback extraction methods (JSON-LD, meta tags, DOM).
 */

import { JsonLdExtractor } from './jsonld-extractor.js';
import { MetaExtractor } from './meta-extractor.js';
import { parsePrice } from '../../shared/utils.js';

export class BaseExtractor {
  constructor(cms, pageType) {
    this.cms = cms;
    this.pageType = pageType;
    this.jsonLdExtractor = new JsonLdExtractor();
    this.metaExtractor = new MetaExtractor();
  }

  /**
   * Main extraction method. Override in subclasses.
   * Returns normalized EcommerceData.
   */
  async extract(pageContext = {}) {
    // Default: chain through fallbacks
    const jsonLd = this.extractFromJsonLd();
    const metaTags = this.extractFromMetaTags();

    return this._mergeData({}, jsonLd, metaTags);
  }

  /**
   * Extract data from JSON-LD structured data on the page.
   */
  extractFromJsonLd() {
    return this.jsonLdExtractor.extract();
  }

  /**
   * Extract data from OpenGraph and other meta tags.
   */
  extractFromMetaTags() {
    return this.metaExtractor.extract();
  }

  /**
   * Merge multiple data sources. Later sources fill in missing fields only —
   * the most specific source (first) wins for each field.
   */
  _mergeData(...sources) {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    for (const source of sources) {
      if (!source) continue;

      if (!result.currency && source.currency) {
        result.currency = source.currency;
      }

      if (source.product) {
        if (!result.product) {
          result.product = { ...source.product };
        } else {
          // Fill in missing fields
          for (const [key, value] of Object.entries(source.product)) {
            if (result.product[key] == null && value != null) {
              result.product[key] = value;
            }
          }
        }
      }

      if (
        source.productImpressions?.length > 0 &&
        result.productImpressions.length === 0
      ) {
        result.productImpressions = source.productImpressions;
      }

      if (source.cart && !result.cart) {
        result.cart = source.cart;
      }

      if (source.order && !result.order) {
        result.order = source.order;
      }
    }

    return result;
  }

  /**
   * Create a normalized product data object.
   */
  _normalizeProduct(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || raw.productId || raw.item_id || ''),
      name: raw.name || raw.title || raw.item_name || '',
      price: parsePrice(raw.price || raw.item_price || 0),
      currency: raw.currency || null,
      brand: raw.brand || raw.vendor || raw.item_brand || null,
      category: raw.category || raw.type || raw.item_category || null,
      variant: raw.variant || raw.item_variant || null,
      sku: raw.sku || raw.item_id || null,
      quantity: parseInt(raw.quantity) || 1,
      imageUrl: raw.imageUrl || raw.image || raw.featured_image || null,
      url: raw.url || raw.link || null,
      availability: raw.availability ?? raw.available ?? null,
      position: raw.position != null ? parseInt(raw.position) : null,
      listName: raw.listName || raw.item_list_name || null,
      compareAtPrice: raw.compareAtPrice != null ? parsePrice(raw.compareAtPrice) : null,
      discount: raw.discount != null ? parsePrice(raw.discount) : null,
    };
  }

  /**
   * Normalize a cart object.
   */
  _normalizeCart(raw) {
    if (!raw) return null;
    return {
      items: (raw.items || []).map((item) => this._normalizeProduct(item)),
      totalValue: parsePrice(raw.totalValue || raw.total_price || raw.total || 0),
      currency: raw.currency || null,
      coupon: raw.coupon || raw.discount_code || null,
      itemCount: raw.itemCount || raw.item_count || (raw.items || []).length,
    };
  }

  /**
   * Normalize an order object.
   */
  _normalizeOrder(raw) {
    if (!raw) return null;
    return {
      transactionId: String(raw.transactionId || raw.order_id || raw.order_number || ''),
      value: parsePrice(raw.value || raw.total_price || raw.total || 0),
      tax: raw.tax != null ? parsePrice(raw.tax) : null,
      shipping: raw.shipping != null ? parsePrice(raw.shipping) : null,
      currency: raw.currency || null,
      coupon: raw.coupon || raw.discount_code || null,
      items: (raw.items || []).map((item) => this._normalizeProduct(item)),
      paymentMethod: raw.paymentMethod || raw.payment_method || null,
      affiliation: raw.affiliation || null,
    };
  }
}
