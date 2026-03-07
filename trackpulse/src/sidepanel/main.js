/**
 * Traacky Side Panel — Main entry point (V2).
 * Manages state, listens for messages from the background/content script,
 * orchestrates rendering of all components, and manages plan/licensing state.
 */

import { MSG } from '../shared/messaging.js';
import { getPlanCapabilities } from '../licensing/feature-gates.js';
import { initAnalytics, trackEvent, identifyUser } from '../shared/analytics.js';
import { renderHeader } from './components/Header.js';
import { renderTabNav } from './components/TabNav.js';

// ---- Popup Mode Detection ----
const IS_POPUP = new URLSearchParams(window.location.search).get('popup') === '1';

if (IS_POPUP) {
  // Fixed dimensions for extension popup dropdown
  document.documentElement.style.width = '400px';
  document.documentElement.style.height = '600px';
  document.body.style.width = '400px';
  document.body.style.height = '600px';
  document.body.style.overflow = 'hidden';

  // Close button bar
  const closeBar = document.createElement('div');
  closeBar.className = 'tp-popup-close-bar';
  closeBar.innerHTML = `<button title="Close" class="tp-popup-close-btn">&times;</button>`;
  document.getElementById('app').prepend(closeBar);
  closeBar.querySelector('.tp-popup-close-btn').addEventListener('click', () => window.close());
}

// ---- Theme Initialization ----
// Apply saved theme before first paint to avoid flash
(async function initTheme() {
  try {
    const data = await chrome.storage.local.get(['tp_theme', 'tp_auto_switch_tab']);
    if ((data.tp_theme || 'light') === 'dark') {
      document.documentElement.classList.add('dark');
    }
    state.autoSwitchTab = !!data.tp_auto_switch_tab;
  } catch (e) {}
})();

// ---- Analytics Initialization ----
initAnalytics();
trackEvent('sidepanel_opened');

import { renderEventGenerator, resetEventGeneratorState } from './components/EventGenerator.js';
import { renderAuditPanel, resetAuditPanelState } from './components/AuditPanel.js';
import { renderDataLayerLive, appendDataLayerEntry, appendNetworkEntry } from './components/DataLayerLive.js';
import { parseNetworkRequest } from '../content/parsers/network-request-parser.js';
import { renderPixelStatus } from './components/PixelStatus.js';
import { renderSettingsPanel } from './components/SettingsPanel.js';
import { renderFunnelMode, FunnelSession } from './components/FunnelMode.js';
import { renderPricingPage } from './components/PricingPage.js';
import { setUpgradeHandler } from './components/Paywall.js';

// ---- Application State ----

const state = {
  // V1 state
  cms: null,
  pageType: null,
  ecommerceData: null,
  generatedEvents: { ga4: [], meta: [], tiktok: [], pinterest: [] },
  audit: { existingEvents: [], diff: [] },
  pixels: [],
  consent: null,
  dataLayerStream: [],
  activeTab: 'events',
  activePlatforms: ['ga4', 'meta', 'tiktok', 'pinterest'],
  loading: true,
  url: '',
  timestamp: null,

  // V2 plan/licensing state
  plan: 'free',
  planLoading: true,
  userEmail: null,
  capabilities: null,
  planDebug: null,

  // V2 pricing/navigation
  previousTab: 'events',

  // V2 funnel mode
  funnelReport: null,

  // V2 Quick Push (synthetic events)
  customPixelFrames: [],    // [{frameId, url, label}] — detected Shopify custom pixel iframes
  quickPushTarget: 'top',   // 'top' or frameId (number)

  // V2 Network request monitoring
  networkRequests: [],      // Captured tracking platform network requests

  // Detected platforms (computed from pixels + network requests)
  detectedPlatforms: new Set(['ga4']),

  // V2 Custom pixel frame monitoring
  monitoredFrames: new Set(),  // frameIds where monitoring has been injected

  // V2 Settings
  autoSwitchTab: false,  // Auto-reload detection on tab switch
};

