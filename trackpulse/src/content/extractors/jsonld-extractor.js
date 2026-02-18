/**
 * JSON-LD Extractor — Universal fallback that extracts data from
 * JSON-LD structured data (<script type="application/ld+json">).
 */

import { parsePrice } from '../../shared/utils.js';

export class JsonLdExtractor {
  /**
   * Extract ecommerce data from all JSON-LD blocks on the page.
   */
  extract() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    const result = {
      currency: null,
      product: null,
      productImpressions: [],
      cart: null,
      order: null,
    };

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        this._processJsonLd(data, result);
      } catch (e) {
        // Skip malformed JSON-LD
      }
    }

    return result;
  }

  _processJsonLd(data, result) {
    if (!data) return;

    // Handle @graph arrays
    if (data['@graph']) {
      for (const item of data['@graph']) {
        this._processItem(item, result);
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      for (const item of data) {
        this._processItem(item, result);
      }
      return;
    }

    this._processItem(data, result);
  }

  _processItem(item, result) {
    if (!item || !item['@type']) return;

    const type = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];

    switch (type) {
      case 'Product':
        result.product = this._extractProduct(item);
        break;
      case 'ItemList':
      case 'CollectionPage':
        result.productImpressions = this._extractItemList(item);
        break;
      case 'BreadcrumbList':
        // Extract category from breadcrumb
        if (result.product && !result.product.category) {
          result.product.category = this._extractCategoryFromBreadcrumb(item);
        }
        break;
      case 'WebSite':
      case 'WebPage':
        // May contain information but not directly ecommerce
        break;
    }
  }

  _extractProduct(data) {
    const offers = data.offers || {};
    const offer = Array.isArray(offers) ? offers[0] : offers;
    // Handle AggregateOffer
    const mainOffer =
      offer?.['@type'] === 'AggregateOffer'
        ? offer.offers?.[0] || offer
        : offer;

    const price = parsePrice(
      mainOffer?.price || mainOffer?.lowPrice || offer?.price || 0
    );
    const currency =
      mainOffer?.priceCurrency || offer?.priceCurrency || null;

    const product = {
      id: data.productID || data.sku || data.identifier || '',
      name: data.name || '',
      price,
      currency,
      brand: this._extractBrand(data.brand),
      category: data.category || null,
      variant: null,
      sku: data.sku || null,
      quantity: 1,
      imageUrl: this._extractImage(data.image),
      url: data.url || null,
      availability: this._parseAvailability(
        mainOffer?.availability || offer?.availability
      ),
      position: null,
      listName: null,
      compareAtPrice: null,
      discount: null,
    };

    // Try to extract category from breadcrumb in same JSON-LD
    if (!product.category && data.category) {
      product.category =
        typeof data.category === 'string'
          ? data.category
          : data.category.name || null;
    }

    return product;
  }

  _extractItemList(data) {
    const items = data.itemListElement || [];
    return items
      .map((item, index) => {
        const product = item.item || item;
        if (!product.name && !product['@type']) return null;

        return {
          id: product.productID || product.sku || String(index),
          name: product.name || '',
          price: this._extractPriceFromOffers(product.offers),
          currency: this._extractCurrencyFromOffers(product.offers),
          brand: this._extractBrand(product.brand),
          category: null,
          variant: null,
          sku: product.sku || null,
          quantity: 1,
          imageUrl: this._extractImage(product.image),
          url: product.url || null,
          availability: null,
          position: item.position || index,
          listName: data.name || null,
          compareAtPrice: null,
          discount: null,
        };
      })
      .filter(Boolean);
  }

  _extractBrand(brand) {
    if (!brand) return null;
    if (typeof brand === 'string') return brand;
    return brand.name || null;
  }

  _extractImage(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return image[0]?.url || image[0] || null;
    return image.url || null;
  }

  _extractPriceFromOffers(offers) {
    if (!offers) return 0;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    return parsePrice(offer?.price || offer?.lowPrice || 0);
  }

  _extractCurrencyFromOffers(offers) {
    if (!offers) return null;
    const offer = Array.isArray(offers) ? offers[0] : offers;
    return offer?.priceCurrency || null;
  }

  _parseAvailability(availability) {
    if (!availability) return null;
    const avail = String(availability).toLowerCase();
    return avail.includes('instock') || avail.includes('in_stock');
  }

  _extractCategoryFromBreadcrumb(breadcrumb) {
    const items = breadcrumb.itemListElement || [];
    if (items.length < 2) return null;
    // Return the second-to-last breadcrumb item (last is usually the product)
    const categoryItem = items[items.length - 2];
    return categoryItem?.name || categoryItem?.item?.name || null;
  }
}
