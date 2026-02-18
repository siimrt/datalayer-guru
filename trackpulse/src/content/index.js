/**
 * TrackPulse Content Script — Entry point.
 * Runs in the content script isolated world on every page.
 * Orchestrates CMS detection, data extraction, event generation, and auditing.
 */

import { injectPageScript, initBridge, waitForPageContext } from './bridge.js';
import { detectCMS } from './detectors/cms-detector.js';
import { detectPageType } from './detectors/page-type-detector.js';
import { PixelDetector } from './detectors/pixel-detector.js';
import { getExtractor } from './extractors/extractor-factory.js';
import { GA4Generator } from './generators/ga4-generator.js';
import { MetaGenerator } from './generators/meta-generator.js';
import { TikTokGenerator } from './generators/tiktok-generator.js';
import { PinterestGenerator } from './generators/pinterest-generator.js';
import { DataLayerAuditor } from './auditor/datalayer-auditor.js';
import { DiffEngine } from './auditor/diff-engine.js';
import { ConsentChecker } from './auditor/consent-checker.js';
import { MSG, sendMessage } from '../shared/messaging.js';

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

  // 5. Listen for dataLayer pushes (forwarded from page context)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'TRACKPULSE_DATALAYER_PUSH') {
      sendMessage(MSG.DATALAYER_PUSH, {
        data: event.data.payload,
        timestamp: Date.now(),
      });
    }
  });

  // 6. Listen for re-detection requests
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
    // 3. Detect CMS
    const cmsResult = detectCMS(pageContext);

    // 4. Detect page type
    const pageTypeResult = detectPageType(cmsResult.cms, pageContext);

    // 5. Extract ecommerce data
    const extractor = getExtractor(cmsResult.cms, pageTypeResult.pageType);
    let ecommerceData;
    try {
      ecommerceData = await extractor.extract(pageContext);
    } catch (e) {
      console.debug('[TrackPulse] Extraction error:', e);
      ecommerceData = {
        currency: null,
        product: null,
        productImpressions: [],
        cart: null,
        order: null,
      };
    }

    // 6. Generate events for all platforms
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

    // 7. Audit existing tracking
    const auditor = new DataLayerAuditor(pageContext);
    const existingEvents = auditor.getEcommerceEvents();
    const diffEngine = new DiffEngine();
    const diff = diffEngine.compareAll(
      ga4Events.filter((e) => e.eventName !== 'page_view'),
      existingEvents
    );

    // 8. Detect pixels
    const pixelDetector = new PixelDetector();
    const pixels = pixelDetector.detect(pageContext);

    // 9. Check consent
    const consentChecker = new ConsentChecker();
    const consent = consentChecker.check(pageContext);

    // 10. Send everything to background/sidepanel
    sendMessage(MSG.DETECTION_RESULT, {
      cms: cmsResult,
      pageType: pageTypeResult,
      ecommerceData,
      generatedEvents: {
        ga4: ga4Events,
        meta: metaEvents,
        tiktok: tiktokEvents,
        pinterest: pinterestEvents,
      },
      audit: {
        existingEvents,
        diff,
      },
      pixels,
      consent,
      url: window.location.href,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.debug('[TrackPulse] Pipeline error:', e);
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
      generatedEvents: { ga4: [], meta: [], tiktok: [], pinterest: [] },
      audit: { existingEvents: [], diff: [] },
      pixels: [],
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

  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Debounce: wait a bit for the page to update
      setTimeout(() => {
        handleRedetect();
      }, 500);
    }
  }
}
