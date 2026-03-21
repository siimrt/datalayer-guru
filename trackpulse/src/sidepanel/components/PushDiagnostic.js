/**
 * PushDiagnostic — Non-modal overlay shown after a dataLayer push.
 * Phase 1: immediate confirmation + warnings (page mismatch, sGTM).
 * Phase 2: 4s network monitoring with live results.
 * Auto-dismiss 6s after phase 2 ends (10s total).
 */

import { EXPECTED_EVENTS_BY_PAGE, EXPECTED_EVENTS_BY_PAGE_LEADGEN } from '../../shared/canonical-audit.js';
import { isServerSideRequest } from '../../content/parsers/network-request-parser.js';
import { trackEvent } from '../../shared/analytics.js';

// Build reverse map: eventName → [pageType, ...]
const EVENT_TO_PAGES = {};
for (const [pageType, events] of Object.entries(EXPECTED_EVENTS_BY_PAGE)) {
  for (const ev of events) {
    if (!EVENT_TO_PAGES[ev]) EVENT_TO_PAGES[ev] = [];
    EVENT_TO_PAGES[ev].push(pageType);
  }
}
for (const [pageType, events] of Object.entries(EXPECTED_EVENTS_BY_PAGE_LEADGEN)) {
  for (const ev of events) {
    if (!EVENT_TO_PAGES[ev]) EVENT_TO_PAGES[ev] = [];
    if (!EVENT_TO_PAGES[ev].includes(pageType)) EVENT_TO_PAGES[ev].push(pageType);
  }
}

// Platform display names
const PLATFORM_LABELS = {
  ga4: 'GA4',
  google_ads: 'Google Ads',
  meta: 'Meta',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
};

let _currentDiagnostic = null;
let _pollingTimer = null;
let _dismissTimer = null;

/**
 * Show the push diagnostic overlay.
 *
 * @param {object} opts
 * @param {string} opts.eventName - Extracted event name (e.g. 'purchase')
 * @param {string} opts.target - 'top' or frameId
 * @param {string} opts.currentPageType - Current page type from state
 * @param {object[]} opts.networkRequests - Reference to state.networkRequests
 * @param {Function} opts.getNetworkRequests - Getter for live networkRequests array
 */
export function showPushDiagnostic(opts) {
  // Clean up previous diagnostic
  cleanup();

  const { eventName, target, currentPageType, getNetworkRequests, currentHostname } = opts;
  const pushTimestamp = Date.now();

  // Detect sGTM from existing network requests
  const existingRequests = getNetworkRequests();
  const hasSGTM = existingRequests.some(r => r.platform === 'ga4' && isServerSideRequest(r.url, currentHostname));

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'tp-push-diagnostic animate-slide-in-up';
  overlay.innerHTML = buildPhase1HTML(eventName, target, currentPageType, hasSGTM);

  const pageMismatch = eventName && EVENT_TO_PAGES[eventName] && currentPageType && !EVENT_TO_PAGES[eventName].includes(currentPageType);
  trackEvent('push_diagnostic_shown', {
    result: pageMismatch ? 'warning_page_mismatch' : (hasSGTM ? 'info_sgtm' : 'success'),
    platform: 'ga4',
    eventName: eventName || 'unknown',
  });

  // Close button handler
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.tp-diag-close')) {
      cleanup();
    }
  });

  document.body.appendChild(overlay);
  _currentDiagnostic = overlay;

  // Phase 2: start network monitoring
  const resultsEl = overlay.querySelector('.tp-diag-results');
  const spinnerEl = overlay.querySelector('.tp-diag-spinner');
  const detected = new Map(); // platform → Set<eventName>
  let pollCount = 0;
  const maxPolls = 8; // 8 × 500ms = 4s

  _pollingTimer = setInterval(() => {
    pollCount++;
    const currentRequests = getNetworkRequests();

    // Find new requests since push
    for (const req of currentRequests) {
      const reqTime = req.timestamp instanceof Date ? req.timestamp.getTime() : req.timestamp;
      if (reqTime < pushTimestamp) continue;

      const platform = req.platform;
      if (!detected.has(platform)) detected.set(platform, new Set());

      const evName = req.eventName || 'request';
      if (!detected.get(platform).has(evName)) {
        detected.get(platform).add(evName);
        // Check if this is sGTM transport
        const isSS = req.platform === 'ga4' && isServerSideRequest(req.url, currentHostname);
        appendDetectedLine(resultsEl, platform, evName, isSS);
      }
    }

    // End of monitoring
    if (pollCount >= maxPolls) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;

      if (spinnerEl) spinnerEl.remove();

      if (detected.size === 0) {
        const summaryLine = document.createElement('div');
        summaryLine.className = 'tp-diag-line muted';
        if (hasSGTM) {
          summaryLine.textContent = 'No client-side requests detected (expected with sGTM)';
        } else {
          summaryLine.textContent = 'No requests detected — check GTM trigger configuration';
        }
        resultsEl.appendChild(summaryLine);
      }

      // Auto-dismiss after 6s
      _dismissTimer = setTimeout(cleanup, 6000);
    }
  }, 500);
}

function buildPhase1HTML(eventName, target, currentPageType, hasSGTM) {
  const lines = [];

  // Confirmation
  const targetLabel = target === 'top' ? 'dataLayer' : 'custom pixel';
  const displayName = eventName || 'event';
  lines.push(`<div class="tp-diag-line success">&#10003; <code>${escapeHTML(displayName)}</code> pushed to ${targetLabel}</div>`);

  // Page mismatch warning
  if (eventName && EVENT_TO_PAGES[eventName]) {
    const expectedPages = EVENT_TO_PAGES[eventName];
    if (currentPageType && !expectedPages.includes(currentPageType)) {
      const expectedList = expectedPages.join(', ');
      lines.push(
        `<div class="tp-diag-line warning">&#9888; You're on <strong>${escapeHTML(currentPageType)}</strong> — GTM triggers for <code>${escapeHTML(eventName)}</code> expect: ${escapeHTML(expectedList)}</div>`
      );
    }
  }

  // sGTM info
  if (hasSGTM) {
    lines.push(
      `<div class="tp-diag-line info">&#8505; Server-side GTM detected — Meta/TikTok tags fire server-side and won't appear here</div>`
    );
  }

  return `
    <div class="tp-diag-header">
      <span class="tp-diag-title">Push Diagnostic</span>
      <button class="tp-diag-close" title="Close">&times;</button>
    </div>
    <div class="tp-diag-body">
      ${lines.join('')}
      <div class="tp-diag-results"></div>
      <div class="tp-diag-spinner">
        <span class="tp-diag-spinner-dot"></span> Monitoring network...
      </div>
    </div>
  `;
}

function appendDetectedLine(container, platform, eventName, isServerSide) {
  const line = document.createElement('div');
  line.className = 'tp-diag-line success';
  const label = PLATFORM_LABELS[platform] || platform;
  const badge = isServerSide ? ' <span class="tp-badge-ss">SS</span>' : '';
  line.innerHTML = `&#10003; ${escapeHTML(label)}: <code>${escapeHTML(eventName)}</code>${badge}`;
  container.appendChild(line);
}

function cleanup() {
  if (_pollingTimer) { clearInterval(_pollingTimer); _pollingTimer = null; }
  if (_dismissTimer) { clearTimeout(_dismissTimer); _dismissTimer = null; }
  if (_currentDiagnostic) { _currentDiagnostic.remove(); _currentDiagnostic = null; }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
