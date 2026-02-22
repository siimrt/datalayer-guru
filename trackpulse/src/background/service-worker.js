/**
 * TrackPulse Background Service Worker
 * Handles extension icon clicks, badge management, message routing, tab tracking,
 * and ExtensionPay license management (V2).
 */

import { MSG } from '../shared/messaging.js';
import { CMS_INFO } from '../shared/constants.js';
import { planManager } from '../licensing/plan-manager.js';
import { resolvePlanFromId } from '../shared/plans.js';

// Initialize ExtensionPay on extension startup
planManager.init().then(() => {
  console.log('[TrackPulse] Plan:', planManager.getPlan());
}).catch((err) => {
  console.error('[TrackPulse] Plan init error:', err);
});

// Listen for plan changes and notify all extension contexts
planManager.onChange((newPlan) => {
  chrome.runtime.sendMessage({
    type: 'TRACKPULSE_PLAN_CHANGED',
    payload: { plan: newPlan },
  }).catch(() => {}); // Ignore if no listeners
});

// Store per-tab context data
const tabContexts = {};

// --- Side Panel / Popup Fallback ---

// Chrome supports side panel natively. Other Chromium browsers (Arc, etc.) define
// chrome.sidePanel but silently consume the click without opening anything.
// For those, we fall back to an extension popup (dropdown attached to the icon).
const IS_GOOGLE_CHROME = navigator.userAgentData?.brands?.some(
  (b) => b.brand === 'Google Chrome'
) ?? false;

if (IS_GOOGLE_CHROME && chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} else {
  chrome.action.setPopup({ popup: 'src/sidepanel/index.html?popup=1' });
}