/** Recompute detectedPlatforms from pixels + networkRequests and sync activePlatforms */
function recomputeDetectedPlatforms() {
  const detected = new Set();
  detected.add('ga4'); // GA4 always shown (dataLayer is always relevant)
  for (const p of state.pixels) detected.add(p.platform);
  for (const r of state.networkRequests) detected.add(r.platform);
  state.detectedPlatforms = detected;
  // Sync activePlatforms: keep only detected ones, auto-add newly detected
  state.activePlatforms = [...detected].filter(p => detected.has(p));
}

// Funnel session singleton
const funnelSession = new FunnelSession();

// Debounce timer for audit tab re-renders on dataLayer pushes
let auditRerenderTimer = null;

// ---- DOM References ----

const loadingEl = document.getElementById('loading');
const mainContentEl = document.getElementById('main-content');
const headerEl = document.getElementById('header');
const tabNavEl = document.getElementById('tab-nav');
const tabContentEl = document.getElementById('tab-content');

// ---- Plan Capabilities Resolver ----

function resolvePlanCapabilities(plan) {
  return getPlanCapabilities(plan);
}

// ---- Actions ----

const actions = {
  togglePlatform(platform) {
    const idx = state.activePlatforms.indexOf(platform);
    if (idx >= 0) {
      state.activePlatforms.splice(idx, 1);
    } else {
      state.activePlatforms.push(platform);
    }
    renderActiveTab();
  },

  navigateToPricing() {
    state.previousTab = state.activeTab;
    state.activeTab = 'pricing';
    render();
  },

  async copyCode(code) {
    // Check plan access
    if (!state.capabilities?.canCopyEvents) {
      actions.navigateToPricing();
      return;
    }

    trackEvent('code_copied');
    try {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = code;
      const decoded = textarea.value;
      await navigator.clipboard.writeText(decoded);
      showToast('Copied to clipboard', 'success');
    } catch (e) {
      try {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = code;
        textarea.value = textarea.value;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copied to clipboard', 'success');
      } catch (e2) {
        showToast('Failed to copy', 'error');
      }
    }
  },

  pushToDataLayer(code) {
    // Check plan access
    if (!state.capabilities?.canPushEvents) {
      actions.navigateToPricing();
      return;
    }

    trackEvent('code_pushed_to_datalayer');
    const textarea = document.createElement('textarea');
    textarea.innerHTML = code;
    const decoded = textarea.value;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MSG.EXECUTE_CODE,
          code: decoded,
        });
        showToast('Pushed to dataLayer', 'success');
      } else {
        showToast('No active tab found', 'error');
      }
    });
  },

  clearDataLayerStream() {
    state.dataLayerStream = [];
    state.networkRequests = [];
    renderActiveTab();
  },

  refresh() {
    state.loading = true;
    showLoading();
    chrome.runtime.sendMessage({ type: MSG.REQUEST_REDETECT });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: MSG.REQUEST_REDETECT },
          () => {
            if (chrome.runtime.lastError) {}
          }
        );
      }
    });
  },

  handleUpgrade() {
    actions.navigateToPricing();
  },

  async exportPDF() {
    if (!state.capabilities?.canExportPDF) {
      actions.navigateToPricing();
      return;
    }

    // Track usage
    const { trackPDFExport } = await import('../licensing/usage-tracker.js');
    const result = await trackPDFExport(state.capabilities.pdfLimit);
    if (!result.allowed) {
      showToast(`PDF limit reached (${result.count}/${result.limit} this month)`, 'error');
      return;
    }

    trackEvent('pdf_exported');
    // Dynamic import for PDF generation
    const { generateAuditReport } = await import('../export/pdf-report.js');
    const filename = await generateAuditReport(
      { ...state, networkRequests: state.networkRequests },
      { whiteLabelLogo: state.capabilities.canWhiteLabel ? null : null }
    );
    showToast(`Report saved: ${filename}`, 'success');
  },

  pushSyntheticEvent(code, target) {
    if (!state.capabilities?.canPushEvents) {
      actions.navigateToPricing();
      return;
    }
    trackEvent('synthetic_event_pushed', { target: target === 'top' ? 'top' : 'custom_pixel' });

    if (target && target !== 'top') {
      // Push to a specific Shopify custom pixel sandbox frame
      chrome.runtime.sendMessage(
        {
          type: MSG.EXECUTE_IN_FRAME,
          payload: { code, frameId: target },
        },
        (response) => {
          if (response?.success) {
            showToast('Pushed to custom pixel', 'success');
          } else {
            showToast(`Push failed: ${response?.error || 'unknown'}`, 'error');
          }
        }
      );
    } else {
      // Push to top-level dataLayer via existing content script bridge
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs?.[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: MSG.EXECUTE_CODE,
            code,
          });
          showToast('Pushed to dataLayer', 'success');
        } else {
          showToast('No active tab found', 'error');
        }
      });
    }
  },

  async detectCustomPixelFrames() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG.LIST_FRAMES });
      state.customPixelFrames = response?.frames || [];

      if (state.customPixelFrames.length > 0) {
        // Auto-select first custom pixel frame on Shopify (it's where GTM/GA4 runs)
        if (state.cms?.cms === 'shopify' && state.quickPushTarget === 'top') {
          state.quickPushTarget = state.customPixelFrames[0].frameId;
        }
      }

      // If previously selected target no longer exists, reset
      if (state.quickPushTarget !== 'top') {
        const exists = state.customPixelFrames.some(
          (f) => f.frameId === state.quickPushTarget
        );
        if (!exists) state.quickPushTarget = 'top';
      }

      // Auto-start continuous monitoring in ALL custom pixel frames
      // (not just those with dataLayer — Meta/TikTok fire network requests without dataLayer)
      for (const frame of state.customPixelFrames) {
        if (!state.monitoredFrames.has(frame.frameId)) {
          state.monitoredFrames.add(frame.frameId);
          chrome.runtime.sendMessage({
            type: MSG.START_FRAME_MONITORING,
            payload: { frameId: frame.frameId },
          }).catch(() => {});
        }
      }
    } catch (e) {
      state.customPixelFrames = [];
    }
  },

  setQuickPushTarget(target) {
    state.quickPushTarget = target === 'top' ? 'top' : parseInt(target);
    renderActiveTab();
  },

  toggleTheme(theme) {
    trackEvent('theme_toggled', { theme });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    chrome.storage.local.set({ tp_theme: theme });
    renderActiveTab();
  },

  toggleAutoSwitchTab(enabled) {
    state.autoSwitchTab = enabled;
    chrome.storage.local.set({ tp_auto_switch_tab: enabled });
    trackEvent('auto_switch_tab_toggled', { enabled });
  },
};

