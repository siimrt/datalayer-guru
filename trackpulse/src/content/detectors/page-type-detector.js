/**
 * Page Type Detector — Determines the current page type within the detected CMS context.
 */

import { CMS, PAGE_TYPES } from '../../shared/constants.js';
import { safeQuerySelector } from '../../shared/utils.js';

/**
 * Detection rules by CMS. Each page type can have:
 *   - jsCheck: function(ctx) => boolean (checks pageContext data)
 *   - domCheck: CSS selector string (comma-separated for multiple)
 *   - urlPattern: RegExp to match against pathname
 */
const PAGE_TYPE_RULES = {
  [CMS.SHOPIFY]: {
    home: {
      jsCheck: (ctx) =>
        ctx.shopifyTemplate === 'index' ||
        ctx.shopifyPageType === 'home' ||
        ctx.shopifyResourceType === 'home',
      urlPattern: /^\/$/,
      domCheck: 'body.template-index',
    },
    collection: {
      jsCheck: (ctx) =>
        ctx.shopifyTemplate?.startsWith('collection') ||
        ctx.shopifyPageType === 'collection' ||
        ctx.shopifyResourceType === 'collection',
      urlPattern: /^\/collections\//,
      domCheck: 'body.template-collection',
    },
    product: {
      jsCheck: (ctx) =>
        ctx.shopifyTemplate?.startsWith('product') ||
        ctx.shopifyPageType === 'product' ||
        ctx.shopifyResourceType === 'product',
      urlPattern: /^\/products\//,
      domCheck: 'body.template-product',
    },
    cart: {
      jsCheck: (ctx) => ctx.shopifyTemplate === 'cart',
      urlPattern: /^\/cart$/,
      domCheck: 'body.template-cart',
    },
    checkout: {
      jsCheck: (ctx) =>
        (typeof ctx.shopify?.checkout === 'object' &&
          ctx.shopify.checkout !== null &&
          ctx.shopifyCheckoutStep !== 'thank_you') ||
        ctx.shopifyPageType === 'checkout',
      urlPattern: /\/checkouts?\//,
      domCheck: '[data-step]',
    },
    thank_you: {
      jsCheck: (ctx) => ctx.shopifyCheckoutStep === 'thank_you',
      urlPattern: /\/thank[-_]you/,
      domCheck: '.os-step__title',
    },
    search: {
      jsCheck: (ctx) =>
        ctx.shopifyTemplate === 'search' ||
        ctx.shopifyPageType === 'search',
      urlPattern: /^\/search/,
      domCheck: 'body.template-search',
    },
    blog: {
      jsCheck: (ctx) => ctx.shopifyTemplate === 'blog',
      urlPattern: /^\/blogs\/?$/,
      domCheck: 'body.template-blog',
    },
    article: {
      jsCheck: (ctx) =>
        ctx.shopifyTemplate === 'article' ||
        ctx.shopifyPageType === 'article',
      urlPattern: /^\/blogs\/[^/]+\/.+/,
      domCheck: 'body.template-article',
    },
  },

  [CMS.WOOCOMMERCE]: {
    home: {
      domCheck: 'body.home',
      urlPattern: /^\/$/,
    },
    collection: {
      domCheck:
        'body.archive, body.tax-product_cat, body.post-type-archive-product',
      urlPattern: /\/product-category\//,
    },
    product: {
      domCheck: 'body.single-product',
      urlPattern: /\/product\//,
    },
    cart: {
      domCheck: 'body.woocommerce-cart',
      urlPattern: /\/cart\/?$/,
    },
    checkout: {
      domCheck: 'body.woocommerce-checkout:not(.woocommerce-order-received)',
      urlPattern: /\/checkout\/?$/,
    },
    thank_you: {
      domCheck: 'body.woocommerce-order-received',
      urlPattern: /\/checkout\/order-received/,
    },
    search: {
      domCheck: 'body.search-results',
      urlPattern: /[?&]s=/,
    },
    blog: {
      domCheck: 'body.blog',
      urlPattern: /\/blog\/?$/,
    },
    article: {
      domCheck: 'body.single-post',
    },
  },

  [CMS.PRESTASHOP]: {
    home: {
      domCheck: 'body#index',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'index',
    },
    collection: {
      domCheck: 'body#category',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'category',
    },
    product: {
      domCheck: 'body#product',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'product',
    },
    cart: {
      domCheck: 'body#cart',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'cart',
    },
    checkout: {
      domCheck: 'body#checkout',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'order',
    },
    thank_you: {
      domCheck: 'body#order-confirmation',
      jsCheck: (ctx) =>
        ctx.prestashop?.page?.page_name === 'order-confirmation',
    },
    search: {
      domCheck: 'body#search',
      jsCheck: (ctx) => ctx.prestashop?.page?.page_name === 'search',
    },
  },

  [CMS.MAGENTO]: {
    home: {
      domCheck: 'body.cms-index-index',
      urlPattern: /^\/$/,
    },
    collection: {
      domCheck: 'body.catalog-category-view',
      urlPattern: /\/catalog\/category\//,
    },
    product: {
      domCheck: 'body.catalog-product-view',
    },
    cart: {
      domCheck: 'body.checkout-cart-index',
      urlPattern: /\/checkout\/cart\/?$/,
    },
    checkout: {
      domCheck: 'body.checkout-index-index',
      urlPattern: /\/checkout\/?$/,
    },
    thank_you: {
      domCheck: 'body.checkout-onepage-success',
      urlPattern: /\/checkout\/onepage\/success/,
    },
    search: {
      domCheck: 'body.catalogsearch-result-index',
      urlPattern: /\/catalogsearch\//,
    },
  },

  [CMS.WEBFLOW]: {
    home: {
      urlPattern: /^\/$/,
    },
    collection: {
      domCheck: '.w-dyn-list, .collection-list-wrapper',
    },
    product: {
      domCheck: '.w-commerce-commerceproductwrapper, [data-wf-product]',
    },
    cart: {
      domCheck: '.w-commerce-commercecartcontainerwrapper',
    },
    checkout: {
      domCheck: '.w-commerce-commercecheckoutformcontainer',
      urlPattern: /\/checkout$/,
    },
    thank_you: {
      domCheck: '.w-commerce-commerceorderconfirmationcontainer',
      urlPattern: /\/order-confirmed/,
    },
  },
};