// --- Message Routing ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (msg.type) {
    case MSG.DETECTION_RESULT: {
      // Store context for this tab
      if (tabId) {
        tabContexts[tabId] = msg.payload;
        updateBadge(tabId, msg.payload);
      }
      // Forward to all extension pages (side panel)
      forwardToExtensionPages(msg);
      break;
    }

    case MSG.PAGE_CONTEXT: {
      // Forward page context to side panel
      if (tabId) {
        tabContexts[tabId] = { ...tabContexts[tabId], rawContext: msg.payload };
      }
      forwardToExtensionPages(msg);
      break;
    }

    case MSG.DATALAYER_PUSH: {
      // Forward dataLayer push to side panel
      forwardToExtensionPages(msg);
      break;
    }

    case MSG.NETWORK_REQUEST: {
      // Forward tracking network request to side panel
      forwardToExtensionPages(msg);
      break;
    }

    case MSG.FRAME_PIXELS: {
      // Forward frame pixel detection to side panel
      forwardToExtensionPages(msg);
      break;
    }

    case MSG.REQUEST_REDETECT: {
      // Forward re-detect request to the active tab's content script
      getActiveTabId().then((activeTabId) => {
        if (activeTabId) {
          chrome.tabs.sendMessage(
            activeTabId,
            { type: MSG.REQUEST_REDETECT },
            () => {
              // Ignore errors (tab may not have content script)
              if (chrome.runtime.lastError) {}
            }
          );
        }
      });
      sendResponse({ success: true });
      return true;
    }

    case MSG.EXECUTE_CODE: {
      // Forward code execution to the active tab's content script
      getActiveTabId().then((activeTabId) => {
        if (activeTabId) {
          chrome.tabs.sendMessage(
            activeTabId,
            { type: MSG.EXECUTE_CODE, code: msg.code || msg.payload?.code },
            () => {
              if (chrome.runtime.lastError) {}
            }
          );
        }
      });
      sendResponse({ success: true });
      return true;
    }

    case 'TRACKPULSE_GET_TAB_DATA': {
      // Side panel requesting current tab's stored data
      getActiveTabId().then((activeTabId) => {
        sendResponse(tabContexts[activeTabId] || null);
      });
      return true; // Async sendResponse
    }

    case 'TRACKPULSE_GET_PLAN': {
      // Wait for planManager to finish initializing, then return live state
      planManager.waitForInit().then((plan) => {
        const user = planManager.user;
        console.log('[TrackPulse] GET_PLAN responding with live plan:', plan, 'user:', JSON.stringify(user));
        sendResponse({
          plan: planManager.getPlan(),
          email: user?.email || null,
          paid: !!user?.paid,
          // Debug info for settings panel
          debug: {
            userPaid: user?.paid,
            subscriptionStatus: user?.subscriptionStatus,
            subscriptionPlanId: user?.subscriptionPlanId || null,
            paidAt: user?.paidAt,
            storedPlan: planManager._storedPlan || null,
            allKeys: user ? Object.keys(user) : [],
          },
        });
      }).catch((err) => {
        console.error('[TrackPulse] GET_PLAN error, falling back to cache:', err);
        chrome.storage.local.get(['tp_plan', 'tp_user_email', 'tp_paid'], (data) => {
          sendResponse({
            plan: data.tp_plan || 'free',
            email: data.tp_user_email || null,
            paid: data.tp_paid || false,
            debug: { source: 'cache', error: err.message },
          });
        });
      });
      return true; // Async sendResponse
    }

    case 'TRACKPULSE_OPEN_PAYMENT': {
      // Legacy fallback — opens default ExtensionPay page
      planManager.openPaymentPage();
      sendResponse({ success: true });
      break;
    }

    case 'TRACKPULSE_OPEN_STRIPE_CHECKOUT': {
      // Open Stripe Checkout for a specific plan nickname
      const planNickname = msg.payload?.planNickname;
      if (planNickname) {
        // Store which plan the user selected (ExtensionPay doesn't return planId)
        const selectedPlan = resolvePlanFromId(planNickname);
        if (selectedPlan) {
          chrome.storage.local.set({ tp_selected_plan: selectedPlan });
          planManager._storedPlan = selectedPlan;
        }
        planManager.openPaymentPage(planNickname);
      } else {
        planManager.openPaymentPage();
      }
      sendResponse({ success: true });
      break;
    }

    case 'TRACKPULSE_OPEN_MANAGEMENT': {
      planManager.openManagementPage();
      sendResponse({ success: true });
      break;
    }

    case 'TRACKPULSE_REFRESH_PLAN': {
      planManager.refreshPlan().then((plan) => {
        console.log('[TrackPulse] REFRESH_PLAN responded with:', plan);
        sendResponse({ plan: plan, email: planManager.user?.email || null });
      }).catch((err) => {
        console.error('[TrackPulse] REFRESH_PLAN error:', err);
        sendResponse({ plan: planManager.getPlan() });
      });
      return true; // Async sendResponse
    }

    case MSG.LIST_FRAMES: {
      // Discover Shopify custom pixel sandbox iframes in the active tab.
      // Strategy: find candidate frames by URL, then probe each for a dataLayer.
      getActiveTabId().then(async (activeTabId) => {
        if (!activeTabId) {
          sendResponse({ frames: [] });
          return;
        }
        try {
          const allFrames = await chrome.webNavigation.getAllFrames({ tabId: activeTabId });
          // Step 1: broad candidate filter — any non-top frame on a Shopify-related URL
          const candidates = (allFrames || []).filter((frame) => {
            if (frame.frameId === 0) return false;
            const url = (frame.url || '').toLowerCase();
            return (
              url.includes('web-pixels-manager') ||
              url.includes('custom-pixels') ||
              url.includes('shopify') ||
              url.includes('pixel') ||
              url.includes('wpm') ||
              url.includes('sandbox') ||
              url.startsWith('blob:') ||
              url === 'about:srcdoc' ||
              url === ''
            );
          });

          if (candidates.length === 0) {
            sendResponse({ frames: [] });
            return;
          }

          // Step 2: probe each candidate to check if it has a dataLayer
          const probeResults = [];
          for (const frame of candidates) {
            try {
              const result = await chrome.scripting.executeScript({
                target: { tabId: activeTabId, frameIds: [frame.frameId] },
                world: 'MAIN',
                func: () => {
                  const hasDL = !!(window.dataLayer && Array.isArray(window.dataLayer));
                  const dlLen = hasDL ? window.dataLayer.length : 0;
                  // Try to find a GTM container ID
                  let gtmId = null;
                  if (hasDL) {
                    for (const entry of window.dataLayer) {
                      if (entry?.['gtm.uniqueEventId'] !== undefined || entry?.['gtm.start']) {
                        gtmId = 'GTM detected';
                        break;
                      }
                    }
                  }
                  return { hasDL, dlLen, gtmId, title: document.title || null };
                },
              });
              const probeData = result?.[0]?.result;
              if (probeData?.hasDL) {
                probeResults.push({
                  frameId: frame.frameId,
                  url: frame.url,
                  label: extractPixelFrameLabel(frame.url, probeData),
                  hasDataLayer: true,
                  dataLayerLength: probeData.dlLen,
                });
              }
            } catch (probeErr) {
              // Frame not accessible (cross-origin sandbox) — skip
            }
          }

          sendResponse({ frames: probeResults });
        } catch (err) {
          console.debug('[TrackPulse] LIST_FRAMES error:', err);
          sendResponse({ frames: [] });
        }
      });
      return true;
    }

    case MSG.START_FRAME_MONITORING: {
      // Start continuous monitoring in a Shopify custom pixel sandbox frame.
      // Injects a bridge (ISOLATED world) + hooks (MAIN world) programmatically.
      const { frameId } = msg.payload || {};
      getActiveTabId().then(async (activeTabId) => {
        if (!activeTabId || frameId == null) {
          sendResponse({ success: false, error: 'No active tab or frameId' });
          return;
        }
        try {
          // Step 1: Inject bridge in ISOLATED world (default)
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId, frameIds: [frameId] },
            func: function frameBridge() {
              if (window.__TRACKPULSE_FRAME_BRIDGE__) return;
              window.__TRACKPULSE_FRAME_BRIDGE__ = true;
              window.addEventListener('message', (event) => {
                if (event.source !== window) return;
                const data = event.data;
                if (!data || !data.type) return;
                if (
                  data.type === 'TRACKPULSE_DATALAYER_PUSH' ||
                  data.type === 'TRACKPULSE_NETWORK_REQUEST' ||
                  data.type === 'TRACKPULSE_FRAME_PIXELS'
                ) {
                  try {
                    chrome.runtime.sendMessage({ type: data.type, payload: data.payload });
                  } catch (e) {}
                }
              });
            },
          });

          // Step 2: Inject hooks in MAIN world
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId, frameIds: [frameId] },
            world: 'MAIN',
            func: function frameMonitor() {
              if (window.__TRACKPULSE_FRAME_MONITOR__) return;
              window.__TRACKPULSE_FRAME_MONITOR__ = true;

              // --- Hook dataLayer.push ---
              function hookDataLayerPush() {
                if (window.__TRACKPULSE_FRAME_DL_HOOKED__) return true;
                if (!window.dataLayer || !Array.isArray(window.dataLayer)) return false;
                window.__TRACKPULSE_FRAME_DL_HOOKED__ = true;
                var originalPush = window.dataLayer.push.bind(window.dataLayer);
                window.dataLayer.push = function () {
                  var args = Array.prototype.slice.call(arguments);
                  var result = originalPush.apply(window.dataLayer, args);
                  try {
                    window.postMessage({
                      type: 'TRACKPULSE_DATALAYER_PUSH',
                      payload: {
                        data: JSON.parse(JSON.stringify(args)),
                        timestamp: Date.now(),
                        source: 'custom_pixel',
                      },
                    }, '*');
                  } catch (e) {}
                  return result;
                };
                return true;
              }

              if (!hookDataLayerPush()) {
                var dlCheckCount = 0;
                var dlChecker = setInterval(function () {
                  dlCheckCount++;
                  if (dlCheckCount > 50 || hookDataLayerPush()) {
                    clearInterval(dlChecker);
                  }
                }, 200);
              }

              // --- Hook fetch / XHR / sendBeacon ---
              var _TP_TRACKING_PATTERNS = [
                { platform: 'ga4',       re: /google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/ },
                { platform: 'meta',      re: /facebook\.com\/tr[\/?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/pixel/ },
                { platform: 'tiktok',    re: /analytics\.tiktok\.com|mon\.tiktok\.com/ },
                { platform: 'pinterest', re: /ct\.pinterest\.com|s\.pinimg\.com\/ct\/|trk\.pinterest\.com/ },
                { platform: 'snapchat',  re: /tr\.snapchat\.com\/|tr-shadow\.snapchat\.com/ },
                { platform: 'linkedin',  re: /px\.ads\.linkedin\.com|px4\.ads\.linkedin\.com|dc\.ads\.linkedin\.com|www\.linkedin\.com\/px\/|www\.linkedin\.com\/li\/track|p\.adsymptotic\.com|sjs\.bizographics\.com|linkedin\.oribi\.io/ },
              ];

              function _tpMatchUrl(url) {
                if (!url || typeof url !== 'string') return null;
                for (var i = 0; i < _TP_TRACKING_PATTERNS.length; i++) {
                  if (_TP_TRACKING_PATTERNS[i].re.test(url)) return _TP_TRACKING_PATTERNS[i].platform;
                }
                return null;
              }

              function _tpPostNetworkHit(platform, url, method, body) {
                try {
                  window.postMessage({
                    type: 'TRACKPULSE_NETWORK_REQUEST',
                    payload: {
                      platform: platform,
                      url: String(url).slice(0, 4000),
                      method: method,
                      body: body ? String(body).slice(0, 8000) : null,
                      timestamp: Date.now(),
                      source: 'custom_pixel',
                    },
                  }, '*');
                } catch (e) {}
              }

              // Hook fetch
              var _origFetch = window.fetch;
              window.fetch = function (input, init) {
                try {
                  var url = typeof input === 'string' ? input
                            : (input instanceof Request) ? input.url
                            : String(input);
                  var platform = _tpMatchUrl(url);
                  if (platform) {
                    var method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
                    var body = null;
                    if (init && init.body) {
                      if (typeof init.body === 'string') body = init.body;
                      else if (init.body instanceof URLSearchParams) body = init.body.toString();
                    }
                    _tpPostNetworkHit(platform, url, method, body);
                  }
                } catch (e) {}
                return _origFetch.apply(this, arguments);
              };

              // Hook XMLHttpRequest
              var _origXHROpen = XMLHttpRequest.prototype.open;
              var _origXHRSend = XMLHttpRequest.prototype.send;
              XMLHttpRequest.prototype.open = function (method, url) {
                this.__tp_method = method;
                this.__tp_url = String(url);
                return _origXHROpen.apply(this, arguments);
              };
              XMLHttpRequest.prototype.send = function (body) {
                try {
                  if (this.__tp_url) {
                    var platform = _tpMatchUrl(this.__tp_url);
                    if (platform) {
                      _tpPostNetworkHit(platform, this.__tp_url, this.__tp_method || 'GET', body ? String(body) : null);
                    }
                  }
                } catch (e) {}
                return _origXHRSend.apply(this, arguments);
              };

              // Hook navigator.sendBeacon
              if (navigator.sendBeacon) {
                var _origBeacon = navigator.sendBeacon.bind(navigator);
                navigator.sendBeacon = function (url, data) {
                  try {
                    var platform = _tpMatchUrl(String(url));
                    if (platform) {
                      _tpPostNetworkHit(platform, String(url), 'BEACON', data ? String(data) : null);
                    }
                  } catch (e) {}
                  return _origBeacon.apply(navigator, arguments);
                };
              }

              // --- Replay existing dataLayer entries ---
              try {
                if (window.dataLayer && Array.isArray(window.dataLayer)) {
                  for (var i = 0; i < window.dataLayer.length; i++) {
                    window.postMessage({
                      type: 'TRACKPULSE_DATALAYER_PUSH',
                      payload: {
                        data: JSON.parse(JSON.stringify([window.dataLayer[i]])),
                        timestamp: Date.now(),
                        source: 'custom_pixel',
                      },
                    }, '*');
                  }
                }
              } catch (e) {}

              // --- Detect pixels (one-shot) ---
              try {
                var pixels = [];

                // Check globals
                if (typeof window.fbq === 'function') {
                  var fbId = null;
                  try {
                    if (window.fbq.getState) {
                      var st = window.fbq.getState();
                      if (st && st.pixels && st.pixels[0]) fbId = st.pixels[0].id;
                    }
                  } catch (e) {}
                  pixels.push({ platform: 'meta', id: fbId, active: true });
                }

                if (typeof window.gtag === 'function') {
                  pixels.push({ platform: 'ga4', id: null, active: true });
                }

                if (typeof window.ttq === 'object' && window.ttq !== null) {
                  pixels.push({ platform: 'tiktok', id: null, active: true });
                }

                if (typeof window.pintrk === 'function') {
                  pixels.push({ platform: 'pinterest', id: null, active: true });
                }

                // Check GTM via google_tag_manager global
                if (typeof window.google_tag_manager === 'object' && window.google_tag_manager !== null) {
                  var gtmIds = Object.keys(window.google_tag_manager).filter(function (k) {
                    return k.indexOf('GTM-') === 0;
                  });
                  for (var g = 0; g < gtmIds.length; g++) {
                    pixels.push({ platform: 'gtm', id: gtmIds[g], active: true });
                  }
                }

                // Check dataLayer for config events (G-XXXX, GTM-XXXX)
                if (window.dataLayer && Array.isArray(window.dataLayer)) {
                  for (var d = 0; d < window.dataLayer.length; d++) {
                    var entry = window.dataLayer[d];
                    // gtag('config', 'G-XXXX') stored as {0: 'config', 1: 'G-XXXX'}
                    if (entry && entry['0'] === 'config' && typeof entry['1'] === 'string') {
                      var configId = entry['1'];
                      if (/^G-/.test(configId) && !pixels.some(function (p) { return p.platform === 'ga4' && p.id === configId; })) {
                        pixels.push({ platform: 'ga4', id: configId, active: true });
                      }
                      if (/^GTM-/.test(configId) && !pixels.some(function (p) { return p.platform === 'gtm' && p.id === configId; })) {
                        pixels.push({ platform: 'gtm', id: configId, active: true });
                      }
                    }
                  }
                }

                // Check DOM for script tags
                var scripts = document.querySelectorAll('script[src]');
                for (var s = 0; s < scripts.length; s++) {
                  var src = scripts[s].src || '';
                  if (src.indexOf('googletagmanager.com/gtm.js') !== -1) {
                    var gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
                    if (gtmMatch && !pixels.some(function (p) { return p.platform === 'gtm' && p.id === gtmMatch[1]; })) {
                      pixels.push({ platform: 'gtm', id: gtmMatch[1], active: true });
                    }
                  }
                  if (src.indexOf('googletagmanager.com/gtag/js') !== -1) {
                    var gaMatch = src.match(/[?&]id=(G-[A-Z0-9]+)/);
                    if (gaMatch && !pixels.some(function (p) { return p.platform === 'ga4' && p.id === gaMatch[1]; })) {
                      pixels.push({ platform: 'ga4', id: gaMatch[1], active: true });
                    }
                  }
                  if (src.indexOf('connect.facebook.net') !== -1 && !pixels.some(function (p) { return p.platform === 'meta'; })) {
                    pixels.push({ platform: 'meta', id: null, active: true });
                  }
                }

                if (pixels.length > 0) {
                  window.postMessage({
                    type: 'TRACKPULSE_FRAME_PIXELS',
                    payload: { pixels: pixels },
                  }, '*');
                }
              } catch (e) {}
            },
          });

          sendResponse({ success: true });
        } catch (err) {
          console.debug('[TrackPulse] START_FRAME_MONITORING error:', err);
          sendResponse({ success: false, error: err.message });
        }
      });
      return true;
    }

    case MSG.EXECUTE_IN_FRAME: {
      // Execute code in a specific iframe (Shopify custom pixel sandbox)
      const { code, frameId } = msg.payload || {};
      getActiveTabId().then(async (activeTabId) => {
        if (!activeTabId) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId, frameIds: [frameId] },
            world: 'MAIN',
            func: (codeStr) => {
              new Function(codeStr)();
            },
            args: [code],
          });
          sendResponse({ success: true });
        } catch (err) {
          console.debug('[TrackPulse] EXECUTE_IN_FRAME error:', err);
          sendResponse({ success: false, error: err.message });
        }
      });
      return true;
    }
  }
});