// ---- Wire Paywall upgrade handler to pricing page ----
setUpgradeHandler(() => actions.navigateToPricing());

// ---- Plan Initialization ----

async function initPlan() {
  try {
    // First: get the current plan (waits for planManager init in service worker)
    const response = await chrome.runtime.sendMessage({ type: 'TRACKPULSE_GET_PLAN' });
    state.plan = response?.plan || 'free';
    state.userEmail = response?.email || null;
    state.planDebug = response?.debug || null;
    state.planLoading = false;
    state.capabilities = resolvePlanCapabilities(state.plan);
    identifyUser(state.plan, state.userEmail);
    trackEvent('plan_loaded', { plan: state.plan });
    console.log('[Traacky Sidepanel] Initial plan:', state.plan, 'debug:', JSON.stringify(state.planDebug));

    // If we already have detection data, render with initial plan
    if (!state.loading) {
      render();
    }

    // Then: force a fresh refresh from ExtensionPay to pick up any recent payments
    try {
      const refreshed = await chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' });
      if (refreshed?.plan) {
        console.log('[Traacky Sidepanel] Plan after refresh:', refreshed.plan);
        state.plan = refreshed.plan;
        state.userEmail = refreshed.email || state.userEmail;
        state.capabilities = resolvePlanCapabilities(state.plan);
        render();
      }
    } catch (refreshErr) {
      console.warn('[Traacky Sidepanel] Refresh failed (non-blocking):', refreshErr);
    }
  } catch (err) {
    console.error('[Traacky Sidepanel] initPlan error:', err);
    // Fallback: check chrome.storage directly
    const data = await chrome.storage.local.get(['tp_plan']);
    state.plan = data.tp_plan || 'free';
    state.planLoading = false;
    state.capabilities = resolvePlanCapabilities(state.plan);

    // If we already have detection data, render
    if (!state.loading) {
      render();
    }
  }
}

