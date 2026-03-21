/**
 * Traacky Content Script — Entry point.
 * Runs in the content script isolated world on every page.
 * Orchestrates CMS detection, data extraction, event generation, and auditing.
 */

import { injectPageScript, initBridge, waitForPageContext } from './bridge.js';
import { detectCMS } from './detectors/cms-detector.js';
import { detectPageType } from './detectors/page-type-detector.js';
import { PixelDetector } from './detectors/pixel-detector.js';
import { SiteTypeDetector } from './detectors/site-type-detector.js';
import { LeadGenToolDetector } from './detectors/leadgen-tool-detector.js';
import { FormDetector } from './detectors/form-detector.js';
import { getExtractor } from './extractors/extractor-factory.js';
import { GA4Generator } from './generators/ga4-generator.js';
import { MetaGenerator } from './generators/meta-generator.js';
import { TikTokGenerator } from './generators/tiktok-generator.js';
import { PinterestGenerator } from './generators/pinterest-generator.js';
import { DataLayerAuditor } from './auditor/datalayer-auditor.js';
import { DiffEngine } from './auditor/diff-engine.js';
import { ConsentChecker } from './auditor/consent-checker.js';
import { MSG, sendMessage } from '../shared/messaging.js';

// Register CHECK_PAGE_LOAD_STATE handler immediately (before async init)
// so sidepanel can query page state even if pipeline hasn't completed yet
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === MSG.CHECK_PAGE_LOAD_STATE) {
    sendResponse({ alreadyLoaded: document.readyState === 'complete' });
    return true;
  }
});

// Prevent double initialization
if (!window.__TRACKPULSE_INITIALIZED__) {
  window.__TRACKPULSE_INITIALIZED__ = true;
  init();
}

async function init() {
  // 1. Initialize the bridge (set up message listeners)
  initBridge();

  // 2. Inject the page context script into the main world
  injectPageScript();

  // 3. Wait for the page context data to arrive
  const pageContext = await waitForPageContext(5000);

  // 4. Run the full detection and extraction pipeline
  await runPipeline(pageContext);

  // 5. dataLayer push listening is handled in bridge.js (initBridge)

  // 6. Listen for re-detection requests and CMP reopen
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === MSG.REQUEST_REDETECT) {
      handleRedetect();
      sendResponse({ success: true });
      return true;
    }
  });

  // 7. Watch for SPA navigation (pushState / popState)
  setupSPANavigationWatcher();
}

/**
 * Run the full detection -> extraction -> generation -> audit pipeline.
 */
