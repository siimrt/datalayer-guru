/**
 * FunnelMode Component — Multi-page funnel audit (Pro+).
 *
 * V2.4: Screenshot-matching timeline design with multi-platform
 *        progressive detection, partial states, and strengthened detection.
 *
 * How it works:
 * 1. User clicks "Start Funnel" -> enters recording mode
 * 2. User navigates through pages normally
 * 3. Traacky captures funnel events from: audit diff, dataLayer pushes, network requests
 * 4. Events appear progressively as detected, with per-platform tracking
 * 5. User clicks "Stop Funnel" -> shows funnel summary with timeline
 * 6. Can export as PDF report
 *
 * Detection flow:
 * - Each funnel event (view_item, add_to_cart, etc.) tracks ALL platform detections
 * - Sources: dataLayer audit, dataLayer push, network requests
 * - Network requests are re-scanned on each render as a safety net
 * - Status: green (all expected platforms detected), orange (partial), progressive (only detected shown)
 *
 * Stored in chrome.storage.session (cleared when browser closes).
 */

import { renderSectionPaywall } from './Paywall.js';
import { enhanceAuditWithNetworkData } from '../utils/network-audit-enhancer.js';
import { platformIconHtml } from '../../shared/platform-icons.js';
import { PAGE_TYPE_LABELS, PLATFORM_LABELS } from '../../shared/constants.js';
import { trackEvent } from '../../shared/analytics.js';
import {
  ECOM_FUNNEL_SEQUENCE, LEADGEN_FUNNEL_SEQUENCE,
  buildFunnelEvents,
} from '../../shared/canonical-audit.js';

const FUNNEL_STORAGE_KEY = 'tp_funnel_session';

// Derived from canonical-audit.js — single source of truth
const EXPECTED_FUNNEL_EVENTS = buildFunnelEvents(ECOM_FUNNEL_SEQUENCE);
const EXPECTED_FUNNEL_EVENTS_LEADGEN = buildFunnelEvents(LEADGEN_FUNNEL_SEQUENCE, true);

// Reverse lookup: platform-specific eventName → canonical funnel key
// Skip 'conversion' (Google Ads) — it's the same name for ALL event types,
// so it can't be reverse-mapped to a single funnel key. Google Ads conversions
// are matched via user-configured labels (gadsLabels) instead.
const AMBIGUOUS_EVENT_NAMES = new Set(['conversion']);
const EVENT_TO_FUNNEL_KEY = {};
for (const fe of EXPECTED_FUNNEL_EVENTS) {
  for (const eventName of Object.values(fe.events)) {
    if (!AMBIGUOUS_EVENT_NAMES.has(eventName)) {
      EVENT_TO_FUNNEL_KEY[eventName] = fe.key;
    }
  }
}
for (const fe of EXPECTED_FUNNEL_EVENTS_LEADGEN) {
  for (const eventName of Object.values(fe.events)) {
    if (!EVENT_TO_FUNNEL_KEY[eventName] && !AMBIGUOUS_EVENT_NAMES.has(eventName)) {
      EVENT_TO_FUNNEL_KEY[eventName] = fe.key;
    }
  }
}

// Additional event name aliases → funnel keys
const EXTRA_EVENT_MAPPINGS = {
  VIEW_CONTENT: 'view_item',
  ADD_CART: 'add_to_cart',
  START_CHECKOUT: 'begin_checkout',
  ADD_BILLING: 'add_payment_info',
  PURCHASE: 'purchase',       // Snapchat PURCHASE
  PAGE_VIEW: 'page_view',     // Snapchat PAGE_VIEW
  SIGN_UP: 'generate_lead',   // Snapchat SIGN_UP
  CompletePayment: 'purchase', // TikTok alternate
};
Object.assign(EVENT_TO_FUNNEL_KEY, EXTRA_EVENT_MAPPINGS);

// Case-insensitive lookup (lowercase key → funnel key)
const EVENT_TO_FUNNEL_KEY_LOWER = {};
for (const [k, v] of Object.entries(EVENT_TO_FUNNEL_KEY)) {
  EVENT_TO_FUNNEL_KEY_LOWER[k.toLowerCase()] = v;
}

// dataLayer push event names → funnel key
const DATALAYER_EVENT_TO_FUNNEL_KEY = {
  view_item: 'view_item',
  add_to_cart: 'add_to_cart',
  begin_checkout: 'begin_checkout',
  checkout: 'begin_checkout',           // "checkout" in dataLayer = begin_checkout, NOT purchase
  add_shipping_info: 'add_shipping_info',
  add_payment_info: 'add_payment_info',
  add_contact_info: 'add_shipping_info', // contact info is part of shipping step
  purchase: 'purchase',
  view_cart: 'add_to_cart', // view_cart means cart is active
};

/**
 * Resolve funnel key from an event name.
 * 1. Exact match (direct lookup)
 * 2. Case-insensitive exact match
 * 3. Substring match: if the event name *contains* a known canonical name,
 *    match it (e.g. "dl_begin_checkout", "purchase_mysite", "custom_add_to_cart_v2")
 *    Longer canonical names are checked first to avoid false positives
 *    (e.g. "add_shipping_info" before "add_to_cart").
 *    Generic page-level events (pagevisit, page_view, PageView) are excluded
 *    from substring matching to avoid false positives on every page.
 */

// Events too generic for substring matching — they fire on every page
const GENERIC_EVENT_NAMES = new Set([
  'pagevisit', 'page_view', 'pageview',                // generic pageviews
  'cookie_match', 'cookie_sync', 'firmographic_enrichment', // utility pings
]);

// Page types where each funnel event is expected — used in addStep() to filter
// network events from the initial page scan (prevents false positives like
// ViewContent on homepage being counted as view_item).
const FUNNEL_KEY_VALID_PAGES = {
  view_item: new Set(['product']),
  add_to_cart: new Set(['product', 'collection', 'cart']),
  begin_checkout: new Set(['checkout', 'cart']),
  add_shipping_info: new Set(['checkout']),
  add_payment_info: new Set(['checkout']),
  purchase: new Set(['thank_you']),
};

// Pre-sorted canonical names for substring matching (longest first to avoid partial false positives)
const _ALL_CANONICAL_NAMES = [
  ...Object.keys(DATALAYER_EVENT_TO_FUNNEL_KEY),
  ...Object.keys(EVENT_TO_FUNNEL_KEY),
].sort((a, b) => b.length - a.length);

// Deduplicated, lowercase for substring scan — excluding generic events
const _SUBSTRING_CANDIDATES = [];
const _seenSubstr = new Set();
for (const name of _ALL_CANONICAL_NAMES) {
  const lower = name.toLowerCase();
  if (_seenSubstr.has(lower) || GENERIC_EVENT_NAMES.has(lower)) continue;
  _seenSubstr.add(lower);
  const key = DATALAYER_EVENT_TO_FUNNEL_KEY[name]
    || EVENT_TO_FUNNEL_KEY[name]
    || EVENT_TO_FUNNEL_KEY_LOWER[lower];
  if (key) _SUBSTRING_CANDIDATES.push({ pattern: lower, funnelKey: key });
}

