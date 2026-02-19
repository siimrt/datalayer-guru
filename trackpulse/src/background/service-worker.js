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
      // Discover Shopify custom pixel sandbox iframes in the active tab
      getActiveTabId().then(async (activeTabId) => {
        if (!activeTabId) {
          sendResponse({ frames: [] });
          return;
        }
        try {
          const allFrames = await chrome.webNavigation.getAllFrames({ tabId: activeTabId });
          const pixelFrames = (allFrames || []).filter((frame) => {
            if (frame.frameId === 0) return false;
            const url = frame.url || '';
            return (
              url.includes('web-pixels-manager') ||
              url.includes('custom-pixels') ||
              url.includes('shopify.com/pixels') ||
              (url.startsWith('blob:') && frame.parentFrameId === 0)
            );
          });
          sendResponse({
            frames: pixelFrames.map((f) => ({
              frameId: f.frameId,
              url: f.url,
              label: extractPixelFrameLabel(f.url),
            })),
          });
        } catch (err) {
          console.debug('[TrackPulse] LIST_FRAMES error:', err);
          sendResponse({ frames: [] });
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

function extractPixelFrameLabel(url) {
  if (!url) return 'Custom Pixel';
  try {
    const u = new URL(url);
    const name = u.searchParams.get('name') || u.searchParams.get('pixel');
    if (name) return `Custom Pixel: ${name}`;
  } catch {}
  if (url.includes('web-pixels-manager')) return 'Shopify Pixel Sandbox';
  if (url.startsWith('blob:')) return 'Pixel Sandbox';
  return 'Custom Pixel Frame';
}