async function runPipeline(pageContext) {
  try {
    // --- Phase 1: CMS + page type detection (synchronous, fast) ---
    const cmsResult = detectCMS(pageContext);
    const pageTypeResult = detectPageType(cmsResult.cms, pageContext);

    // --- Phase 2: Run independent work in parallel ---
    // Extraction is async (may do DOM reads / fetch). Pixel detection and
    // consent checking only need pageContext and are independent of extraction,
    // so run them concurrently.
    const extractor = getExtractor(cmsResult.cms, pageTypeResult.pageType);

    const [ecommerceData, pixels, consent, leadgenTools, forms] = await Promise.all([
      // Ecommerce data extraction (async)
      extractor.extract(pageContext).catch((e) => {
        console.debug('[Traacky] Extraction error:', e);
        return {
          currency: null,
          product: null,
          productImpressions: [],
          cart: null,
          order: null,
        };
      }),
      // Pixel detection (sync, wrapped in resolved promise for Promise.all)
      Promise.resolve(new PixelDetector().detect(pageContext)),
      // Consent check (sync, wrapped in resolved promise for Promise.all)
      Promise.resolve(new ConsentChecker().check(pageContext)),
      // Lead gen tool detection
      Promise.resolve(new LeadGenToolDetector().detect(pageContext)),
      // Form detection
      Promise.resolve(new FormDetector().detect()),
    ]);

    // --- Phase 2b: Site type detection (depends on CMS, pixels, pageType, dataLayer, leadgenTools) ---
    const siteTypeResult = new SiteTypeDetector().detect({
      cms: cmsResult.cms,
      pixels,
      pageType: pageTypeResult.pageType,
      dataLayerEvents: pageContext.dataLayer || [],
      leadgenTools,
      pageContext: {
        hasProductSchema: pageContext.hasProductSchema || false,
        hasServiceSchema: pageContext.hasServiceSchema || false,
        hasLocalBusinessSchema: pageContext.hasLocalBusinessSchema || false,
        hasOfferSchema: pageContext.hasOfferSchema || false,
        hasOgProduct: pageContext.hasOgProduct || false,
        formCount: forms.length,
      },
    });

    // --- Phase 3: Generate events + audit (depends on extraction) ---
    const ga4Events = new GA4Generator().generate(
      pageTypeResult.pageType,
      ecommerceData
    );
    const metaEvents = new MetaGenerator().generate(
      pageTypeResult.pageType,
      ecommerceData
    );
    const tiktokEvents = new TikTokGenerator().generate(
      pageTypeResult.pageType,
      ecommerceData
    );
    const pinterestEvents = new PinterestGenerator().generate(
      pageTypeResult.pageType,
      ecommerceData
    );

    const auditor = new DataLayerAuditor(pageContext);
    const existingEvents = auditor.getEcommerceEvents();
    const existingLeadgenEvents = auditor.getLeadGenEvents();
    const diffEngine = new DiffEngine();
    const diff = diffEngine.compareAll(
      ga4Events.filter((e) => e.eventName !== 'page_view'),
      [...existingEvents, ...existingLeadgenEvents]
    );

    // --- Phase 4: Send everything to background/sidepanel ---
    sendMessage(MSG.DETECTION_RESULT, {
      cms: cmsResult,
      pageType: pageTypeResult,
      siteType: siteTypeResult,
      ecommerceData,
      generatedEvents: {
        ga4: ga4Events,
        meta: metaEvents,
        tiktok: tiktokEvents,
        pinterest: pinterestEvents,
      },
      audit: {
        existingEvents,
        existingLeadgenEvents,
        diff,
      },
      pixels,
      leadgenTools,
      forms,
      consent,
      url: window.location.href,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.debug('[Traacky] Pipeline error:', e);
    // Send error state so the UI doesn't stay in loading
    sendMessage(MSG.DETECTION_RESULT, {
      cms: { cms: 'unknown', confidence: 0, signals: [], version: null },
      pageType: { pageType: 'unknown', confidence: 0, method: 'error' },
      ecommerceData: {
        currency: null,
        product: null,
        productImpressions: [],
        cart: null,
        order: null,
      },
      siteType: { siteType: 'unknown', confidence: 0, ecomScore: 0, leadgenScore: 0, signals: [] },
      generatedEvents: { ga4: [], meta: [], tiktok: [], pinterest: [] },
      audit: { existingEvents: [], existingLeadgenEvents: [], diff: [] },
      pixels: [],
      leadgenTools: [],
      forms: [],
      consent: {
        cmpDetected: 'none',
        googleConsent: {
          ad_storage: null,
          analytics_storage: null,
          ad_user_data: null,
          ad_personalization: null,
        },
        consentModeActive: false,
        raw: null,
      },
      url: window.location.href,
      timestamp: Date.now(),
      error: e.message,
    });
  }
}

/**
 * Handle re-detection (e.g., after SPA navigation or user refresh).
 */
async function handleRedetect() {
  injectPageScript();
  const pageContext = await waitForPageContext(5000);
  await runPipeline(pageContext);
}

/**
 * Watch for SPA navigation events (pushState, replaceState, popstate).
 */
function setupSPANavigationWatcher() {
  let lastUrl = window.location.href;

  // Override pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkUrlChange();
  };

  // Listen for popstate (back/forward)
  window.addEventListener('popstate', () => {
    checkUrlChange();
  });

  let debounceTimer = null;
  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      let oldPath, newPath;
      try {
        const a = new URL(lastUrl);
        const b = new URL(currentUrl);
        oldPath = a.origin + a.pathname;
        newPath = b.origin + b.pathname;
      } catch {
        oldPath = lastUrl.split('?')[0].split('#')[0];
        newPath = currentUrl.split('?')[0].split('#')[0];
      }
      lastUrl = currentUrl;

      // Only re-detect on true path changes. Query-string-only changes
      // (e.g. Shopify ?variant=...) should not reset captured events.
      if (oldPath !== newPath) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          handleRedetect();
        }, 200);
      }
    }
  }
}