/**
 * Detect the page type based on the CMS and page context.
 *
 * @param {string} cms - Detected CMS identifier
 * @param {Object} pageContext - Data from the page-context-script
 * @returns {{ pageType: string, confidence: number, method: string }}
 */
export function detectPageType(cms, pageContext = {}) {
  const rules = PAGE_TYPE_RULES[cms];
  const pathname = window.location.pathname;

  if (!rules) {
    return fallbackDetection(pageContext);
  }

  // Priority: jsCheck > domCheck > urlPattern
  for (const [pageType, rule] of Object.entries(rules)) {
    // 1. JS Check (highest priority — most reliable)
    if (rule.jsCheck) {
      try {
        if (rule.jsCheck(pageContext)) {
          return {
            pageType: PAGE_TYPES[pageType.toUpperCase()] || pageType,
            confidence: 95,
            method: 'js',
          };
        }
      } catch (e) {}
    }
  }

  // 2. DOM Check
  for (const [pageType, rule] of Object.entries(rules)) {
    if (rule.domCheck) {
      const el = safeQuerySelector(rule.domCheck);
      if (el) {
        return {
          pageType: PAGE_TYPES[pageType.toUpperCase()] || pageType,
          confidence: 80,
          method: 'dom',
        };
      }
    }
  }

  // 3. URL Pattern
  for (const [pageType, rule] of Object.entries(rules)) {
    if (rule.urlPattern && rule.urlPattern.test(pathname)) {
      return {
        pageType: PAGE_TYPES[pageType.toUpperCase()] || pageType,
        confidence: 60,
        method: 'url',
      };
    }
  }

  // 4. Fallback detection (CMS-agnostic)
  return fallbackDetection(pageContext);
}

/**
 * CMS-agnostic fallback detection using JSON-LD, URL patterns, and meta tags.
 */
function fallbackDetection(pageContext) {
  const pathname = window.location.pathname;

  // Check JSON-LD for Product type
  const jsonldScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  for (const script of jsonldScripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Product') {
          return {
            pageType: PAGE_TYPES.PRODUCT,
            confidence: 70,
            method: 'fallback',
          };
        }
        if (
          item['@type'] === 'ItemList' ||
          item['@type'] === 'CollectionPage'
        ) {
          return {
            pageType: PAGE_TYPES.COLLECTION,
            confidence: 60,
            method: 'fallback',
          };
        }
        if (item['@type'] === 'SearchResultsPage') {
          return {
            pageType: PAGE_TYPES.SEARCH,
            confidence: 60,
            method: 'fallback',
          };
        }
      }
    } catch (e) {}
  }

  // JSON-LD: Service / LocalBusiness → services page
  for (const script of jsonldScripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'Service' || item['@type'] === 'LocalBusiness' || item['@type'] === 'ProfessionalService') {
          return {
            pageType: PAGE_TYPES.SERVICES,
            confidence: 60,
            method: 'fallback',
          };
        }
      }
    } catch (e) {}
  }

  // URL-based guesses
  if (/^\/$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.HOME,
      confidence: 50,
      method: 'fallback',
    };
  }

  // Lead gen URL patterns (before ecom to avoid conflicts)
  if (/\/(contact|kontakt|nous-contacter|contacto)\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.CONTACT,
      confidence: 50,
      method: 'fallback',
    };
  }
  if (/\/(demo|book-a-demo|request-demo|schedule-demo)\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.DEMO_REQUEST,
      confidence: 50,
      method: 'fallback',
    };
  }
  if (/\/(pricing|tarifs|plans|packages)\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.PRICING,
      confidence: 50,
      method: 'fallback',
    };
  }
  if (/\/(services|solutions|what-we-do)\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.SERVICES,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/(about|a-propos|who-we-are|team)\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.ABOUT,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/(landing|lp|offer)\//i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.LANDING_PAGE,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/(confirmation|thank[-_]?you|merci|success)\/?$/i.test(pathname) && !/order/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.CONFIRMATION,
      confidence: 40,
      method: 'fallback',
    };
  }

  if (/\/(product|item|p)\//i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.PRODUCT,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/(category|collection|catalog|shop)\//i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.COLLECTION,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/cart/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.CART,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/checkout/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.CHECKOUT,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/thank[-_]?you|order[-_]?(confirm|success)/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.THANK_YOU,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/[?&](q|s|query|search)=/i.test(window.location.search)) {
    return {
      pageType: PAGE_TYPES.SEARCH,
      confidence: 40,
      method: 'fallback',
    };
  }
  if (/\/blog\/?$/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.BLOG,
      confidence: 30,
      method: 'fallback',
    };
  }
  if (/\/blog\/.+/i.test(pathname)) {
    return {
      pageType: PAGE_TYPES.ARTICLE,
      confidence: 30,
      method: 'fallback',
    };
  }

  return {
    pageType: PAGE_TYPES.UNKNOWN,
    confidence: 0,
    method: 'fallback',
  };
}