function resolveFunnelKey(eventName) {
  if (!eventName) return null;

  // 1. Direct exact match
  const direct = DATALAYER_EVENT_TO_FUNNEL_KEY[eventName]
    || EVENT_TO_FUNNEL_KEY[eventName];
  if (direct) return direct;

  // 2. Case-insensitive exact match
  const lower = eventName.toLowerCase();
  const ciMatch = EVENT_TO_FUNNEL_KEY_LOWER[lower];
  if (ciMatch) return ciMatch;

  // Skip substring matching for generic page-level events
  if (GENERIC_EVENT_NAMES.has(lower)) return null;

  // 3. Substring match (longest pattern first)
  for (const { pattern, funnelKey } of _SUBSTRING_CANDIDATES) {
    if (lower.includes(pattern)) return funnelKey;
  }

  return null;
}

// --- PLATFORM LABELS & COLORS ---

const COLORS = {
  green: '#00B894',
  greenBg: 'rgba(0,184,148,0.10)',
  greenBorder: 'rgba(0,184,148,0.25)',
  orange: '#E67E22',
  orangeBg: 'rgba(230,126,34,0.10)',
  orangeBorder: 'rgba(230,126,34,0.25)',
  red: '#E74C3C',
  redBg: 'rgba(231,76,60,0.08)',
  redBorder: 'rgba(231,76,60,0.25)',
  primary: '#006d77',
  primaryBg: 'rgba(0,109,119,0.10)',
  pendingGray: '#E5E5EA',
  teal: '#00CEC9',
};

// Canonical display order for platform icons
const PLATFORM_ORDER = ['ga4', 'google_ads', 'meta', 'tiktok', 'pinterest', 'snapchat', 'linkedin'];

// ---- Platform Mapping ----

const PIXEL_TO_FUNNEL_PLATFORM = {
  ga4: 'ga4', gtm: 'ga4', google_ads: 'google_ads',
  meta: 'meta', tiktok: 'tiktok',
  pinterest: 'pinterest', snapchat: 'snapchat',
  linkedin: 'linkedin',
};

function getRelevantFunnelPlatforms(detectedPlatformsSet, excludedPlatforms) {
  if (!detectedPlatformsSet || detectedPlatformsSet.size === 0) return new Set(['ga4']);
  const relevant = new Set();
  for (const p of detectedPlatformsSet) {
    const mapped = PIXEL_TO_FUNNEL_PLATFORM[p];
    if (mapped && !(excludedPlatforms && excludedPlatforms.has(mapped))) relevant.add(mapped);
  }
  if (relevant.size === 0) relevant.add('ga4');
  return relevant;
}

// ---- FunnelSession Class ----

export class FunnelSession {
  constructor() {
    this.isRecording = false;
    this.steps = [];
    this.startTime = null;
    // Multi-platform: { [key]: { firstDetected, detections: [{ timestamp, source, platform, eventName }] } }
    this.detectedEvents = {};
    // Accumulative set of all platforms seen during this funnel recording (never shrinks)
    this.seenPlatforms = new Set(['ga4']);
    // Google Ads conversion label → funnel key mapping (loaded from chrome.storage.local)
    this.gadsLabels = {};
  }

  async start() {
    this.isRecording = true;
    this.steps = [];
    this.detectedEvents = {};
    this.startTime = Date.now();
    this.seenPlatforms = new Set(['ga4']);
    await this._persist();
  }

  async addStep(detectionResult) {
    if (!this.isRecording) return;

    const step = {
      url: detectionResult.url || '',
      pageType: detectionResult.pageType?.pageType || 'unknown',
      cms: detectionResult.cms?.cms || 'unknown',
      timestamp: Date.now(),
      generatedEvents: detectionResult.generatedEvents,
      audit: detectionResult.audit,
      ecommerceData: detectionResult.ecommerceData,
      pixels: detectionResult.pixels,
      consent: detectionResult.consent,
      networkRequests: detectionResult.networkRequests || [],
    };

    // Dedup guard: if the last step has the same URL, update in place
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep && lastStep.url === step.url) {
      Object.assign(lastStep, step);
    } else {
      this.steps.push(step);
    }

    // Scan audit diff for funnel events
    const enhancedDiff = enhanceAuditWithNetworkData(
      step.audit?.diff || [],
      step.networkRequests || []
    );
    for (const d of enhancedDiff) {
      const eventName = d.expected?.eventName;
      if (!eventName) continue;
      const funnelKey = resolveFunnelKey(eventName);
      if (funnelKey && (d.status === 'match' || d.status === 'partial' || d.status === 'network_confirmed')) {
        this._recordEvent(funnelKey, d.status === 'network_confirmed' ? 'network' : 'audit', d.expected?.platform, eventName);
      }
    }

    // Scan existing events from the page's dataLayer (safety net)
    for (const ev of step.audit?.existingEvents || []) {
      const evName = ev.event || ev.eventName;
      if (evName) {
        const fk = resolveFunnelKey(evName);
        if (fk) this._recordEvent(fk, 'audit', ev.platform || 'ga4', evName);
      }
    }

    // Scan ALL network requests passed with this step (filter by pageType context)
    for (const nr of step.networkRequests || []) {
      if (nr.eventName) {
        let funnelKey = resolveFunnelKey(nr.eventName);
        // Google Ads label matching
        if (!funnelKey && nr.platform === 'google_ads' && this.gadsLabels) {
          const m = nr.eventName.match(/^(?:conversion|view_through)\/(.+)$/);
          if (m) {
            for (const [key, label] of Object.entries(this.gadsLabels)) {
              if (label && label === m[1]) { funnelKey = key; break; }
            }
          }
        }
        if (funnelKey) {
          const validPages = FUNNEL_KEY_VALID_PAGES[funnelKey];
          if (!validPages || validPages.has(step.pageType)) {
            this._recordEvent(funnelKey, 'network', nr.platform, nr.eventName);
          }
        }
      }
    }

    // Accumulate platforms from step pixels into seenPlatforms
    for (const px of step.pixels || []) {
      const mapped = PIXEL_TO_FUNNEL_PLATFORM[px.platform];
      if (mapped) this.seenPlatforms.add(mapped);
    }