// --- Tab Tracking ---

// When a tab becomes active, optionally send its stored context to the side panel
chrome.tabs.onActivated.addListener(({ tabId }) => {
  // Check if auto-switch-tab is enabled (default: false)
  chrome.storage.local.get('tp_auto_switch_tab', (data) => {
    if (!data.tp_auto_switch_tab) return; // Disabled by default

    // Tell sidepanel to clear live streams (different tab = different page)
    forwardToExtensionPages({ type: 'TRACKPULSE_PAGE_NAVIGATED' });

    const context = tabContexts[tabId];
    if (context) {
      forwardToExtensionPages({
        type: MSG.DETECTION_RESULT,
        payload: context,
      });
    } else {
      // No cached data — request re-detection
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.REQUEST_REDETECT },
        () => {
          if (chrome.runtime.lastError) {}
        }
      );
    }
  });
});

// When a tab navigates, re-run detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // URL changed (full nav or SPA pushState) — tell sidepanel to clear streams
  // This fires BEFORE the new page's scripts run, so new events won't be wiped.
  if (changeInfo.url) {
    getActiveTabId().then((activeTabId) => {
      if (activeTabId === tabId) {
        forwardToExtensionPages({ type: 'TRACKPULSE_PAGE_NAVIGATED' });
      }
    });
  }

  if (changeInfo.status === 'complete') {
    // Clear old data for this tab.
    // The content script (injected at document_idle via manifest) will
    // auto-run the detection pipeline and send DETECTION_RESULT, so we
    // do NOT need to send REQUEST_REDETECT here — that would cause a
    // redundant second pipeline run.
    delete tabContexts[tabId];
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabContexts[tabId];
});