// Initialize plan on load
initPlan();

// Refresh plan when sidepanel regains focus (e.g. user returns from Stripe checkout)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshPlanQuietly();
  }
});

// Periodic plan recheck every 30s while sidepanel is open
setInterval(() => {
  if (document.visibilityState === 'visible') {
    refreshPlanQuietly();
  }
}, 30000);

async function refreshPlanQuietly() {
  try {
    const refreshed = await chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' });
    if (refreshed?.plan && refreshed.plan !== state.plan) {
      const oldPlan = state.plan;
      console.log('[Traacky Sidepanel] Plan updated via refresh:', oldPlan, '->', refreshed.plan);
      state.plan = refreshed.plan;
      state.userEmail = refreshed.email || state.userEmail;
      state.capabilities = resolvePlanCapabilities(state.plan);
      identifyUser(state.plan, state.userEmail);
      trackEvent('plan_upgraded', { from: oldPlan, to: state.plan });

      // If on pricing page and plan upgraded, show success animation + redirect
      if (state.activeTab === 'pricing' && state.plan !== 'free' && state.plan !== oldPlan) {
        showUpgradeSuccess(state.plan);
        setTimeout(() => {
          state.activeTab = 'events';
          render();
        }, 1500);
      } else {
        render();
      }
    }
  } catch (e) {
    // Silent fail — non-critical background refresh
  }
}

// Load funnel session
funnelSession.loadSession();

// ---- Message Listeners ----

chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case MSG.DETECTION_RESULT: {
      const payload = msg.payload;
      state.cms = payload.cms;
      state.pageType = payload.pageType;
      state.ecommerceData = payload.ecommerceData;
      state.monitoredFrames = new Set(); // Reset for new page
      state.generatedEvents = payload.generatedEvents || {
        ga4: [],
        meta: [],
        tiktok: [],
        pinterest: [],
      };
      state.audit = payload.audit || { existingEvents: [], diff: [] };
      state.pixels = payload.pixels || [];
      state.consent = payload.consent;
      state.url = payload.url || '';
      state.timestamp = payload.timestamp;
      state.loading = false;

      recomputeDetectedPlatforms();

      trackEvent('page_detected', {
        cms: state.cms?.cms || 'unknown',
        pageType: state.pageType?.pageType || 'unknown',
        eventsCount: Object.values(state.generatedEvents).flat().length,
      });

      // If funnel recording is active, add this step (with network snapshot)
      if (funnelSession.isRecording) {
        funnelSession.addStep({ ...payload, networkRequests: [...state.networkRequests] });
      }

      render({ preserveContent: true });

      // Detect custom pixel frames for Quick Push targeting + funnel network monitoring
      // Always detect on Shopify; also on checkout/thank_you pages; also during funnel recording
      const isShopify = state.cms?.cms === 'shopify';
      const isCheckout = state.pageType?.pageType === 'checkout' || state.pageType?.pageType === 'thank_you';
      if (isShopify || isCheckout || funnelSession.isRecording) {
        actions.detectCustomPixelFrames().then(() => {
          if (state.customPixelFrames.length > 0) {
            if (state.activeTab === 'events' || state.activeTab === 'funnel') {
              renderActiveTab();
            }
          }
        });
      }
      break;
    }

    case MSG.DATALAYER_PUSH: {
      const payload = msg.payload;

      // --- Deduplication: skip if same event name was seen within 150ms ---
      const _dlData = payload.data;
      let _dedupName = null;
      if (_dlData && typeof _dlData === 'object') {
        if (_dlData.event) {
          _dedupName = _dlData.event;
        } else if (Array.isArray(_dlData) && _dlData[0]?.event) {
          _dedupName = _dlData[0].event;
        } else if (_dlData['0'] === 'event' && _dlData['1']) {
          _dedupName = _dlData['1'];
        } else if (Array.isArray(_dlData) && _dlData[0] && _dlData[0]['0'] === 'event' && _dlData[0]['1']) {
          _dedupName = _dlData[0]['1'];
        }
      }
      if (!state._dlDedupMap) state._dlDedupMap = new Map();
      if (_dedupName) {
        const now = Date.now();
        const lastSeen = state._dlDedupMap.get(_dedupName);
        if (lastSeen && now - lastSeen < 150) {
          break; // skip duplicate
        }
        state._dlDedupMap.set(_dedupName, now);
      }

      const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(payload.timestamp || Date.now()),
        data: payload.data,
        source: payload.source || 'top',
      };
      state.dataLayerStream.unshift(entry);

      // Keep max 200 entries
      if (state.dataLayerStream.length > 200) {
        state.dataLayerStream = state.dataLayerStream.slice(0, 200);
      }

      // If funnel recording is active, check for funnel events in the push
      if (funnelSession.isRecording) {
        const dlData = payload.data;
        // Extract event name from dataLayer push (can be {event: 'xxx'} or array-wrapped)
        let eventName = null;
        if (dlData && typeof dlData === 'object') {
          eventName = dlData.event || (Array.isArray(dlData) && dlData[0]?.event);
        }
        if (eventName) {
          const isNew = funnelSession.recordEvent(eventName, 'datalayer_push', 'ga4');
          if (isNew && state.activeTab === 'funnel') {
            renderActiveTab();
          }
        }
      }

      // If we're on the datalayer tab, append without full re-render
      if (state.activeTab === 'datalayer') {
        appendDataLayerEntry(tabContentEl, entry, state.dataLayerStream.length);
      }

      // If on audit tab, debounce re-render to detect events from live stream
      if (state.activeTab === 'audit') {
        clearTimeout(auditRerenderTimer);
        auditRerenderTimer = setTimeout(() => renderActiveTab(), 300);
      }
      break;
    }

    case MSG.NETWORK_REQUEST: {
      const netPayload = msg.payload;

      // Dedup: skip if same URL prefix was recently captured (JS hooks + webRequest overlap)
      if (!state._netDedupMap) state._netDedupMap = new Map();
      const netUrlKey = (netPayload.url || '').slice(0, 200);
      const netNow = Date.now();
      const netLastSeen = state._netDedupMap.get(netUrlKey);
      if (netLastSeen && netNow - netLastSeen < 2000) break;
      state._netDedupMap.set(netUrlKey, netNow);
      if (state._netDedupMap.size > 300) {
        for (const [k, t] of state._netDedupMap) {
          if (netNow - t > 10000) state._netDedupMap.delete(k);
        }
      }

      const parsed = parseNetworkRequest(netPayload.platform, netPayload.url, netPayload.body);
      const netEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(netPayload.timestamp || Date.now()),
        platform: netPayload.platform,
        url: netPayload.url,
        method: netPayload.method,
        eventName: parsed.eventName || netPayload.eventName || null,
        params: parsed.params,
        items: parsed.items,
        measurementId: parsed.measurementId || null,
        pixelId: parsed.pixelId || netPayload.pixelId || null,
        source: netPayload.source || 'top',
      };
      state.networkRequests.unshift(netEntry);

      // Update detected platforms if new platform seen
      if (!state.detectedPlatforms.has(netEntry.platform)) {
        recomputeDetectedPlatforms();
      }

      // Keep max 500 entries
      if (state.networkRequests.length > 500) {
        state.networkRequests = state.networkRequests.slice(0, 500);
      }

      // If funnel recording is active, check for funnel events in network request
      if (funnelSession.isRecording && netEntry.eventName) {
        const isNew = funnelSession.recordEvent(netEntry.eventName, 'network', netEntry.platform);
        if (isNew && state.activeTab === 'funnel') {
          renderActiveTab();
        }
      }

      // If on audit tab, debounce re-render (network requests arrive in bursts)
      if (state.activeTab === 'audit') {
        clearTimeout(auditRerenderTimer);
        auditRerenderTimer = setTimeout(() => renderActiveTab(), 300);
      }

      // If on pixels tab, debounce re-render
      if (state.activeTab === 'pixels') {
        clearTimeout(auditRerenderTimer);
        auditRerenderTimer = setTimeout(() => renderActiveTab(), 300);
      }

      // If on datalayer tab, append network entry to live stream
      if (state.activeTab === 'datalayer') {
        appendNetworkEntry(tabContentEl, netEntry, state.networkRequests.length);
      }
      break;
    }

    case 'TRACKPULSE_PAGE_NAVIGATED': {
      // Clear live streams on navigation (URL change or tab switch).
      // Fired by the service worker BEFORE new page scripts run,
      // so new dataLayer events won't be wiped.
      clearTimeout(auditRerenderTimer);
      state.dataLayerStream = [];
      state.networkRequests = [];
      // Reset accordion/expand state for new page
      resetEventGeneratorState();
      resetAuditPanelState();
      if (state.activeTab === 'datalayer') renderActiveTab();
      break;
    }

    case MSG.FRAME_PIXELS: {
      const framePixels = msg.payload?.pixels || [];
      for (const fp of framePixels) {
        // Dedup by platform: merge into existing entry instead of duplicating
        const existing = state.pixels.find((p) => p.platform === fp.platform);
        if (existing) {
          // Fill in missing ID from network/custom pixel source
          if (!existing.id && fp.id) existing.id = fp.id;
        } else {
          state.pixels.push({ ...fp, source: fp.source || 'custom_pixel' });
        }
      }
      if (framePixels.length > 0) recomputeDetectedPlatforms();
      if (state.activeTab === 'pixels') renderActiveTab();
      break;
    }

    case 'TRACKPULSE_PLAN_CHANGED': {
      // Real-time plan upgrade detection
      const newPlan = msg.payload?.plan || state.plan;
      if (newPlan === state.plan) break; // No change, skip render

      const oldPlan = state.plan;
      state.plan = newPlan;
      state.capabilities = resolvePlanCapabilities(state.plan);
      state.planLoading = false;

      identifyUser(state.plan, state.userEmail);
      trackEvent('subscription_changed', { from: oldPlan, to: state.plan });

      // If on pricing page and plan upgraded, show success animation
      if (state.activeTab === 'pricing' && state.plan !== 'free') {
        showUpgradeSuccess(state.plan);
        setTimeout(() => {
          state.activeTab = 'events';
          render();
        }, 1500);
      } else {
        render(); // Re-render immediately to unlock features
      }
      break;
    }
  }
});