    await this._persist();
  }

  /**
   * Record a detected funnel event from any source.
   * Called by main.js when a dataLayer push or network request matches a funnel event.
   */
  recordEvent(eventName, source, platform, currentPageType) {
    if (!this.isRecording) return false;

    let funnelKey = resolveFunnelKey(eventName);

    // Google Ads special handling: match by user-configured conversion label
    if (!funnelKey && platform === 'google_ads' && this.gadsLabels) {
      const labelMatch = eventName.match(/^(?:conversion|view_through)\/(.+)$/);
      if (labelMatch) {
        const label = labelMatch[1];
        for (const [key, configuredLabel] of Object.entries(this.gadsLabels)) {
          if (configuredLabel && configuredLabel === label) {
            funnelKey = key;
            break;
          }
        }
      }
    }

    if (!funnelKey) return false;

    // Page-type filtering (same as addStep/rescanNetworkRequests)
    if (currentPageType) {
      const validPages = FUNNEL_KEY_VALID_PAGES[funnelKey];
      if (validPages && !validPages.has(currentPageType)) return false;
    }

    const resolvedPlatform = platform || 'unknown';
    const isNew = this._recordEvent(funnelKey, source, resolvedPlatform, eventName);
    if (isNew) this._persist();
    return isNew;
  }

  /**
   * Re-scan an array of network requests and record any funnel events found.
   * Safe to call repeatedly — deduped internally.
   * Returns true if any new events were recorded.
   */
  rescanNetworkRequests(networkRequests, currentPageType) {
    if (!this.isRecording || !networkRequests) return false;
    let anyNew = false;
    for (const nr of networkRequests) {
      if (nr.eventName) {
        let fk = resolveFunnelKey(nr.eventName);
        // Google Ads label matching
        if (!fk && nr.platform === 'google_ads' && this.gadsLabels) {
          const m = nr.eventName.match(/^(?:conversion|view_through)\/(.+)$/);
          if (m) {
            for (const [key, label] of Object.entries(this.gadsLabels)) {
              if (label && label === m[1]) { fk = key; break; }
            }
          }
        }
        if (fk) {
          // Apply same page-type filtering as addStep()
          const validPages = FUNNEL_KEY_VALID_PAGES[fk];
          if (validPages && currentPageType && !validPages.has(currentPageType)) continue;
          const added = this._recordEvent(fk, 'network', nr.platform, nr.eventName);
          if (added) anyNew = true;
        }
      }
    }
    if (anyNew) this._persist();
    return anyNew;
  }

  /**
   * Internal: record a platform detection for a funnel event.
   * Stores ALL unique platform+eventName detections per funnel key.
   * Returns true if this is a new detection.
   */
  _recordEvent(funnelKey, source, platform, eventName) {
    if (!this.detectedEvents[funnelKey]) {
      this.detectedEvents[funnelKey] = {
        firstDetected: Date.now(),
        detections: [],
      };
    }

    const existing = this.detectedEvents[funnelKey].detections;
    // Dedup: same platform + eventName = same detection
    if (existing.some((d) => d.platform === platform && d.eventName === eventName)) {
      return false;
    }

    existing.push({
      timestamp: Date.now(),
      source,
      platform: platform || 'unknown',
      eventName,
    });
    if (platform && platform !== 'unknown') this.seenPlatforms.add(platform);
    return true;
  }

  async stop(relevantPlatforms) {
    this.isRecording = false;
    await chrome.storage.session.set({
      [FUNNEL_STORAGE_KEY]: {
        isRecording: false,
        steps: this.steps,
        detectedEvents: this.detectedEvents,
        startTime: this.startTime,
        endTime: Date.now(),
        seenPlatforms: [...this.seenPlatforms],
      },
    });
    return this.generateFunnelReport(relevantPlatforms);
  }

  generateFunnelReport(relevantPlatforms) {
    const detectedKeys = Object.keys(this.detectedEvents);

    // Filter expected events to only those with at least one relevant platform
    const filteredExpected = relevantPlatforms
      ? EXPECTED_FUNNEL_EVENTS.filter(fe => Object.keys(fe.events).some(p => relevantPlatforms.has(p)))
      : EXPECTED_FUNNEL_EVENTS;

    const relevantDetectedKeys = detectedKeys.filter(k => filteredExpected.some(fe => fe.key === k));
    const missingEvents = filteredExpected.filter((fe) => !detectedKeys.includes(fe.key));

    const overallScore = filteredExpected.length > 0
      ? Math.round((relevantDetectedKeys.length / filteredExpected.length) * 100)
      : 0;

    const relevantPlatformsList = relevantPlatforms ? [...relevantPlatforms] : ['ga4', 'meta', 'tiktok', 'pinterest'];

    const stepsWithScores = this.steps.map((step, index) => {
      const enhancedDiff = enhanceAuditWithNetworkData(
        step.audit?.diff || [],
        step.networkRequests || []
      );
      const eventsFound = {};
      const eventsMissing = {};
      for (const p of relevantPlatformsList) {
        eventsFound[p] = enhancedDiff.filter((d) => d.platform === p && d.status !== 'missing').length;
        eventsMissing[p] = enhancedDiff.filter((d) => d.platform === p && d.status === 'missing').length;
      }
      return {
        ...step,
        stepNumber: index + 1,
        eventsFound,
        eventsMissing,
        overallScore: calculateStepScore(step),
      };
    });

    return {
      totalSteps: this.steps.length,
      duration: this.steps.length > 0
        ? this.steps[this.steps.length - 1].timestamp - this.steps[0].timestamp
        : 0,
      expectedEvents: filteredExpected,
      detectedEvents: this.detectedEvents,
      missingEvents,
      missingSteps: missingEvents.map((e) => e.key),
      overallScore,
      steps: stepsWithScores,
      relevantPlatforms: relevantPlatformsList,
    };
  }

  async _persist() {
    try {
      await chrome.storage.session.set({
        [FUNNEL_STORAGE_KEY]: {
          isRecording: this.isRecording,
          steps: this.steps,
          detectedEvents: this.detectedEvents,
          startTime: this.startTime,
          seenPlatforms: [...this.seenPlatforms],
        },
      });
    } catch (e) {}
  }

  async loadSession() {
    try {
      const data = await chrome.storage.session.get(FUNNEL_STORAGE_KEY);
      const session = data[FUNNEL_STORAGE_KEY];
      if (session) {
        this.isRecording = session.isRecording || false;
        this.steps = session.steps || [];
        this.detectedEvents = session.detectedEvents || {};
        this.startTime = session.startTime;
        this.seenPlatforms = new Set(session.seenPlatforms || ['ga4']);
      }
    } catch (e) {}
    // Load Google Ads labels from persistent storage
    await this.loadGadsLabels();
  }

  async loadGadsLabels() {
    try {
      const data = await chrome.storage.local.get('tp_gads_labels');
      this.gadsLabels = data.tp_gads_labels || {};
    } catch (e) {
      this.gadsLabels = {};
    }
  }

  async saveGadsLabels(labels) {
    this.gadsLabels = labels || {};
    try {
      await chrome.storage.local.set({ tp_gads_labels: this.gadsLabels });
    } catch (e) {}
  }
}

// ---- Helpers ----

function calculateStepScore(step) {
  const rawDiffs = step.audit?.diff || [];
  const diffs = enhanceAuditWithNetworkData(rawDiffs, step.networkRequests || []);
  if (diffs.length === 0) return 0;
  const matchCount = diffs.filter(
    (d) => d.status === 'match' || d.status === 'partial' || d.status === 'network_confirmed'
  ).length;
  return Math.round((matchCount / diffs.length) * 100);
}

// PAGE_TYPE_LABELS imported from shared/constants.js