// --- Badge Management ---

function updateBadge(tabId, data) {
  if (!data?.cms?.cms) return;

  const cms = data.cms.cms;
  const info = CMS_INFO[cms] || CMS_INFO.unknown;

  chrome.action.setBadgeText({
    text: info.badge,
    tabId,
  });

  chrome.action.setBadgeBackgroundColor({
    color: info.color,
    tabId,
  });

  chrome.action.setBadgeTextColor({
    color: '#FFFFFF',
    tabId,
  });
}

// --- Helpers ---

function getActiveTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]?.id || null);
    });
  });
}

function forwardToExtensionPages(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // No listeners — side panel may not be open
  });
}

function extractPixelFrameLabel(url, probeData) {
  let label = 'Custom Pixel';
  if (url) {
    try {
      const u = new URL(url);
      const name = u.searchParams.get('name') || u.searchParams.get('pixel');
      if (name) { label = `Custom Pixel: ${name}`; }
      else if (url.includes('web-pixels-manager')) { label = 'Shopify Pixel Sandbox'; }
      else if (url.startsWith('blob:') || url === 'about:srcdoc') { label = 'Pixel Sandbox'; }
    } catch {
      if (url.includes('shopify')) { label = 'Shopify Pixel'; }
    }
  }
  // Append dataLayer info from probe
  if (probeData) {
    const suffix = probeData.gtmId ? ' (GTM)' : ` (dL: ${probeData.dlLen})`;
    label += suffix;
  }
  return label;
}