// ---- Rendering ----

function handleTabChange(tab) {
  clearTimeout(auditRerenderTimer);
  state.activeTab = tab;
  trackEvent('tab_changed', { tab });
  // Recompute detected platforms when switching to audit or pixels
  // (picks up platforms from network requests that arrived while on another tab)
  if (tab === 'audit' || tab === 'pixels') {
    recomputeDetectedPlatforms();
  }
  renderTabNav(tabNavEl, state.activeTab, handleTabChange, state.capabilities);
  renderActiveTab();
}

function render(options = {}) {
  if (state.loading) {
    showLoading();
    return;
  }

  // Ensure capabilities are resolved
  if (!state.capabilities) {
    state.capabilities = resolvePlanCapabilities(state.plan);
  }

  hideLoading();

  // Pricing page takes over the entire content area
  if (state.activeTab === 'pricing') {
    headerEl.innerHTML = '';
    tabNavEl.innerHTML = '';
    renderPricingPage(tabContentEl, state, () => {
      state.activeTab = state.previousTab || 'events';
      render();
    });
    return;
  }

  renderHeader(headerEl, state, actions.refresh, actions.handleUpgrade);
  renderTabNav(tabNavEl, state.activeTab, handleTabChange, state.capabilities);

  // Skip re-rendering tab content when detection fires but current tab is already mounted.
  // Only update the header (for URL/CMS badge changes).
  if (options.preserveContent && state.activeTab === 'datalayer'
      && tabContentEl.querySelector('#dl-entries')) {
    return;
  }

  renderActiveTab();
}

