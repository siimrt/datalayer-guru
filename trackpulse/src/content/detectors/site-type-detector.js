/**
 * Site Type Detector — Scoring-based detection of whether a site is ecommerce, lead gen, or hybrid.
 * Uses CMS, detected pixels, page type, dataLayer events, and lead gen tools as signals.
 */

import { SITE_TYPES, CMS_SITE_TYPE_MAP } from '../../shared/constants.js';

export class SiteTypeDetector {
  /**
   * Detect the site type based on all available signals.
   *
   * @param {Object} params
   * @param {string} params.cms - Detected CMS identifier
   * @param {Array} params.pixels - Detected ad pixels
   * @param {string} params.pageType - Detected page type
   * @param {Array} params.dataLayerEvents - Events found in dataLayer
   * @param {Array} params.leadgenTools - Detected lead gen tools (CRM, chat, call tracking, etc.)
   * @param {Object} params.pageContext - Raw page context data
   * @returns {{ siteType: string, confidence: number, ecomScore: number, leadgenScore: number, signals: string[] }}
   */
  detect({ cms, pixels = [], pageType, dataLayerEvents = [], leadgenTools = [], pageContext = {} } = {}) {
    let ecomScore = 0;
    let leadgenScore = 0;
    const signals = [];

    // --- CMS-based scoring ---
    const cmsDefault = CMS_SITE_TYPE_MAP[cms];
    if (cmsDefault === SITE_TYPES.ECOMMERCE) {
      ecomScore += 40;
      signals.push(`cms:${cms}=ecom(+40)`);
    } else if (cmsDefault === SITE_TYPES.LEADGEN) {
      leadgenScore += 40;
      signals.push(`cms:${cms}=leadgen(+40)`);
    }

    // --- Lead gen tools scoring ---
    for (const tool of leadgenTools) {
      const cat = tool.category;
      if (cat === 'crm') {
        leadgenScore += 20;
        signals.push(`crm:${tool.platform}(+20)`);
      } else if (cat === 'call_tracking') {
        leadgenScore += 25;
        signals.push(`call:${tool.platform}(+25)`);
      } else if (cat === 'chat') {
        leadgenScore += 15;
        signals.push(`chat:${tool.platform}(+15)`);
      } else if (cat === 'scheduling') {
        leadgenScore += 20;
        signals.push(`sched:${tool.platform}(+20)`);
      }
    }

    // --- Page type scoring ---
    const ecomPages = new Set(['product', 'collection', 'cart', 'checkout', 'thank_you']);
    const leadgenPages = new Set(['contact', 'demo_request', 'form_page', 'landing_page', 'pricing', 'confirmation', 'services']);
    if (ecomPages.has(pageType)) {
      ecomScore += 25;
      signals.push(`pageType:${pageType}=ecom(+25)`);
    } else if (leadgenPages.has(pageType)) {
      leadgenScore += 20;
      signals.push(`pageType:${pageType}=leadgen(+20)`);
    }

    // --- DataLayer events scoring ---
    const ecomEventNames = new Set([
      'view_item', 'add_to_cart', 'view_cart', 'begin_checkout', 'purchase',
      'view_item_list', 'select_item', 'add_shipping_info', 'add_payment_info',
    ]);
    const leadgenEventNames = new Set([
      'generate_lead', 'sign_up', 'contact', 'form_submit', 'form_start',
      'schedule', 'book_appointment', 'request_quote', 'qualify_lead',
    ]);

    let hasEcomEvents = false;
    let hasLeadgenEvents = false;
    for (const entry of dataLayerEvents) {
      const eventName = entry.event || entry.eventName;
      if (eventName && ecomEventNames.has(eventName)) hasEcomEvents = true;
      if (eventName && leadgenEventNames.has(eventName)) hasLeadgenEvents = true;
    }
    if (hasEcomEvents) {
      ecomScore += 30;
      signals.push('dataLayer:ecom_events(+30)');
    }
    if (hasLeadgenEvents) {
      leadgenScore += 30;
      signals.push('dataLayer:leadgen_events(+30)');
    }

    // --- Structured data scoring (from pageContext + direct DOM fallback) ---
    const schemaFlags = this._getSchemaFlags(pageContext);
    if (schemaFlags.hasProductSchema) {
      ecomScore += 25;
      signals.push('schema:Product(+25)');
    }
    if (schemaFlags.hasOfferSchema) {
      ecomScore += 15;
      signals.push('schema:Offer(+15)');
    }
    if (schemaFlags.hasOgProduct) {
      ecomScore += 15;
      signals.push('og:product(+15)');
    }
    if (schemaFlags.hasServiceSchema || schemaFlags.hasLocalBusinessSchema) {
      leadgenScore += 15;
      signals.push('schema:Service/LocalBusiness(+15)');
    }

    // --- DOM-based e-commerce signals ---
    const domEcomSignals = this._detectDomEcomSignals();
    ecomScore += domEcomSignals.score;
    signals.push(...domEcomSignals.signals);

    // --- URL-based e-commerce signals ---
    const urlEcomSignals = this._detectUrlEcomSignals();
    ecomScore += urlEcomSignals.score;
    signals.push(...urlEcomSignals.signals);

    // --- Forms scoring (from page context) ---
    if (pageContext.formCount > 0 && !hasEcomEvents) {
      leadgenScore += 15;
      signals.push(`forms:${pageContext.formCount}(+15)`);
    }

    // --- Classification ---
    const threshold = 15;
    let siteType, confidence;

    if (ecomScore > leadgenScore + threshold) {
      siteType = SITE_TYPES.ECOMMERCE;
      confidence = Math.min(1, ecomScore / (ecomScore + leadgenScore + 1));
    } else if (leadgenScore > ecomScore + threshold) {
      siteType = SITE_TYPES.LEADGEN;
      confidence = Math.min(1, leadgenScore / (ecomScore + leadgenScore + 1));
    } else if (ecomScore > 20 && leadgenScore > 20) {
      siteType = SITE_TYPES.HYBRID;
      confidence = 0.7;
    } else {
      siteType = SITE_TYPES.UNKNOWN;
      confidence = 0.3;
    }

    return {
      siteType,
      confidence: Math.round(confidence * 100),
      ecomScore,
      leadgenScore,
      signals,
    };
  }

