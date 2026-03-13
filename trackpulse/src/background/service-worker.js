/**
 * Traacky Background Service Worker
 * Handles extension icon clicks, badge management, message routing, tab tracking,
 * and ExtensionPay license management (V2).
 */

import { MSG } from '../shared/messaging.js';
import { CMS_INFO } from '../shared/constants.js';
import { planManager } from '../licensing/plan-manager.js';
import { resolvePlanFromId } from '../shared/plans.js';

// Initialize ExtensionPay on extension startup
planManager.init().then(() => {
  console.log('[Traacky] Plan:', planManager.getPlan());
}).catch((err) => {
  console.error('[Traacky] Plan init error:', err);
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
// Track last known URL per tab (to distinguish query-only changes from real navigations)
const _tabUrls = {};

/** Check if two URLs share origin + pathname (only query/hash differs) */
function isSameBasePath(url1, url2) {
  try {
    const a = new URL(url1);
    const b = new URL(url2);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch { return false; }
}

// --- WebRequest-based network detection ---
// Catches tracking requests that bypass JS hooks (iframes, Privacy Sandbox, etc.)

const WEB_REQUEST_TRACKING_PATTERNS = [
  { platform: 'ga4',       pattern: '*://google-analytics.com/g/collect*' },
  { platform: 'ga4',       pattern: '*://analytics.google.com/g/collect*' },
  { platform: 'ga4',       pattern: '*://*/g/collect?*tid=G-*' },  // Server-side GTM proxy (Stape, etc.)
  { platform: 'google_ads', pattern: '*://googleads.g.doubleclick.net/pagead/conversion*' },
  { platform: 'google_ads', pattern: '*://www.googleadservices.com/pagead/conversion*' },
  { platform: 'google_ads', pattern: '*://googleads.g.doubleclick.net/pagead/viewthroughconversion*' },
  { platform: 'meta',      pattern: '*://*.facebook.com/tr*' },
  { platform: 'meta',      pattern: '*://*.facebook.com/privacy_sandbox/*' },
  { platform: 'meta',      pattern: '*://graph.facebook.com/*' },
  { platform: 'tiktok',    pattern: '*://analytics.tiktok.com/*' },
  { platform: 'tiktok',    pattern: '*://mon.tiktok.com/*' },
  { platform: 'tiktok',    pattern: '*://business-api.tiktok.com/*' },
  { platform: 'pinterest', pattern: '*://ct.pinterest.com/*' },
  { platform: 'pinterest', pattern: '*://*.pinimg.com/ct/*' },
  { platform: 'pinterest', pattern: '*://trk.pinterest.com/*' },
  { platform: 'snapchat',  pattern: '*://tr.snapchat.com/*' },
  { platform: 'snapchat',  pattern: '*://tr-shadow.snapchat.com/*' },
  { platform: 'linkedin',  pattern: '*://px.ads.linkedin.com/*' },
  { platform: 'linkedin',  pattern: '*://px4.ads.linkedin.com/*' },
  { platform: 'linkedin',  pattern: '*://dc.ads.linkedin.com/*' },
];

const webRequestUrls = WEB_REQUEST_TRACKING_PATTERNS.map(p => p.pattern);

function matchPlatformFromUrl(url) {
  const MATCHERS = [
    { platform: 'ga4',       re: /google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/ },
    { platform: 'ga4',       re: /\/g\/collect\?.*tid=G-/ },  // Server-side GTM proxy (Stape, etc.)
    { platform: 'google_ads', re: /googleads\.g\.doubleclick\.net\/pagead\/(?:conversion|viewthroughconversion)|googleadservices\.com\/pagead\/conversion/ },
    { platform: 'meta',      re: /facebook\.com\/tr[\/?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/|graph\.facebook\.com/ },
    { platform: 'tiktok',    re: /analytics\.tiktok\.com\/(?:api|i18n\/pixel)|mon\.tiktok\.com|business-api\.tiktok\.com/ },
    { platform: 'pinterest', re: /ct\.pinterest\.com|pinimg\.com\/ct\/|trk\.pinterest\.com/ },
    { platform: 'snapchat',  re: /tr\.snapchat\.com|tr-shadow\.snapchat\.com/ },
    { platform: 'linkedin',  re: /px\.ads\.linkedin\.com|px4\.ads\.linkedin\.com|dc\.ads\.linkedin\.com/ },
  ];
  for (const m of MATCHERS) {
    if (m.re.test(url)) return m.platform;
  }
  return null;
}

function extractPixelIdFromUrl(platform, url) {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    switch (platform) {
      case 'ga4': return params.get('tid') || null;
      case 'google_ads': {
        // AW-XXXXXXXXX from the URL path or aw_remarketing_only param
        const pathMatch = u.pathname.match(/\/conversion\/(?:AW-)?(\d+)\//);
        return pathMatch ? `AW-${pathMatch[1]}` : null;
      }
      case 'meta': return params.get('id') || null;
      case 'pinterest': return params.get('tid') || null;
      case 'tiktok': return params.get('sdkid') || null;
      case 'snapchat': {
        const id = params.get('id') || params.get('pid');
        if (id) return id;
        const pathMatch = u.pathname.match(/\/v\d+\/([a-f0-9-]+)\/events/);
        return pathMatch ? pathMatch[1] : null;
      }
      case 'linkedin': return params.get('pid') || null;
      default: return null;
    }
  } catch (e) { return null; }
}

function extractEventNameFromUrl(platform, url) {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    switch (platform) {
      case 'ga4': return params.get('en') || null;
      case 'google_ads': {
        // Extract conversion label from URL params
        const label = params.get('label') || params.get('gtm_label');
        return label ? `conversion/${label}` : 'conversion';
      }
      case 'meta': return params.get('ev') || null;
      case 'pinterest': return params.get('event') || null;
      case 'tiktok': return params.get('event') || params.get('ev') || null;
      case 'snapchat': return params.get('ev') || params.get('event') || null;
      case 'linkedin': {
        if (params.get('conversionId')) return 'conversion';
        return 'pageview';
      }
      default: return null;
    }
  } catch (e) { return null; }
}

function extractEventNameFromBody(platform, body) {
  try {
    const json = JSON.parse(body);
    switch (platform) {
      case 'tiktok': {
        // Single event: { event: 'ViewContent', ... }
        const ev = json.event || json.type || null;
        if (ev) return ev;
        // Batch: { batch: [{ event: '...', ... }] }
        if (Array.isArray(json.batch) && json.batch[0]) return json.batch[0].event || json.batch[0].type || null;
        // Data array: { data: [{ event: '...', ... }] }
        if (Array.isArray(json.data) && json.data[0]) return json.data[0].event || json.data[0].type || null;
        // Events array: { events: [{ event: '...', ... }] }
        if (Array.isArray(json.events) && json.events[0]) return json.events[0].event || json.events[0].type || null;
        return null;
      }
      case 'snapchat':
        return json.event_type || json.event_name || json.event || null;
      case 'linkedin':
        return json.eventType || json.event || (json.conversionId ? 'conversion' : null);
      case 'pinterest':
        return json.event || json.event_name || null;
      default:
        return json.event || json.event_name || json.ev || null;
    }
  } catch (e) { return null; }
}

// Map to store request bodies captured by onBeforeRequest (keyed by requestId)
const _requestBodies = new Map();

/**
 * Extract body string from webRequest requestBody object.
 * Handles both raw (JSON/plain text POST) and formData (URL-encoded) formats,
 * and concatenates multiple raw chunks for large payloads.
 */
function extractBodyFromRequestBody(requestBody) {
  if (!requestBody) return null;

  // Try raw body first (JSON, plain text POST) — concatenate all chunks
  if (requestBody.raw?.length) {
    try {
      const chunks = [];
      for (const chunk of requestBody.raw) {
        if (chunk.bytes) chunks.push(new TextDecoder().decode(chunk.bytes));
      }
      if (chunks.length > 0) return chunks.join('');
    } catch (e) {}
  }

  // Fallback: formData (URL-encoded POST)
  if (requestBody.formData) {
    try {
      const params = new URLSearchParams();
      for (const [key, values] of Object.entries(requestBody.formData)) {
        for (const val of values) {
          params.append(key, val);
        }
      }
      return params.toString();
    } catch (e) {}
  }

  return null;
}

if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return;

      const platform = matchPlatformFromUrl(details.url);
      if (!platform) return;

      const body = extractBodyFromRequestBody(details.requestBody);
      if (body) {
        _requestBodies.set(details.requestId, body);
        // Auto-cleanup after 10s to prevent memory leaks
        setTimeout(() => _requestBodies.delete(details.requestId), 10000);
      }
    },
    { urls: webRequestUrls },
    ['requestBody']
  );
}