function formatDuration(ms) {
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function sourceLabel(source) {
  switch (source) {
    case 'audit': return 'dataLayer';
    case 'network': return 'Network';
    case 'datalayer_push': return 'dataLayer push';
    default: return source || '';
  }
}

/**
 * Get event status: 'complete' (all expected platforms), 'partial' (some), or 'missing' (none).
 * Returns { status, detectedCount, expectedCount, waitingCount, detectedPlatforms, waitingPlatforms }
 */
function getEventPlatformStatus(funnelEventDef, detectedEvent, relevantPlatforms) {
  const allDefined = Object.keys(funnelEventDef.events);
  const expectedPlatforms = relevantPlatforms
    ? [...relevantPlatforms]
    : allDefined;
  const detections = detectedEvent?.detections || [];
  const detectedPlatformSet = new Set(detections.map((d) => d.platform).filter((p) => p !== 'unknown'));

  // Also include bonus platforms (detected but not in expected list)
  const allDetectedPlatforms = [...detectedPlatformSet];

  const waitingPlatforms = expectedPlatforms.filter((p) => !detectedPlatformSet.has(p));
  const detectedExpected = expectedPlatforms.filter((p) => detectedPlatformSet.has(p));

  const status = !detectedEvent ? 'missing'
    : waitingPlatforms.length === 0 ? 'complete'
    : 'partial';

  return {
    status,
    detectedCount: allDetectedPlatforms.length,
    expectedCount: expectedPlatforms.length,
    waitingCount: waitingPlatforms.length,
    detectedPlatforms: allDetectedPlatforms,
    waitingPlatforms,
    allExpectedPlatforms: expectedPlatforms,
  };
}

/**
 * Render platform icons row: colored for detected, grayed for waiting.
 */
function renderPlatformIconsRow(detectedPlatforms, waitingPlatforms, size = 14) {
  const detectedSet = new Set(detectedPlatforms);
  const allPlatforms = [...new Set([...detectedPlatforms, ...waitingPlatforms])];
  allPlatforms.sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a);
    const ib = PLATFORM_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  let html = '';
  for (const p of allPlatforms) {
    if (detectedSet.has(p)) {
      html += platformIconHtml(p, size, 'margin-right: 2px;');
    } else {
      html += platformIconHtml(p, size, 'margin-right: 2px; opacity: 0.25; filter: grayscale(100%);');
    }
  }
  return html;
}

// ---- Render Functions ----

/**
 * Render the Funnel Mode tab.
 * @param {HTMLElement} container
 * @param {FunnelSession} funnelSession
 * @param {object} capabilities
 * @param {object|null} lastReport
 * @param {object} state - Full sidepanel state (for network requests, pixels)
 */
export function renderFunnelMode(container, funnelSession, capabilities, lastReport, state, actions) {
  if (!capabilities.canFunnelMode) {
    renderSectionPaywall(container, 'funnelMode', 'pro');
    return;
  }

  // Safety net: re-scan current network requests for missed funnel events (filtered by page type)
  if (funnelSession.isRecording && state?.networkRequests) {
    const currentPageType = state?.pageType?.pageType || 'unknown';
    funnelSession.rescanNetworkRequests(state.networkRequests, currentPageType);
  }

  // Accumulate current page's detected platforms into seenPlatforms
  if (funnelSession.isRecording && state?.detectedPlatforms) {
    for (const p of state.detectedPlatforms) {
      const mapped = PIXEL_TO_FUNNEL_PLATFORM[p];
      if (mapped) funnelSession.seenPlatforms.add(mapped);
    }
  }

  if (lastReport) {
    renderFunnelReport(container, lastReport, funnelSession, capabilities, state, actions);
    return;
  }

  if (funnelSession.isRecording) {
    renderRecordingState(container, funnelSession, capabilities, state, actions);
  } else {
    renderIdleState(container, funnelSession, capabilities, state, actions);
  }
}

function renderIdleState(container, funnelSession, capabilities, state, actions) {
  container.innerHTML = `
    <div style="padding: 16px; text-align: center;">
      <div style="font-size: 32px; margin-bottom: 12px;">&#128279;</div>
      <div style="color: var(--tp-text); font-size: 14px; font-weight: 700; margin-bottom: 8px;">
        Funnel Mode
      </div>
      <div style="color: var(--tp-text-secondary); font-size: 12px; margin-bottom: 16px; line-height: 1.5;">
        Record your navigation through a purchase funnel.<br>
        Traacky tracks key events: view, add to cart, checkout, purchase.
      </div>
      <div style="display: flex; gap: 6px; justify-content: center; position: relative;">
        <button id="funnel-start-btn" style="
          background: ${COLORS.primary}; color: white; border: none;
          padding: 10px 24px; border-radius: 8px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 0.2s;
        ">&#9654; Start Funnel Recording</button>
        <button id="funnel-settings-btn" style="
          width: 34px; height: 34px; flex-shrink: 0;
          border: 1px solid var(--tp-border); border-radius: 6px;
          background: var(--tp-surface); color: var(--tp-text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        " title="Filter platforms">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </button>
        <div id="funnel-platform-popover" style="display: none;"></div>
      </div>
    </div>
  `;

  const startBtn = container.querySelector('#funnel-start-btn');
  startBtn.addEventListener('click', async () => {
    if (state) state.funnelReport = null;
    await funnelSession.start();
    trackEvent('funnel_started');
    renderRecordingState(container, funnelSession, capabilities, state, actions);
    // Auto-reload the current page so network requests are captured from the start
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.reload(tab.id);
    } catch (e) { /* ignore */ }
  });
  startBtn.addEventListener('mouseenter', () => { startBtn.style.background = '#005a63'; });
  startBtn.addEventListener('mouseleave', () => { startBtn.style.background = COLORS.primary; });

  // Wire platform filter settings button
  _wirePlatformFilterButton(container, state, actions);
}

function buildPurchaseCode(ecommerceData) {
  if (!ecommerceData) return `dataLayer.push({event: 'purchase'});`;
  const obj = { event: 'purchase', ecommerce: {} };
  if (ecommerceData.currency) obj.ecommerce.currency = ecommerceData.currency;
  if (ecommerceData.value) obj.ecommerce.value = ecommerceData.value;
  obj.ecommerce.transaction_id = 'test_' + Date.now();
  if (ecommerceData.items) obj.ecommerce.items = ecommerceData.items;
  return `dataLayer.push({ecommerce: null});\ndataLayer.push(${JSON.stringify(obj, null, 2)});`;
}

const CHECKOUT_QUICK_PUSH_EVENTS = [
  { key: 'add_shipping_info', label: 'Shipping', code: `dataLayer.push({event: 'add_shipping_info'});` },
  { key: 'add_payment_info', label: 'Payment', code: `dataLayer.push({event: 'add_payment_info'});` },
  { key: 'purchase', label: 'Purchase', code: null },
];

// ---- Funnel HTML Builders ----

