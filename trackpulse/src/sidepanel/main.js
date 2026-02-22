/**
 * TrackPulse Side Panel — Main entry point (V2).
 * Manages state, listens for messages from the background/content script,
 * orchestrates rendering of all components, and manages plan/licensing state.
 */

import { MSG } from '../shared/messaging.js';
import { getPlanCapabilities } from '../licensing/feature-gates.js';
import { initAnalytics, trackEvent, identifyUser } from '../shared/analytics.js';
import { renderHeader } from './components/Header.js';
import { renderTabNav } from './components/TabNav.js';

// ---- Theme Initialization ----
// Apply saved theme before first paint to avoid flash
(async function initTheme() {
  try {
    const data = await chrome.storage.local.get('tp_theme');
    if ((data.tp_theme || 'light') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();

// ---- Analytics Initialization ----
initAnalytics();
trackEvent('sidepanel_opened');

import { renderEventGenerator } from './components/EventGenerator.js';
import { renderAuditPanel } from './components/AuditPanel.js';
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
};

// Funnel session singleton
const funnelSession = new FunnelSession();

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
    const filename = await generateAuditReport(state, {
      whiteLabelLogo: state.capabilities.canWhiteLabel ? null : null, // Agency can set logo
    });
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
    console.log('[TrackPulse Sidepanel] Initial plan:', state.plan, 'debug:', JSON.stringify(state.planDebug));

    // If we already have detection data, render with initial plan
    if (!state.loading) {
      render();
    }

    // Then: force a fresh refresh from ExtensionPay to pick up any recent payments
    try {
      const refreshed = await chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' });
      if (refreshed?.plan) {
        console.log('[TrackPulse Sidepanel] Plan after refresh:', refreshed.plan);
        state.plan = refreshed.plan;
        state.userEmail = refreshed.email || state.userEmail;
        state.capabilities = resolvePlanCapabilities(state.plan);
        render();
      }
    } catch (refreshErr) {
      console.warn('[TrackPulse Sidepanel] Refresh failed (non-blocking):', refreshErr);
    }
  } catch (err) {
    console.error('[TrackPulse Sidepanel] initPlan error:', err);
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
      console.log('[TrackPulse Sidepanel] Plan updated via refresh:', oldPlan, '->', refreshed.plan);
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
      trackEvent('page_detected', {
        cms: state.cms?.cms || 'unknown',
        pageType: state.pageType?.pageType || 'unknown',
        eventsCount: Object.values(state.generatedEvents).flat().length,
      });

      // Add initial dataLayer entries from the snapshot
      if (payload.audit?.existingEvents) {
        // Don't replace stream — these are the snapshot events
      }

      // If funnel recording is active, add this step
      if (funnelSession.isRecording) {
        funnelSession.addStep(payload);
      }

      render();

      // Detect custom pixel frames for Quick Push targeting
      // Always detect on Shopify; also on checkout/thank_you pages (Shopify checkout may be on checkout.shopify.com)
      const isShopify = state.cms?.cms === 'shopify';
      const isCheckout = state.pageType?.pageType === 'checkout' || state.pageType?.pageType === 'thank_you';
      if (isShopify || isCheckout) {
        actions.detectCustomPixelFrames().then(() => {
          if (state.customPixelFrames.length > 0 && state.activeTab === 'events') {
            renderActiveTab();
          }
        });
      }
      break;
    }

    case MSG.DATALAYER_PUSH: {
      const payload = msg.payload;
      const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(payload.timestamp || Date.now()),
        data: payload.data,
      };
      state.dataLayerStream.unshift(entry);

      // Keep max 200 entries
      if (state.dataLayerStream.length > 200) {
        state.dataLayerStream = state.dataLayerStream.slice(0, 200);
      }

      // If we're on the datalayer tab, append without full re-render
      if (state.activeTab === 'datalayer') {
        appendDataLayerEntry(tabContentEl, entry, state.dataLayerStream.length);
      }
      break;
    }

    case MSG.NETWORK_REQUEST: {
      const netPayload = msg.payload;
      const parsed = parseNetworkRequest(netPayload.platform, netPayload.url, netPayload.body);
      const netEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(netPayload.timestamp || Date.now()),
        platform: netPayload.platform,
        url: netPayload.url,
        method: netPayload.method,
        eventName: parsed.eventName,
        params: parsed.params,
        items: parsed.items,
        measurementId: parsed.measurementId || null,
        pixelId: parsed.pixelId || null,
      };
      state.networkRequests.unshift(netEntry);

      // Keep max 500 entries
      if (state.networkRequests.length > 500) {
        state.networkRequests = state.networkRequests.slice(0, 500);
      }

      // If on audit tab, re-render to show network status
      if (state.activeTab === 'audit') {
        renderActiveTab();
      }

      // If on datalayer tab, append network entry to live stream
      if (state.activeTab === 'datalayer') {
        appendNetworkEntry(tabContentEl, netEntry, state.networkRequests.length);
      }
      break;
    }

    case 'TRACKPULSE_PLAN_CHANGED': {
      // Real-time plan upgrade detection
      const oldPlan = state.plan;
      state.plan = msg.payload?.plan || state.plan;
      state.capabilities = resolvePlanCapabilities(state.plan);
      state.planLoading = false;

      // If on pricing page and plan upgraded, show success animation
      if (state.activeTab === 'pricing' && state.plan !== 'free' && state.plan !== oldPlan) {
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
  state.activeTab = tab;
  trackEvent('tab_changed', { tab });
  renderTabNav(tabNavEl, state.activeTab, handleTabChange, state.capabilities);
  renderActiveTab();
}

function render() {
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
      renderFunnelMode(tabContentEl, funnelSession, state.capabilities, state.funnelReport);
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
          render();
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
