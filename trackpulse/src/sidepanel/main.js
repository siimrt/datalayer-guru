/**
 * TrackPulse Side Panel — Main entry point (V2).
 * Manages state, listens for messages from the background/content script,
 * orchestrates rendering of all components, and manages plan/licensing state.
 */

import { MSG } from '../shared/messaging.js';
import { getPlanCapabilities } from '../licensing/feature-gates.js';
import { renderHeader } from './components/Header.js';
import { renderTabNav } from './components/TabNav.js';
import { renderEventGenerator } from './components/EventGenerator.js';
import { renderAuditPanel } from './components/AuditPanel.js';
import { renderDataLayerLive, appendDataLayerEntry } from './components/DataLayerLive.js';
import { renderPixelStatus } from './components/PixelStatus.js';
import { renderSettingsPanel } from './components/SettingsPanel.js';
import { renderFunnelMode, FunnelSession } from './components/FunnelMode.js';

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

  // V2 funnel mode
  funnelReport: null,
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

  async copyCode(code) {
    // Check plan access
    if (!state.capabilities?.canCopyEvents) {
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
      return;
    }

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
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
      return;
    }

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
    chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
  },

  async exportPDF() {
    if (!state.capabilities?.canExportPDF) {
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
      return;
    }

    // Track usage
    const { trackPDFExport } = await import('../licensing/usage-tracker.js');
    const result = await trackPDFExport(state.capabilities.pdfLimit);
    if (!result.allowed) {
      showToast(`PDF limit reached (${result.count}/${result.limit} this month)`, 'error');
      return;
    }

    // Dynamic import for PDF generation
    const { generateAuditReport } = await import('../export/pdf-report.js');
    const filename = await generateAuditReport(state, {
      whiteLabelLogo: state.capabilities.canWhiteLabel ? null : null, // Agency can set logo
    });
    showToast(`Report saved: ${filename}`, 'success');
  },
};

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
    console.log('[TrackPulse Sidepanel] Initial plan:', state.plan, 'debug:', JSON.stringify(state.planDebug));

    // If we already have detection data, render with initial plan
    if (!state.loading) {
      render();
    }

    // Then: force a fresh refresh from ExtensionPay to pick up any recent payments
    try {
      const refreshed = await chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' });
      if (refreshed?.plan && refreshed.plan !== state.plan) {
        console.log('[TrackPulse Sidepanel] Plan updated after refresh:', refreshed.plan);
        state.plan = refreshed.plan;
        state.userEmail = refreshed.email || state.userEmail;
        state.capabilities = resolvePlanCapabilities(state.plan);
        render(); // Re-render with updated plan
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

      // Add initial dataLayer entries from the snapshot
      if (payload.audit?.existingEvents) {
        // Don't replace stream — these are the snapshot events
      }

      // If funnel recording is active, add this step
      if (funnelSession.isRecording) {
        funnelSession.addStep(payload);
      }

      render();
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

    case 'TRACKPULSE_PLAN_CHANGED': {
      // Real-time plan upgrade detection
      state.plan = msg.payload?.plan || state.plan;
      state.capabilities = resolvePlanCapabilities(state.plan);
      state.planLoading = false;
      render(); // Re-render immediately to unlock features
      break;
    }
  }
});

// ---- Rendering ----

function handleTabChange(tab) {
  state.activeTab = tab;
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
      renderSettingsPanel(tabContentEl, state);
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