function _buildTimelineHtml(detectedInOrder, detected, relevant, filteredExpected) {
  if (detectedInOrder.length === 0) {
    return `
      <div style="
        color: var(--tp-text-muted); font-size: 12px; text-align: center;
        padding: 20px 16px; line-height: 1.5;
        background: var(--tp-surface); border-radius: 8px;
        border: 1px dashed var(--tp-border);
      ">
        Navigate through your funnel to begin detecting events.<br>
        <span style="font-size: 11px; color: var(--tp-text-muted);">Events will appear here as they're detected.</span>
      </div>
    `;
  }

  return detectedInOrder.map((fe, i) => {
    const det = detected[fe.key];
    const ps = getEventPlatformStatus(fe, det, relevant);
    const isLast = i === detectedInOrder.length - 1;

    const isComplete = ps.status === 'complete';
    const dotColor = isComplete ? COLORS.green : COLORS.orange;
    const lineColor = isComplete ? COLORS.green : COLORS.orange;
    const dotIcon = isComplete ? '&#10003;' : '!';
    const badgeText = ps.waitingCount > 0
      ? `${ps.detectedCount} platform${ps.detectedCount !== 1 ? 's' : ''} &middot; ${ps.waitingCount} waiting`
      : `${ps.detectedCount} platform${ps.detectedCount !== 1 ? 's' : ''}`;
    const badgeColor = isComplete ? COLORS.green : COLORS.orange;
    const badgeBg = isComplete ? COLORS.greenBg : COLORS.orangeBg;

    return `
      <div style="display: flex; gap: 10px; position: relative;">
        <div style="display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0;">
          <div style="
            width: 16px; height: 16px; border-radius: 50%;
            background: ${dotColor}; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 8px; font-weight: 700; color: white;
          ">${dotIcon}</div>
          ${!isLast ? `<div style="width: 2px; flex: 1; min-height: 24px; background: ${lineColor}; opacity: 0.4;"></div>` : ''}
        </div>
        <div style="flex: 1; padding-bottom: ${isLast ? '0' : '8px'}; min-width: 0;">
          <div data-funnel-toggle="${fe.key}" style="cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
              <span style="color: var(--tp-text); font-size: 12px; font-weight: 600;">${fe.label}</span>
              <span style="
                font-size: 9px; font-weight: 600; color: ${badgeColor};
                background: ${badgeBg}; padding: 1px 6px; border-radius: 8px;
                white-space: nowrap;
              ">${badgeText}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 3px;">
              ${renderPlatformIconsRow(ps.detectedPlatforms, ps.waitingPlatforms, 14)}
            </div>
          </div>
          <div data-funnel-detail="${fe.key}" style="display: none; margin-top: 6px; padding: 6px 0;">
            ${(det.detections || []).map((d) => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11px; border-bottom: 1px solid var(--tp-border);">
                <div style="display: flex; align-items: center; gap: 4px; min-width: 60px;">
                  ${platformIconHtml(d.platform, 12)}
                  <span style="color: var(--tp-text); font-weight: 500;">${PLATFORM_LABELS[d.platform] || d.platform}</span>
                </div>
                <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px;">${d.eventName}</span>
                <span style="
                  margin-left: auto; font-size: 9px; padding: 1px 5px; border-radius: 6px;
                  color: ${d.source === 'network' ? COLORS.teal : COLORS.primary};
                  background: ${d.source === 'network' ? 'rgba(0,206,201,0.1)' : 'rgba(0,109,119,0.1)'};
                ">${sourceLabel(d.source)}</span>
              </div>
            `).join('')}
            ${ps.waitingPlatforms.map((p) => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11px; border-bottom: 1px solid var(--tp-border); opacity: 0.5;">
                <div style="display: flex; align-items: center; gap: 4px; min-width: 60px;">
                  ${platformIconHtml(p, 12, 'opacity: 0.4; filter: grayscale(100%);')}
                  <span style="color: var(--tp-text-muted); font-weight: 500;">${PLATFORM_LABELS[p] || p}</span>
                </div>
                <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px;">${fe.events[p] || '—'}</span>
                <span style="margin-left: auto; font-size: 9px; padding: 1px 5px; border-radius: 6px; color: ${COLORS.orange}; background: ${COLORS.orangeBg};">Waiting</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function _buildPagesHtml(steps) {
  if (steps.length === 0) return '';
  return steps.map((step) => {
    let pathname = '';
    try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
    const label = PAGE_TYPE_LABELS[step.pageType] || step.pageType;
    return `
      <div style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; font-size: 11px; border-left: 2px solid ${COLORS.primary}; margin-bottom: 2px;">
        <span style="color: var(--tp-text); font-weight: 500;">${label}</span>
        <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${pathname}</span>
      </div>
    `;
  }).join('');
}

function _wireFunnelToggles(container) {
  container.querySelectorAll('[data-funnel-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-funnel-toggle');
      const detail = container.querySelector(`[data-funnel-detail="${key}"]`);
      if (detail) {
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}

// Track previous render fingerprint to avoid unnecessary full rebuilds
let _lastFunnelRenderFingerprint = null;

function renderRecordingState(container, funnelSession, capabilities, state, actions) {
  const steps = funnelSession.steps || [];
  const detected = funnelSession.detectedEvents || {};
  const detectedKeys = Object.keys(detected);
  const elapsed = funnelSession.startTime ? Date.now() - funnelSession.startTime : 0;

  // Compute relevant platforms from accumulated seenPlatforms (respecting excluded platforms)
  const relevant = getRelevantFunnelPlatforms(funnelSession.seenPlatforms, state?.funnelExcludedPlatforms);
  const filteredExpected = EXPECTED_FUNNEL_EVENTS.filter(fe => Object.keys(fe.events).some(p => relevant.has(p)));
  const detectedCount = detectedKeys.filter(k => filteredExpected.some(fe => fe.key === k)).length;
  const expectedTotal = filteredExpected.length;

  // Incremental update: if the container already has the funnel skeleton,
  // only update the dynamic parts to avoid a full DOM rebuild (flash).
  // Include totalDetections and excludedCount so toggling a platform triggers a re-render.
  const totalDetections = Object.values(detected).reduce((sum, ev) => sum + (ev.detections?.length || 0), 0);
  const excludedCount = state?.funnelExcludedPlatforms?.size || 0;
  const fingerprint = JSON.stringify({ detectedKeys: detectedKeys.sort(), steps: steps.length, expectedTotal, totalDetections, excludedCount });
  const existingTimeline = container.querySelector('#funnel-timeline');
  const existingProgress = container.querySelector('#funnel-progress-text');
  const hasSkeleton = !!existingTimeline && !!existingProgress;

  if (hasSkeleton && _lastFunnelRenderFingerprint === fingerprint) {
    // Nothing changed — only update elapsed time
    const elapsedEl = container.querySelector('#funnel-elapsed');
    if (elapsedEl) elapsedEl.textContent = formatDuration(elapsed);
    return;
  }
  _lastFunnelRenderFingerprint = fingerprint;

  // Build progressive timeline — only detected events, in funnel order
  const detectedInOrder = filteredExpected.filter((fe) => detected[fe.key]);

  // If skeleton exists, do an incremental DOM update instead of full rebuild
  if (hasSkeleton) {
    // Update progress
    existingProgress.textContent = `${detectedCount} of ${expectedTotal} events detected`;
    const progressBar = container.querySelector('#funnel-progress-bar');
    if (progressBar) progressBar.style.width = `${Math.min(100, (detectedCount / expectedTotal) * 100)}%`;
    const elapsedEl = container.querySelector('#funnel-elapsed');
    if (elapsedEl) elapsedEl.textContent = formatDuration(elapsed);

    // Rebuild timeline content only
    const timelineContent = _buildTimelineHtml(detectedInOrder, detected, relevant, filteredExpected);
    existingTimeline.innerHTML = timelineContent;

    // Rebuild pages section
    const pagesContainer = container.querySelector('#funnel-pages');
    if (pagesContainer) {
      pagesContainer.innerHTML = steps.length > 0 ? `
        <div style="color: var(--tp-text); font-size: 12px; font-weight: 600; margin-top: 14px; margin-bottom: 6px;">
          Pages Visited <span style="color: var(--tp-text-muted); font-weight: 400;">(${steps.length})</span>
        </div>
        ${_buildPagesHtml(steps)}
      ` : '';
    }

    // Re-wire toggles
    _wireFunnelToggles(container);
    return;
  }

  const timelineHtml = _buildTimelineHtml(detectedInOrder, detected, relevant, filteredExpected);
  const pagesHtml = _buildPagesHtml(steps);

  container.innerHTML = `
    <style>
      @keyframes tpFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div style="padding: 14px;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; background: ${COLORS.red}; border-radius: 50%; animation: pulse-custom 1s infinite;"></div>
          <span style="color: var(--tp-text); font-size: 14px; font-weight: 700;">Funnel Recording</span>
        </div>
        <span id="funnel-elapsed" style="color: var(--tp-text-muted); font-size: 10px;">${formatDuration(elapsed)}</span>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span id="funnel-progress-text" style="color: var(--tp-text-secondary); font-size: 10px;">${detectedCount} of ${expectedTotal} events detected</span>
        </div>
        <div style="height: 4px; background: ${COLORS.pendingGray}; border-radius: 4px; overflow: hidden;">
          <div id="funnel-progress-bar" style="height: 100%; width: ${Math.min(100, (detectedCount / expectedTotal) * 100)}%; background: ${COLORS.primary}; border-radius: 4px; transition: width 0.3s;"></div>
        </div>
      </div>

      <!-- Detected events timeline -->
      <div style="color: var(--tp-text); font-size: 12px; font-weight: 600; margin-bottom: 8px;">
        Detected Events ${detectedCount > 0 ? `<span style="color: var(--tp-text-muted); font-weight: 400;">(${detectedCount})</span>` : ''}
      </div>
      <div id="funnel-timeline" style="padding-left: 2px;">
        ${timelineHtml}
      </div>

      <!-- Pages visited -->
      <div id="funnel-pages">
      ${steps.length > 0 ? `
        <div style="color: var(--tp-text); font-size: 12px; font-weight: 600; margin-top: 14px; margin-bottom: 6px;">
          Pages Visited <span style="color: var(--tp-text-muted); font-weight: 400;">(${steps.length})</span>
        </div>
        ${pagesHtml}
      ` : ''}
      </div>

      <!-- Stop button + settings -->
      <div style="display: flex; gap: 6px; margin-top: 16px; position: relative;">
        <button id="funnel-stop-btn" style="
          background: ${COLORS.red}; color: white; border: none; border-color: ${COLORS.red};
          padding: 8px 0; border-radius: 6px; flex: 1;
          font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.2s;
        ">&#9209; Stop &amp; Analyze Funnel</button>
        <button id="funnel-settings-btn" style="
          width: 34px; height: 34px; flex-shrink: 0;
          border: 1px solid var(--tp-border); border-radius: 6px;
          background: var(--tp-surface); color: var(--tp-text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        " title="Filter platforms">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </button>
        <div id="funnel-platform-popover" style="display: none;"></div>
      </div>
    </div>
  `;

  // Wire toggles
  _wireFunnelToggles(container);

  container.querySelector('#funnel-stop-btn').addEventListener('click', async () => {
    const report = await funnelSession.stop(relevant);
    trackEvent('funnel_stopped', {
      pageCount: report.totalSteps || 0,
      duration_s: Math.round((report.duration || 0) / 1000),
      score: report.overallScore || 0,
    });
    if (state) state.funnelReport = report;
    renderFunnelReport(container, report, funnelSession, capabilities, state, actions);
  });

  // Wire platform filter settings button
  _wirePlatformFilterButton(container, state, actions);

  // Quick-push bar for checkout / thank_you pages
  const pageType = state?.pageType?.pageType;
  if (actions?.pushSyntheticEvent && (pageType === 'checkout' || pageType === 'thank_you')) {
    const eventsToShow = pageType === 'thank_you'
      ? CHECKOUT_QUICK_PUSH_EVENTS.filter(e => e.key === 'purchase')
      : CHECKOUT_QUICK_PUSH_EVENTS;

    const bar = document.createElement('div');
    bar.className = 'tp-funnel-quickpush';
    bar.innerHTML = `
      <span style="font-size: 10px; color: var(--tp-text-muted); margin-right: 4px;">Quick Push</span>
      ${eventsToShow.map(e => `<button class="tp-quick-push-btn" data-qp-event="${e.key}">${e.label}</button>`).join('')}
    `;
    container.querySelector('div').appendChild(bar);

    bar.querySelectorAll('[data-qp-event]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-qp-event');
        const evt = CHECKOUT_QUICK_PUSH_EVENTS.find(e => e.key === key);
        if (!evt) return;
        const code = key === 'purchase' ? buildPurchaseCode(state?.ecommerceData) : evt.code;
        actions.pushSyntheticEvent(code, state.quickPushTarget);

        // Flash green
        btn.classList.add('pushed');
        setTimeout(() => btn.classList.remove('pushed'), 800);
      });
    });
  }
}

