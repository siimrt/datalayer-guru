/**
 * Early Network Hooks — ISOLATED world bridge.
 * Listens for TRACKPULSE_NETWORK_REQUEST messages from the MAIN world
 * (injected via early-network-hooks-main.js) and forwards them to the
 * service worker via chrome.runtime.sendMessage.
 *
 * The MAIN world script is now injected natively by Chrome via manifest
 * "world": "MAIN", which bypasses CSP restrictions on all sites.
 */
(function () {
  'use strict';

  const pendingMessages = [];
  let bridgeReady = false;

  function forwardToBackground(payload) {
    try {
      chrome.runtime.sendMessage({
        type: 'TRACKPULSE_NETWORK_REQUEST',
        payload: payload,
      });
    } catch (e) {
      pendingMessages.push(payload);
    }
  }

  function flushPending() {
    if (bridgeReady) return;
    bridgeReady = true;
    for (const msg of pendingMessages) {
      try {
        chrome.runtime.sendMessage({
          type: 'TRACKPULSE_NETWORK_REQUEST',
          payload: msg,
        });
      } catch (e) {}
    }
    pendingMessages.length = 0;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'TRACKPULSE_NETWORK_REQUEST') {
      forwardToBackground(event.data.payload);
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    flushPending();
  } else {
    document.addEventListener('DOMContentLoaded', flushPending);
  }
})();
