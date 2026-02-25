/**
 * Bridge module — Handles communication between:
 *   Page Context (main world) <-> Content Script (isolated world) <-> Background/SidePanel
 */

import { MSG, sendMessage } from '../shared/messaging.js';

let pageContext = null;
let pageContextResolve = null;
let pageContextPromise = new Promise((resolve) => {
  pageContextResolve = resolve;
});

/**
 * Inject the page-context-script.js into the page's main world.
 * This gives it access to window.Shopify, window.dataLayer, etc.
 */
export function injectPageScript() {
  // Reset the context for re-detection. Create a fresh promise so
  // waitForPageContext() blocks until the NEW context message arrives
  // instead of resolving instantly with stale data from the old promise.
  pageContext = null;
  pageContextPromise = new Promise((resolve) => {
    pageContextResolve = resolve;
  });

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/page-context-script.js');
  script.onload = () => script.remove();
  script.onerror = () => {
    console.debug('[Traacky] Failed to inject page context script');
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Initialize the bridge listeners.
 */
export function initBridge() {
  // Listen for messages from the injected page-context script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    const { type, payload } = event.data || {};

    if (type === 'TRACKPULSE_PAGE_CONTEXT') {
      pageContext = payload;
      if (pageContextResolve) {
        pageContextResolve(payload);
        pageContextResolve = null;
      }
      // Also forward to background/sidepanel
      sendMessage(MSG.PAGE_CONTEXT, payload);
    }

    if (type === 'TRACKPULSE_DATALAYER_PUSH') {
      sendMessage(MSG.DATALAYER_PUSH, {
        data: payload,
        timestamp: Date.now(),
      });
    }

    if (type === 'TRACKPULSE_NETWORK_REQUEST') {
      sendMessage(MSG.NETWORK_REQUEST, payload);
    }

    if (type === 'TRACKPULSE_EXECUTE_RESULT') {
      // Could dispatch a custom event for code that's waiting on execution results
      document.dispatchEvent(
        new CustomEvent('trackpulse:execute-result', { detail: payload })
      );
    }
  });

  // Listen for messages from sidepanel/background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === MSG.EXECUTE_CODE) {
      // Forward execution request to page context via postMessage
      window.postMessage(
        {
          type: 'TRACKPULSE_EXECUTE_IN_PAGE',
          code: msg.code || msg.payload?.code,
        },
        '*'
      );
      sendResponse({ success: true });
      return true;
    }

    if (msg.type === MSG.REQUEST_REDETECT) {
      // Re-inject the page context script to re-collect data
      injectPageScript();
      sendResponse({ success: true });
      return true;
    }
  });
}

/**
 * Wait for the page context to be collected from the injected script.
 * Times out after 5 seconds.
 */
export function waitForPageContext(timeoutMs = 5000) {
  if (pageContext) return Promise.resolve(pageContext);

  return Promise.race([
    pageContextPromise,
    new Promise((resolve) =>
      setTimeout(() => resolve(pageContext || {}), timeoutMs)
    ),
  ]);
}

/**
 * Execute JavaScript code in the page's main world context.
 * Returns a promise that resolves with the execution result.
 */
export function executeInPage(code) {
  return new Promise((resolve) => {
    const handler = (event) => {
      document.removeEventListener('trackpulse:execute-result', handler);
      resolve(event.detail);
    };
    document.addEventListener('trackpulse:execute-result', handler);

    window.postMessage(
      {
        type: 'TRACKPULSE_EXECUTE_IN_PAGE',
        code,
      },
      '*'
    );

    // Timeout after 3 seconds
    setTimeout(() => {
      document.removeEventListener('trackpulse:execute-result', handler);
      resolve({ success: false, error: 'Execution timeout' });
    }, 3000);
  });
}