  /**
   * Detect e-commerce signals from DOM elements.
   */
  _detectDomEcomSignals() {
    let score = 0;
    const signals = [];

    try {
      // Cart links/icons
      if (document.querySelector('a[href*="/cart"], a[href*="/panier"], a[href*="/basket"], a[href*="/bag"], .cart-icon, [data-cart], .mini-cart, [class*="minicart"], [class*="mini-cart"], [class*="shopping-bag"], [class*="header-cart"]')) {
        score += 15;
        signals.push('dom:cart(+15)');
      }

      // Add-to-cart buttons
      if (document.querySelector('[class*="add-to-cart"], [class*="add_to_cart"], [data-action="add-to-cart"], [class*="addtocart"], button[class*="add-cart"], [class*="btn-cart"]')) {
        score += 20;
        signals.push('dom:add-to-cart(+20)');
      }

      // Price elements
      if (document.querySelector('.price, [class*="product-price"], [class*="price-"], [class*="-price"], .money, [data-price], [class*="amount"], [class*="regular-price"], [class*="sale-price"]')) {
        score += 10;
        signals.push('dom:price(+10)');
      }

      // Product grids / product cards / product listings
      if (document.querySelector('.product-grid, [class*="product-card"], .products-grid, [class*="product-list"], [class*="product-item"], [class*="product-tile"], [data-product-id], [data-product], [class*="product_card"], [class*="plp-"], [class*="catalog"]')) {
        score += 10;
        signals.push('dom:product-grid(+10)');
      }

      // Payment scripts
      if (document.querySelector('script[src*="js.stripe.com"], script[src*="paypal.com/sdk"], script[src*="adyen.com"], script[src*="checkout.com"], script[src*="klarna.com"], script[src*="afterpay"]')) {
        score += 20;
        signals.push('dom:payment-script(+20)');
      }

      // E-commerce navigation links (categories, brands, collections patterns in menus)
      const navLinks = document.querySelectorAll('nav a, [class*="menu"] a, header a');
      let ecomNavCount = 0;
      const ecomNavPatterns = /\/(homme|femme|women|men|kids|enfant|collection|catalog|categor|marque|brand|shop|boutique|product|article|accessoire|chaussure|vetement|clothing|shoes)/i;
      for (let i = 0; i < Math.min(navLinks.length, 150); i++) {
        if (ecomNavPatterns.test(navLinks[i].href || '')) {
          ecomNavCount++;
          if (ecomNavCount >= 3) break;
        }
      }
      if (ecomNavCount >= 3) {
        score += 15;
        signals.push('dom:ecom-nav(+15)');
      }
    } catch (e) {}

    return { score, signals };
  }

  /**
   * Get structured data flags — uses pageContext if available, falls back to direct DOM scan.
   */
  _getSchemaFlags(pageContext) {
    const flags = {
      hasProductSchema: pageContext.hasProductSchema || false,
      hasServiceSchema: pageContext.hasServiceSchema || false,
      hasLocalBusinessSchema: pageContext.hasLocalBusinessSchema || false,
      hasOfferSchema: pageContext.hasOfferSchema || false,
      hasOgProduct: pageContext.hasOgProduct || false,
    };

    // If nothing was passed from pageContext, scan DOM directly (fallback)
    if (!flags.hasProductSchema && !flags.hasOfferSchema && !flags.hasOgProduct) {
      try {
        const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of ldScripts) {
          const text = script.textContent || '';
          if (text.includes('"Product"')) flags.hasProductSchema = true;
          if (text.includes('"Service"')) flags.hasServiceSchema = true;
          if (text.includes('"LocalBusiness"') || text.includes('"Store"') || text.includes('"Restaurant"')) flags.hasLocalBusinessSchema = true;
          if (text.includes('"Offer"') || text.includes('"AggregateOffer"')) flags.hasOfferSchema = true;
        }
        const ogType = document.querySelector('meta[property="og:type"]');
        if (ogType && ogType.content === 'product') flags.hasOgProduct = true;
      } catch (e) {}
    }

    return flags;
  }

  /**
   * Detect e-commerce signals from URL paths.
   */
  _detectUrlEcomSignals() {
    let score = 0;
    const signals = [];

    try {
      const path = window.location.pathname.toLowerCase();
      const ecomPaths = ['/shop', '/store', '/products', '/cart', '/checkout', '/boutique', '/panier', '/catalogue', '/collection', '/homme', '/femme', '/women', '/men', '/kids'];
      for (const p of ecomPaths) {
        if (path.startsWith(p) || path.includes(p + '/') || path.includes(p + '?')) {
          score += 10;
          signals.push(`url:${p}(+10)`);
          break;
        }
      }
    } catch (e) {}

    return { score, signals };
  }
}
