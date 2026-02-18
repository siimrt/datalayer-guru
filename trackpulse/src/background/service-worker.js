/**
 * TrackPulse Background Service Worker
 * Handles extension icon clicks, badge management, message routing, and tab tracking.
 */

import { MSG } from '../shared/messaging.js';
import { CMS_INFO } from '../shared/constants.js';

// Store per-tab context data
const tabContexts = {};

// --- Side Panel Setup ---

// Open side panel on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

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
  }
});

// --- Tab Tracking ---

// When a tab becomes active, send its stored context to the side panel
chrome.tabs.onActivated.addListener(({ tabId }) => {
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

// When a tab navigates, re-run detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    // Clear old data for this tab
    delete tabContexts[tabId];

    // Request re-detection
    setTimeout(() => {
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.REQUEST_REDETECT },
        () => {
          if (chrome.runtime.lastError) {}
        }
      );
    }, 500);
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