// ---- Platform Filter Popover ----

function _wirePlatformFilterButton(container, state, actions) {
  const btn = container.querySelector('#funnel-settings-btn');
  const popover = container.querySelector('#funnel-platform-popover');
  if (!btn || !popover) return;

  // Gather all detected funnel platforms (unfiltered)
  const allPlatforms = new Set();
  if (state?.detectedPlatforms) {
    for (const p of state.detectedPlatforms) {
      const mapped = PIXEL_TO_FUNNEL_PLATFORM[p];
      if (mapped) allPlatforms.add(mapped);
    }
  }
  if (allPlatforms.size === 0) allPlatforms.add('ga4');

  const excluded = state?.funnelExcludedPlatforms || new Set();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = popover.style.display !== 'none';
    if (isVisible) {
      popover.style.display = 'none';
      return;
    }

    popover.style.cssText = `
      display: block; position: absolute; right: 0; top: 100%; margin-top: 6px;
      background: var(--tp-surface); border: 1px solid var(--tp-border);
      border-radius: 8px; padding: 10px 12px; z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12); min-width: 180px;
    `;

    const platformsArr = [...allPlatforms].sort((a, b) => {
      if (a === 'ga4') return -1;
      if (b === 'ga4') return 1;
      return (PLATFORM_LABELS[a] || a).localeCompare(PLATFORM_LABELS[b] || b);
    });

    popover.innerHTML = `
      <div style="font-size: 11px; font-weight: 600; color: var(--tp-text); margin-bottom: 8px;">Filter Platforms</div>
      ${platformsArr.map(p => {
        const isGa4 = p === 'ga4';
        const isEnabled = isGa4 || !excluded.has(p);
        return `
          <label data-platform="${p}" style="
            display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: ${isGa4 ? 'default' : 'pointer'};
            ${isGa4 ? 'opacity: 0.6;' : ''}
          ">
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
              ${platformIconHtml(p, 14)}
              <span style="font-size: 11px; color: var(--tp-text);">${PLATFORM_LABELS[p] || p}</span>
            </div>
            <div class="tp-switch${isEnabled ? ' active' : ''}" style="
              width: 28px; height: 16px; border-radius: 8px; position: relative;
              background: ${isEnabled ? COLORS.primary : '#ccc'}; transition: background 0.2s;
              flex-shrink: 0; ${isGa4 ? 'pointer-events: none;' : ''}
            ">
              <div style="
                width: 12px; height: 12px; border-radius: 50%; background: white;
                position: absolute; top: 2px; transition: left 0.2s;
                left: ${isEnabled ? '14px' : '2px'};
              "></div>
            </div>
          </label>
        `;
      }).join('')}
    `;

    // Wire toggle clicks — update switch visually, defer re-render to popover close
    let _pendingRerender = false;
    popover.querySelectorAll('label[data-platform]').forEach(label => {
      const platform = label.getAttribute('data-platform');
      if (platform === 'ga4') return;
      label.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Toggle the excluded set directly (same logic as actions.toggleFunnelPlatform)
        const excl = state.funnelExcludedPlatforms || new Set();
        if (excl.has(platform)) {
          excl.delete(platform);
        } else {
          excl.add(platform);
        }
        chrome.storage.local.set({ tp_funnel_excluded_platforms: [...excl] });
        _pendingRerender = true;

        // Update switch visually in-place
        const switchEl = label.querySelector('.tp-switch');
        const knob = switchEl?.querySelector('div');
        if (switchEl && knob) {
          const nowEnabled = !excl.has(platform);
          switchEl.style.background = nowEnabled ? COLORS.primary : '#ccc';
          switchEl.classList.toggle('active', nowEnabled);
          knob.style.left = nowEnabled ? '14px' : '2px';
        }
      });
    });

  });

  // Close popover on click outside — trigger re-render if changes were made
  const closeHandler = (e) => {
    if (!btn.contains(e.target) && !popover.contains(e.target)) {
      popover.style.display = 'none';
      if (_pendingRerender && actions?.renderActiveTab) {
        actions.renderActiveTab();
      } else if (_pendingRerender) {
        // Fallback: re-render funnel via tab content update
        renderFunnelMode(container.closest('#tab-content') || container, funnelSession, state.capabilities, null, state, actions);
      }
    }
  };
  document.addEventListener('click', closeHandler);
}

