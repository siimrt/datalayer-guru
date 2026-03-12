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

    // --- Structured data scoring ---
    if (pageContext.hasProductSchema) {
      ecomScore += 25;
      signals.push('schema:Product(+25)');
    }
    if (pageContext.hasServiceSchema || pageContext.hasLocalBusinessSchema) {
      leadgenScore += 15;
      signals.push('schema:Service/LocalBusiness(+15)');
    }

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
}
