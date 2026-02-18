/**
 * Meta Tags Extractor — Extracts ecommerce data from OpenGraph and other meta tags.
 * Universal fallback for any page.
 */

import { parsePrice } from '../../shared/utils.js';

export class MetaExtractor {
  /**
   * Extract product/page data from meta tags.
   */
  extract() {
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    const meta = this._getAllMetaTags();

    // Check if this looks like a product page via meta tags
    const hasProductMeta =
      meta['product:price:amount'] ||
      meta['og:price:amount'] ||
      meta['og:type'] === 'product' ||
      meta['og:type'] === 'og:product';

    if (hasProductMeta) {
      const price = parsePrice(
        meta['product:price:amount'] || meta['og:price:amount'] || 0
      );
      const currency =
        meta['product:price:currency'] || meta['og:price:currency'] || null;

      result.product = {
        id: meta['product:retailer_item_id'] || '',
        name: meta['og:title'] || meta['twitter:title'] || document.title || '',
        price,
        currency,
        brand: meta['product:brand'] || null,
        category: meta['product:category'] || null,
        variant: null,
        sku: meta['product:retailer_item_id'] || null,
        quantity: 1,
        imageUrl:
          meta['og:image'] || meta['twitter:image'] || null,
        url: meta['og:url'] || window.location.href,
        availability: this._parseAvailability(
          meta['product:availability']
        ),
        position: null,
        listName: null,
        compareAtPrice: meta['product:original_price:amount']
          ? parsePrice(meta['product:original_price:amount'])
          : null,
        discount: null,
      };

      result.currency = currency;
    }

    return result;
  }

  /**
   * Collect all meta tag values into a flat object.
   */
  _getAllMetaTags() {
    const meta = {};
    const tags = document.querySelectorAll('meta[property], meta[name]');

    for (const tag of tags) {
      const key = tag.getAttribute('property') || tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (key && content) {
        meta[key] = content;
      }
    }

    return meta;
  }

  _parseAvailability(value) {
    if (!value) return null;
    const v = value.toLowerCase();
    return v === 'instock' || v === 'in stock' || v === 'available';
  }
}