// ---- Funnel Report ----

function renderFunnelReport(container, report, funnelSession, capabilities, state, actions) {
  const scoreColor = report.overallScore >= 80 ? COLORS.green : report.overallScore >= 50 ? COLORS.orange : COLORS.red;
  const scoreBg = report.overallScore >= 80 ? COLORS.greenBg : report.overallScore >= 50 ? COLORS.orangeBg : COLORS.redBg;

  const detected = report.detectedEvents || {};
  const expectedEvents = report.expectedEvents || EXPECTED_FUNNEL_EVENTS;
  const relevantSet = report.relevantPlatforms
    ? new Set(report.relevantPlatforms)
    : null;

  // Full timeline — all expected events with status
  const timelineHtml = expectedEvents.map((fe, i) => {
    const det = detected[fe.key];
    const ps = getEventPlatformStatus(fe, det, relevantSet);
    const isLast = i === expectedEvents.length - 1;

    let dotColor, lineColor, dotIcon;
    if (ps.status === 'complete') {
      dotColor = COLORS.green; lineColor = COLORS.green; dotIcon = '&#10003;';
    } else if (ps.status === 'partial') {
      dotColor = COLORS.orange; lineColor = COLORS.orange; dotIcon = '!';
    } else {
      dotColor = COLORS.red; lineColor = COLORS.pendingGray; dotIcon = '&#10007;';
    }

    const badgeText = ps.status === 'missing'
      ? 'Missing'
      : ps.waitingCount > 0
        ? `${ps.detectedCount} platform${ps.detectedCount !== 1 ? 's' : ''} &middot; ${ps.waitingCount} waiting`
        : `${ps.detectedCount} platform${ps.detectedCount !== 1 ? 's' : ''}`;
    const badgeColor = ps.status === 'complete' ? COLORS.green : ps.status === 'partial' ? COLORS.orange : COLORS.red;
    const badgeBg = ps.status === 'complete' ? COLORS.greenBg : ps.status === 'partial' ? COLORS.orangeBg : COLORS.redBg;

    return `
      <div style="display: flex; gap: 10px; position: relative;">
        <!-- Timeline dot + connector -->
        <div style="display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0;">
          <div style="
            width: 16px; height: 16px; border-radius: 50%;
            background: ${dotColor}; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 8px; font-weight: 700; color: white;
          ">${dotIcon}</div>
          ${!isLast ? `<div style="width: 2px; flex: 1; min-height: 24px; background: ${lineColor}; opacity: 0.4;"></div>` : ''}
        </div>
        <!-- Content -->
        <div style="flex: 1; padding-bottom: ${isLast ? '0' : '8px'}; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px;">
            <span style="color: var(--tp-text); font-size: 12px; font-weight: 600;">${fe.label}</span>
            <span style="
              font-size: 9px; font-weight: 600; color: ${badgeColor};
              background: ${badgeBg}; padding: 1px 6px; border-radius: 8px;
              white-space: nowrap;
            ">${badgeText}</span>
            ${det ? `
              <span style="display: flex; align-items: center; gap: 2px; margin-left: auto;">
                ${renderPlatformIconsRow(ps.detectedPlatforms, ps.waitingPlatforms, 13)}
              </span>
            ` : ''}
          </div>
          ${det ? `
            <div data-report-toggle="${fe.key}" style="cursor: pointer;">
              <span style="color: var(--tp-text-muted); font-size: 10px;">Show detail &#9660;</span>
            </div>
            <div data-report-detail="${fe.key}" style="display: none; margin-top: 4px;">
              ${(det.detections || []).map((d) => `
                <div style="
                  display: flex; align-items: center; gap: 8px;
                  padding: 3px 0; font-size: 11px;
                  border-bottom: 1px solid var(--tp-border);
                ">
                  <div style="display: flex; align-items: center; gap: 4px; min-width: 56px;">
                    ${platformIconHtml(d.platform, 12)}
                    <span style="color: var(--tp-text); font-weight: 500;">${PLATFORM_LABELS[d.platform] || d.platform}</span>
                  </div>
                  <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px;">${d.eventName}</span>
                  <span style="
                    margin-left: auto; font-size: 9px; padding: 1px 5px; border-radius: 6px;
                    color: ${d.source === 'network' ? COLORS.teal : COLORS.primary};
                    background: ${d.source === 'network' ? 'rgba(0,206,201,0.1)' : 'rgba(0,109,119,0.1)'};
                  ">${sourceLabel(d.source)}</span>
                </div>
              `).join('')}
              ${ps.waitingPlatforms.map((p) => `
                <div style="
                  display: flex; align-items: center; gap: 8px;
                  padding: 3px 0; font-size: 11px;
                  border-bottom: 1px solid var(--tp-border); opacity: 0.5;
                ">
                  <div style="display: flex; align-items: center; gap: 4px; min-width: 56px;">
                    ${platformIconHtml(p, 12, 'opacity: 0.4; filter: grayscale(100%);')}
                    <span style="color: var(--tp-text-muted); font-weight: 500;">${PLATFORM_LABELS[p] || p}</span>
                  </div>
                  <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px;">${fe.events[p] || '—'}</span>
                  <span style="
                    margin-left: auto; font-size: 9px; padding: 1px 5px; border-radius: 6px;
                    color: ${COLORS.red}; background: ${COLORS.redBg};
                  ">Missing</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Pages visited
  const pagesHtml = report.steps.map((step) => {
    const style = getStepStatusStyle(step.overallScore);
    let pathname = '';
    try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
    const label = PAGE_TYPE_LABELS[step.pageType] || step.pageType;

    const platforms = report.relevantPlatforms || ['ga4', 'meta', 'tiktok', 'pinterest'];
    const detail = platforms
      .filter((p) => (step.eventsFound[p] || 0) + (step.eventsMissing[p] || 0) > 0)
      .map((p) => {
        const found = step.eventsFound[p] || 0;
        const miss = step.eventsMissing[p] || 0;
        const c = miss === 0 ? COLORS.green : found > 0 ? COLORS.orange : COLORS.red;
        return `<span style="color: ${c};">${PLATFORM_LABELS[p] || p}: ${found}/${found + miss}</span>`;
      })
      .join(' <span style="color: var(--tp-text-muted);">&middot;</span> ');

    return `
      <div style="
        background: var(--tp-surface); border-radius: 6px; padding: 8px 10px;
        margin-bottom: 4px; border-left: 3px solid ${style.border};
        border: 1px solid var(--tp-border);
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <span style="color: var(--tp-text); font-size: 12px; font-weight: 600;">${step.stepNumber}. ${label}</span>
          <span style="font-size: 11px; font-weight: 600; color: ${style.color};">${step.overallScore}%</span>
        </div>
        <div style="color: var(--tp-text-muted); font-size: 10px; font-family: 'JetBrains Mono', monospace; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${pathname}
        </div>
        ${detail ? `<div style="font-size: 10px;">${detail}</div>` : ''}
      </div>
    `;
  }).join('');

  // Missing events warning — premium card design
  const missingEvents = report.missingEvents || [];
  const missingHtml = missingEvents.length > 0 ? `
    <div style="
      background: var(--tp-surface); border: 1px solid ${COLORS.orangeBorder};
      border-radius: 10px; padding: 14px; margin-bottom: 16px;
    ">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <div style="
          width: 32px; height: 32px; border-radius: 8px;
          background: ${COLORS.orangeBg}; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        ">
          <span style="font-size: 16px;">&#9888;</span>
        </div>
        <div>
          <div style="color: var(--tp-text); font-size: 13px; font-weight: 700;">${missingEvents.length} Missing Funnel Event${missingEvents.length !== 1 ? 's' : ''}</div>
          <div style="color: var(--tp-text-muted); font-size: 10px;">Not detected during recording</div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${missingEvents.map((e) => {
          const eventPlatforms = relevantSet
            ? Object.keys(e.events).filter(p => relevantSet.has(p))
            : Object.keys(e.events);
          const eventNames = eventPlatforms.map(p => e.events[p]).filter(Boolean);
          return `
            <div style="
              display: flex; align-items: center; gap: 8px; padding: 6px 8px;
              background: var(--tp-bg); border-radius: 6px;
            ">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: ${COLORS.red}; flex-shrink: 0;"></div>
              <span style="color: var(--tp-text); font-size: 12px; font-weight: 600; min-width: 90px;">${e.label}</span>
              <span style="color: var(--tp-text-muted); font-family: 'JetBrains Mono', monospace; font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${eventNames.join(', ')}
              </span>
              <span style="display: flex; align-items: center; gap: 2px; flex-shrink: 0;">
                ${eventPlatforms.map(p => platformIconHtml(p, 12, 'opacity: 0.3; filter: grayscale(100%);')).join('')}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div style="padding: 14px;">
      <!-- Score header -->
      <div style="
        text-align: center; padding: 20px; margin-bottom: 16px;
        background: ${scoreBg}; border-radius: 12px;
        border: 1px solid ${scoreColor}20;
      ">
        <div style="font-size: 42px; font-weight: 700; color: ${scoreColor}; line-height: 1;">${report.overallScore}%</div>
        <div style="color: var(--tp-text-secondary); font-size: 12px; margin-top: 6px;">Funnel Completion Score</div>
        <div style="display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11px; color: var(--tp-text-muted);">
          <span>${Object.keys(detected).length}/${expectedEvents.length} events</span>
          <span>&middot;</span>
          <span>${report.totalSteps} pages</span>
          <span>&middot;</span>
          <span>${formatDuration(report.duration)}</span>
        </div>
      </div>

      <!-- Missing events -->
      ${missingHtml}

      <!-- Timeline -->
      <div style="color: var(--tp-text); font-size: 13px; font-weight: 700; margin-bottom: 10px;">Funnel Events</div>
      <div style="padding-left: 2px;">
        ${timelineHtml}
      </div>

      <!-- Pages -->
      ${report.steps.length > 0 ? `
        <div style="color: var(--tp-text); font-size: 13px; font-weight: 700; margin-top: 16px; margin-bottom: 8px;">Pages Visited</div>
        ${pagesHtml}
      ` : ''}

      <!-- Buttons -->
      <div style="display: flex; gap: 8px; margin-top: 16px;">
        ${capabilities?.canExportPDF ? `
        <button id="funnel-export-btn" style="
          background: ${COLORS.primary}; color: white; border: none; border-color: ${COLORS.primary};
          padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; flex: 1;
          transition: all 0.2s;
        ">&#128196; Export PDF</button>
        ` : ''}
        <button id="funnel-new-btn" style="
          background: var(--tp-surface); color: var(--tp-text); border: 1px solid var(--tp-border);
          padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; flex: 1;
          transition: all 0.2s;
        ">&#128279; New Funnel</button>
      </div>
    </div>
  `;

  // Wire toggles
  container.querySelectorAll('[data-report-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-report-toggle');
      const detail = container.querySelector(`[data-report-detail="${key}"]`);
      if (detail) {
        const isOpen = detail.style.display !== 'none';
        detail.style.display = isOpen ? 'none' : 'block';
        el.innerHTML = isOpen
          ? `<span style="color: var(--tp-text-muted); font-size: 10px;">Show detail &#9660;</span>`
          : `<span style="color: var(--tp-text-muted); font-size: 10px;">Hide detail &#9650;</span>`;
      }
    });
  });

  container.querySelector('#funnel-new-btn')?.addEventListener('click', () => {
    if (state) state.funnelReport = null;
    renderIdleState(container, funnelSession, capabilities, state, actions);
  });

  container.querySelector('#funnel-export-btn')?.addEventListener('click', async () => {
    try {
      const { generateFunnelPDFReport } = await import('../../export/pdf-report.js');
      await generateFunnelPDFReport(report);
      trackEvent('funnel_exported', { format: 'pdf', score: report.overallScore || 0 });
    } catch (e) {
      console.error('[Traacky] Funnel PDF export failed:', e);
      trackEvent('export_failed', { type: 'funnel_pdf', error: String(e.message || e).slice(0, 200) });
    }
  });
}

function getStepStatusStyle(score) {
  if (score >= 80) return { color: COLORS.green, bg: COLORS.greenBg, border: COLORS.green };
  if (score > 0) return { color: COLORS.orange, bg: COLORS.orangeBg, border: COLORS.orange };
  return { color: COLORS.red, bg: COLORS.redBg, border: COLORS.red };
}
