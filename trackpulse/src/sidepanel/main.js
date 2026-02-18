/**
 * TrackPulse Side Panel — Main entry point.
 * Manages state, listens for messages from the background/content script,
 * and orchestrates rendering of all components.
 */

import { MSG } from '../shared/messaging.js';
import { renderHeader } from './components/Header.js';
import { renderTabNav } from './components/TabNav.js';
import { renderEventGenerator } from './components/EventGenerator.js';
import { renderAuditPanel } from './components/AuditPanel.js';
import { renderDataLayerLive, appendDataLayerEntry } from './components/DataLayerLive.js';
import { renderPixelStatus } from './components/PixelStatus.js';

// ---- Application State ----

const state = {
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
};

// ---- DOM References ----

const loadingEl = document.getElementById('loading');
const mainContentEl = document.getElementById('main-content');
const headerEl = document.getElementById('header');
const tabNavEl = document.getElementById('tab-nav');
const tabContentEl = document.getElementById('tab-content');

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
    try {
      // Decode HTML entities back to raw code
      const textarea = document.createElement('textarea');
      textarea.innerHTML = code;
      const decoded = textarea.value;
      await navigator.clipboard.writeText(decoded);
      showToast('Copied to clipboard', 'success');
    } catch (e) {
      // Fallback
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
    // Decode HTML entities
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
    // Also try sending directly to active tab
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
};

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
  }
});

// ---- Rendering ----

function render() {
  if (state.loading) {
    showLoading();
    return;
  }

  hideLoading();
  renderHeader(headerEl, state, actions.refresh);
  renderTabNav(tabNavEl, state.activeTab, (tab) => {
    state.activeTab = tab;
    renderTabNav(tabNavEl, state.activeTab, arguments[0]);
    renderActiveTab();
  });
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
  // Remove existing toasts
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
    // First try to get cached data from background
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
          // No cached data — request detection
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: MSG.REQUEST_REDETECT },
            () => {
              if (chrome.runtime.lastError) {
                // Content script not ready — show loading
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

// Fix the renderTabNav callback issue by caching the callback
function handleTabChange(tab) {
  state.activeTab = tab;
  renderTabNav(tabNavEl, state.activeTab, handleTabChange);
  renderActiveTab();
}

// Override the initial render to use the proper callback
const originalRender = render;
render = function () {
  if (state.loading) {
    showLoading();
    return;
  }

  hideLoading();
  renderHeader(headerEl, state, actions.refresh);
  renderTabNav(tabNavEl, state.activeTab, handleTabChange);
  renderActiveTab();
};
