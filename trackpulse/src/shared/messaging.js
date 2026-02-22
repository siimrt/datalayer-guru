// Message type constants for chrome.runtime and window.postMessage communication

export const MSG = {
  // Content -> Background -> SidePanel
  PAGE_CONTEXT: 'TRACKPULSE_PAGE_CONTEXT',
  DATALAYER_PUSH: 'TRACKPULSE_DATALAYER_PUSH',
  DETECTION_RESULT: 'TRACKPULSE_DETECTION_RESULT',
  NETWORK_REQUEST: 'TRACKPULSE_NETWORK_REQUEST',

  // SidePanel -> Background -> Content
  REQUEST_REDETECT: 'TRACKPULSE_REDETECT',
  EXECUTE_CODE: 'TRACKPULSE_EXECUTE',

  // Content <-> Page Context (window.postMessage)
  EXECUTE_IN_PAGE: 'TRACKPULSE_EXECUTE_IN_PAGE',
  EXECUTE_RESULT: 'TRACKPULSE_EXECUTE_RESULT',

  // SidePanel -> Background: list Shopify custom pixel iframes
  LIST_FRAMES: 'TRACKPULSE_LIST_FRAMES',

  // SidePanel -> Background: execute code in a specific frame
  EXECUTE_IN_FRAME: 'TRACKPULSE_EXECUTE_IN_FRAME',

  // SidePanel -> Background: start continuous monitoring in a custom pixel frame
  START_FRAME_MONITORING: 'TRACKPULSE_START_FRAME_MONITORING',

  // Custom Pixel Frame -> Background -> SidePanel: detected pixels in frame
  FRAME_PIXELS: 'TRACKPULSE_FRAME_PIXELS',
};

/**
 * Send a message via chrome.runtime.sendMessage with error handling.
 */
export function sendMessage(type, payload) {
  try {
    chrome.runtime.sendMessage({ type, payload });
  } catch (e) {
    // Extension context may have been invalidated (e.g., after update)
    console.debug('[TrackPulse] sendMessage failed:', e.message);
  }
}

/**
 * Send a message to a specific tab via chrome.tabs.sendMessage.
 */
export function sendTabMessage(tabId, type, payload) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, { type, payload }, (response) => {
        resolve(response);
      });
    } catch (e) {
      console.debug('[TrackPulse] sendTabMessage failed:', e.message);
      resolve(null);
    }
  });
}

/**
 * Add a message listener that auto-filters by message type.
 */
export function onMessage(type, callback) {
  const listener = (msg, sender, sendResponse) => {
    if (msg.type === type) {
      callback(msg.payload, sender, sendResponse);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