function renderActiveTab() {
  switch (state.activeTab) {
    case 'events':
      renderEventGenerator(tabContentEl, state, actions);
      break;
    case 'audit':
      renderAuditPanel(tabContentEl, state, actions);
      break;
    case 'datalayer':
      renderDataLayerLive(tabContentEl, state, actions);
      break;
    case 'pixels':
      renderPixelStatus(tabContentEl, state);
      break;
    case 'funnel':
      renderFunnelMode(tabContentEl, funnelSession, state.capabilities, state.funnelReport, state);
      break;
    case 'settings':
      renderSettingsPanel(tabContentEl, state, actions);
      break;
  }
}

function showLoading() {
  loadingEl.classList.remove('hidden');
  mainContentEl.classList.add('hidden');
}

function hideLoading() {
  loadingEl.classList.add('hidden');
  mainContentEl.classList.remove('hidden');
}

// ---- Upgrade Success Animation ----

function showUpgradeSuccess(plan) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(108, 92, 231, 0.15);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  `;
  overlay.innerHTML = `
    <div style="text-align: center; animation: slide-in 0.3s ease;">
      <div style="font-size: 48px; margin-bottom: 12px;">&#127881;</div>
      <div style="font-size: 18px; font-weight: 700; color: var(--tp-text);">
        Welcome to ${plan.charAt(0).toUpperCase() + plan.slice(1)}!
      </div>
      <div style="font-size: 13px; color: var(--tp-text-secondary); margin-top: 8px;">
        All features unlocked
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1500);
}

// ---- Toast Notifications ----

function showToast(message, type = 'success') {
  document.querySelectorAll('.tp-toast').forEach((t) => t.remove());

  const toast = document.createElement('div');
  toast.className = `tp-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// ---- Initialization ----

// Request current tab's data on panel open
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs?.[0]?.id) {
    chrome.runtime.sendMessage(
      { type: 'TRACKPULSE_GET_TAB_DATA' },
      (response) => {
        if (response) {
          state.cms = response.cms;
          state.pageType = response.pageType;
          state.ecommerceData = response.ecommerceData;
          state.generatedEvents = response.generatedEvents || {
            ga4: [],
            meta: [],
            tiktok: [],
            pinterest: [],
          };
          state.audit = response.audit || { existingEvents: [], diff: [] };
          state.pixels = response.pixels || [];
          state.consent = response.consent;
          state.url = response.url || '';
          state.loading = false;
          recomputeDetectedPlatforms();
          render({ preserveContent: true });
        } else {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: MSG.REQUEST_REDETECT },
            () => {
              if (chrome.runtime.lastError) {
                state.loading = true;
                render();
              }
            }
          );
        }
      }
    );
  }
});

// Set a timeout to stop showing loading if nothing comes back
setTimeout(() => {
  if (state.loading) {
    state.loading = false;
    state.cms = { cms: 'unknown', confidence: 0, signals: [], version: null };
    state.pageType = { pageType: 'unknown', confidence: 0, method: 'timeout' };
    render();
  }
}, 8000);