const _recentWebRequests = new Map();
const WEBREQUEST_DEDUP_WINDOW = 2000;
const _seenWebRequestPixels = new Set(); // Track pixel IDs already forwarded as FRAME_PIXELS

if (chrome.webRequest?.onCompleted) {
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (details.tabId < 0) return;

      const url = details.url;
      const platform = matchPlatformFromUrl(url);
      if (!platform) return;

      const storedBody = _requestBodies.get(details.requestId) || null;
      _requestBodies.delete(details.requestId);

      // Extract event name before dedup so we can include it in the dedup key.
      // This prevents different events sent to the same URL (e.g. TikTok Pageview
      // + ViewContent both POST to analytics.tiktok.com/api/v2/shopify_pixel)
      // from being incorrectly deduplicated.
      let eventName = extractEventNameFromUrl(platform, url);
      if (!eventName && storedBody) {
        eventName = extractEventNameFromBody(platform, storedBody);
      }
      const pixelId = extractPixelIdFromUrl(platform, url);

      // Dedup key includes event name so different events to same URL aren't dropped.
      // If no event name extractable, use requestId to ensure uniqueness (no dedup).
      const urlKey = url.slice(0, 200) + '::' + (eventName || details.requestId);
      const now = Date.now();
      const lastSeen = _recentWebRequests.get(urlKey);
      if (lastSeen && now - lastSeen < WEBREQUEST_DEDUP_WINDOW) return;
      _recentWebRequests.set(urlKey, now);

      if (_recentWebRequests.size > 500) {
        for (const [key, ts] of _recentWebRequests) {
          if (now - ts > 10000) _recentWebRequests.delete(key);
        }
      }

      forwardToExtensionPages({
        type: MSG.NETWORK_REQUEST,
        payload: {
          platform,
          url: url.slice(0, 4000),
          method: details.method || 'GET',
          body: storedBody,
          timestamp: now,
          source: 'webRequest',
          pixelId,
          eventName,
        },
      });

      // Forward newly discovered pixels to sidepanel for PixelStatus
      if (pixelId) {
        const pixelKey = `${platform}:${pixelId}`;
        if (!_seenWebRequestPixels.has(pixelKey)) {
          _seenWebRequestPixels.add(pixelKey);
          forwardToExtensionPages({
            type: MSG.FRAME_PIXELS,
            payload: {
              pixels: [{ platform, id: pixelId, active: true, source: 'webRequest' }],
            },
          });
        }
      }
    },
    { urls: webRequestUrls },
    []
  );
}

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

    case MSG.REOPEN_CMP: {
      const { cmp } = msg.payload || {};
      getActiveTabId().then(async (activeTabId) => {
        if (!activeTabId || !cmp) {
          sendResponse({ success: false });
          return;
        }
        try {
          await chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            world: 'MAIN',
            func: (cmpName) => {
              try {
                switch (cmpName) {
                  case 'onetrust': OneTrust.ToggleInfoDisplay(); break;
                  case 'cookiebot': typeof CookieConsent !== 'undefined' ? CookieConsent.renew() : Cookiebot.renew(); break;
                  case 'cookieyes': typeof CookieYes !== 'undefined' ? CookieYes.openCookieBanner() : document.querySelector('.cky-btn-revisit')?.click(); break;
                  case 'didomi': Didomi.preferences.show(); break;
                  case 'axeptio': document.querySelector('[data-axeptio-btn]')?.click() || (typeof openAxeptioCookies === 'function' && openAxeptioCookies()); break;
                  case 'tarteaucitron': tarteaucitron.userInterface.openPanel(); break;
                  case 'complianz': typeof cmplz_open_settings === 'function' ? cmplz_open_settings() : document.querySelector('.cmplz-manage-settings,.cmplz-manage-consent')?.click(); break;
                  case 'acceptio': typeof Acceptio !== 'undefined' && Acceptio.show(); break;
                  case 'iubenda': _iub.cs.api.openPreferences(); break;
                  case 'usercentrics': UC_UI.showSecondLayer(); break;
                  case 'quantcast': __tcfapi('displayConsentUi', 2, function(){}); break;
                }
              } catch (e) { console.debug('[Traacky] CMP reopen failed:', e); }
            },
            args: [cmp],
          });
          sendResponse({ success: true });
        } catch (err) {
          console.debug('[Traacky] CMP reopen executeScript error:', err);
          sendResponse({ success: false, error: err.message });
        }
      });
      return true; // async sendResponse
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
        console.log('[Traacky] GET_PLAN responding with live plan:', plan, 'user:', JSON.stringify(user));
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
        console.error('[Traacky] GET_PLAN error, falling back to cache:', err);
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
        console.log('[Traacky] REFRESH_PLAN responded with:', plan);
        sendResponse({ plan: plan, email: planManager.user?.email || null });
      }).catch((err) => {
        console.error('[Traacky] REFRESH_PLAN error:', err);
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
          console.debug('[Traacky] LIST_FRAMES error:', err);
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
                { platform: 'ga4',       re: /\/g\/collect\?.*tid=G-/ },
                { platform: 'google_ads', re: /googleads\.g\.doubleclick\.net\/pagead\/(?:conversion|viewthroughconversion)|googleadservices\.com\/pagead\/conversion/ },
                { platform: 'meta',      re: /facebook\.com\/tr[\/?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/pixel|graph\.facebook\.com/ },
                { platform: 'tiktok',    re: /analytics\.tiktok\.com\/(?:api|i18n\/pixel)|mon\.tiktok\.com|business-api\.tiktok\.com/ },
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
                      else if (typeof Blob !== 'undefined' && init.body instanceof Blob && init.body.size < 16000) {
                        init.body.text().then(function (text) {
                          _tpPostNetworkHit(platform, url, method, text);
                        }).catch(function () {});
                        body = '__blob_pending__';
                      }
                    }
                    if (body !== '__blob_pending__') _tpPostNetworkHit(platform, url, method, body);
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

              // Hook Image.src for pixel-based tracking (Meta, LinkedIn, Pinterest, etc.)
              try {
                var _origImgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
                if (_origImgSrcDesc && _origImgSrcDesc.set) {
                  Object.defineProperty(HTMLImageElement.prototype, 'src', {
                    set: function (val) {
                      if (val && typeof val === 'string') {
                        var p = _tpMatchUrl(val);
                        if (p) _tpPostNetworkHit(p, val, 'IMG', null);
                      }
                      return _origImgSrcDesc.set.call(this, val);
                    },
                    get: _origImgSrcDesc.get,
                    enumerable: true,
                    configurable: true,
                  });
                }
              } catch (e) {}

              // Also hook setAttribute('src', ...) on images
              try {
                var _origImgSetAttr = HTMLImageElement.prototype.setAttribute;
                HTMLImageElement.prototype.setAttribute = function (name, value) {
                  if (name === 'src' && value && typeof value === 'string') {
                    var p = _tpMatchUrl(value);
                    if (p) _tpPostNetworkHit(p, value, 'IMG', null);
                  }
                  return _origImgSetAttr.call(this, name, value);
                };
              } catch (e) {}

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
                      if (/^AW-/.test(configId) && !pixels.some(function (p) { return p.platform === 'google_ads' && p.id === configId; })) {
                        pixels.push({ platform: 'google_ads', id: configId, active: true });
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
                    var awMatch = src.match(/[?&]id=(AW-[A-Z0-9]+)/);
                    if (awMatch && !pixels.some(function (p) { return p.platform === 'google_ads' && p.id === awMatch[1]; })) {
                      pixels.push({ platform: 'google_ads', id: awMatch[1], active: true });
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
          console.debug('[Traacky] START_FRAME_MONITORING error:', err);
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
          console.debug('[Traacky] EXECUTE_IN_FRAME error:', err);
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
  if (changeInfo.url) {
    const oldUrl = _tabUrls[tabId];
    _tabUrls[tabId] = changeInfo.url;

    // Only clear streams for true navigations (path change).
    // Query-string-only changes (e.g. Shopify ?variant=...) should NOT
    // wipe previously captured events like product_view.
    const queryOnly = oldUrl && isSameBasePath(oldUrl, changeInfo.url);
    if (!queryOnly) {
      getActiveTabId().then((activeTabId) => {
        if (activeTabId === tabId) {
          forwardToExtensionPages({ type: 'TRACKPULSE_PAGE_NAVIGATED' });
        }
      });
    }
  }

  // Same-URL reload (no changeInfo.url) → clear stale streams
  if (changeInfo.status === 'loading' && !changeInfo.url) {
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
    // Reset webRequest pixel tracking so pixels are re-detected on new pages
    _seenWebRequestPixels.clear();
  }
});

// Clean up when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabContexts[tabId];
  delete _tabUrls[tabId];
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
