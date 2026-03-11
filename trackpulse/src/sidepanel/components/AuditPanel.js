/**
 * AuditPanel Component — Shows tracking audit results (expected vs actual events).
 * V2: Gated for Free/Starter users — shows paywall overlay.
 * V2.2: Event-grouped audit view — groups by canonical event (begin_checkout,
 *        add_shipping_info, etc.) and shows which platforms detected it with icons.
 *        Also checks network requests, not just dataLayer.
 */

import { escapeHtml } from '../../shared/utils.js';
import { PAGE_TYPE_LABELS, PLATFORM_LABELS } from '../../shared/constants.js';
import { renderSectionPaywall } from './Paywall.js';
import { enhanceAuditWithNetworkData, findNetworkMatchForEvent } from '../utils/network-audit-enhancer.js';
import { platformIconHtml } from '../../shared/platform-icons.js';

// Track which audit rows are expanded (persists across re-renders, resets on page navigation)
const expandedAuditRows = new Set();

export function resetAuditPanelState() {
  expandedAuditRows.clear();
}

/**
 * Canonical events per page type.
 * Each entry defines the event name per platform.
 */
const CANONICAL_EVENTS = {
  view_item: { label: 'Product View', platforms: { ga4: 'view_item', google_ads: 'conversion', meta: 'ViewContent', tiktok: 'ViewContent', pinterest: 'pagevisit' } },
  add_to_cart: { label: 'Add to Cart', platforms: { ga4: 'add_to_cart', google_ads: 'conversion', meta: 'AddToCart', tiktok: 'AddToCart', pinterest: 'addtocart', snapchat: 'ADD_CART' } },
  view_item_list: { label: 'Collection View', platforms: { ga4: 'view_item_list', meta: 'ViewCategory', tiktok: 'ViewContent', pinterest: 'viewcategory' } },
  view_cart: { label: 'View Cart', platforms: { ga4: 'view_cart', meta: 'ViewCart', tiktok: 'ViewCart' } },
  begin_checkout: { label: 'Begin Checkout', platforms: { ga4: 'begin_checkout', google_ads: 'conversion', meta: 'InitiateCheckout', tiktok: 'InitiateCheckout' } },
  add_shipping_info: { label: 'Add Shipping Info', platforms: { ga4: 'add_shipping_info' } },
  add_payment_info: { label: 'Add Payment Info', platforms: { ga4: 'add_payment_info' } },
  purchase: { label: 'Purchase', platforms: { ga4: 'purchase', google_ads: 'conversion', meta: 'Purchase', tiktok: 'PlaceAnOrder', pinterest: 'checkout' } },
  search: { label: 'Search', platforms: { ga4: 'search', meta: 'Search', tiktok: 'Search', pinterest: 'search' } },
};

/**
 * Which canonical events are expected per page type.
 */
const EXPECTED_EVENTS_BY_PAGE = {
  product: ['view_item', 'add_to_cart'],
  collection: ['view_item_list'],
  cart: ['view_cart'],
  checkout: ['begin_checkout', 'add_shipping_info', 'add_payment_info'],
  thank_you: ['purchase'],
  search: ['search'],
};

/**
 * Extract event name from a live dataLayer stream entry.
 * Handles both standard format ({event: 'xxx'}) and gtag format ({0: 'event', 1: 'xxx'}).
 */
function extractEventNameFromStreamEntry(entry) {
  let data = entry.data;
  // Unwrap single-element array (bridge wraps push args in array)
  if (Array.isArray(data) && data.length === 1) data = data[0];
  if (Array.isArray(data) && data.length > 1) data = data[0]; // multi-arg, take first
  if (!data || typeof data !== 'object') return null;

  // Standard format: {event: 'view_item', ...}
  if (data.event) return data.event;
  // gtag format: {0: 'event', 1: 'view_item', 2: {...}}
  if (data['0'] === 'event' && data['1']) return data['1'];
  return null;
}

export function renderAuditPanel(container, state, actions) {
  if (state.capabilities && !state.capabilities.canAudit) {
    renderSectionPaywall(container, 'auditDiff', 'pro');
    return;
  }

  const pageType = state.pageType?.pageType || 'unknown';
  const pageLabel = PAGE_TYPE_LABELS[pageType] || 'Unknown';
  const rawDiff = state.audit?.diff || [];
  const existingEvents = state.audit?.existingEvents || [];
  const networkRequests = state.networkRequests || [];
  const dataLayerStream = state.dataLayerStream || [];

  const diff = enhanceAuditWithNetworkData(rawDiff, networkRequests);

  // Precompute stream event names into Sets for O(1) lookups (avoids O(N*M) scanning)
  const streamEventNames = new Set();
  const streamEventNamesLower = new Set();
  for (const entry of dataLayerStream) {
    const name = extractEventNameFromStreamEntry(entry);
    if (name) {
      streamEventNames.add(name);
      streamEventNamesLower.add(name.toLowerCase());
    }
  }

  // Use centrally-computed detected platforms (from pixels + network requests)
  const installedPlatforms = state.detectedPlatforms || new Set(['ga4']);

  const expectedKeys = EXPECTED_EVENTS_BY_PAGE[pageType] || [];

  let auditHtml = '';

  if (expectedKeys.length === 0) {
    auditHtml = `
      <div class="tp-empty">
        <div class="tp-empty-icon">&#9989;</div>
        <p>No ecommerce events expected for "${pageLabel}" page</p>
      </div>
    `;
  } else {
    // Build event-grouped rows
    const eventRows = expectedKeys.map((key) => {
      const canonical = CANONICAL_EVENTS[key];
      if (!canonical) return '';
      return renderCanonicalEventRow(canonical, key, diff, existingEvents, networkRequests, streamEventNames, streamEventNamesLower, installedPlatforms);
    }).join('');

    auditHtml = `
      <div class="tp-card">
        <div class="p-3">
          <div class="text-[12px] font-medium mb-3">Expected events for "${pageLabel}" page</div>
          ${eventRows}
        </div>
      </div>
    `;

    // Field-level diffs
    const fieldsWithIssues = [];
    for (const d of diff) {
      if (d.status === 'partial') {
        const issues = (d.fields || []).filter(
          (f) => f.status !== 'match' && f.status !== 'extra'
        ).sort((a, b) => {
          // Show missing/mismatch first, info/recommended last
          const order = { missing: 0, mismatch: 1, info: 2, recommended: 3 };
          return (order[a.status] ?? 1) - (order[b.status] ?? 1);
        });
        if (issues.length > 0) {
          fieldsWithIssues.push({
            eventName: d.expected?.eventName,
            issues,
            matchPercentage: d.matchPercentage,
          });
        }
      }
    }

    if (fieldsWithIssues.length > 0) {
      auditHtml += `
        <div class="tp-card">
          <div class="p-3">
            <div class="text-[12px] font-medium mb-3">Field-level differences</div>
            ${fieldsWithIssues.map((item) => renderFieldDiffs(item)).join('')}
          </div>
        </div>
      `;
    }

    // Existing dataLayer events
    if (existingEvents.length > 0) {
      auditHtml += `
        <div class="tp-card">
          <div class="p-3">
            <div class="text-[12px] font-medium mb-2">DataLayer ecommerce events found</div>
            <div class="text-[11px] text-tp-text-secondary">
              ${existingEvents.map((e) => `<span class="tp-badge tp-badge-cms mr-1 mb-1" style="display:inline-block;">${escapeHtml(e.event)}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  // Network Requests section
  auditHtml += renderNetworkRequestsSection(networkRequests);

  // Action buttons
  auditHtml += `
    <div class="p-3 flex gap-2">
      <button class="tp-btn flex-1 justify-center" id="copy-audit">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
        Copy Audit Report
      </button>
      ${state.capabilities?.canExportPDF ? `
      <button class="tp-btn tp-btn-primary flex-1 justify-center" id="export-pdf">
        &#128196; Export PDF
      </button>
      ` : ''}
    </div>
  `;

  container.innerHTML = auditHtml;

  // Bind expand/collapse for event rows
  container.querySelectorAll('[data-audit-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.auditKey;
      const detail = el.parentElement.querySelector('[data-audit-detail]');
      if (detail) {
        const isHidden = detail.style.display === 'none';
        detail.style.display = isHidden ? 'block' : 'none';
        const arrow = el.querySelector('[data-arrow]');
        if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
        // Persist state
        if (key) {
          if (isHidden) {
            expandedAuditRows.add(key);
          } else {
            expandedAuditRows.delete(key);
          }
        }
      }
    });
  });

  // Copy conversion label on click
  container.querySelectorAll('[data-copy-label]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const label = el.dataset.copyLabel;
      if (label) {
        navigator.clipboard.writeText(label).then(() => {
          const original = el.textContent;
          if (el.tagName === 'CODE') {
            el.textContent = 'Copied!';
            setTimeout(() => { el.textContent = original; }, 1200);
          }
        });
      }
    });
  });

  container.querySelector('#copy-audit')?.addEventListener('click', () => {
    const report = generateTextAuditReport(state, diff);
    actions.copyCode(report);
  });

  container.querySelector('#export-pdf')?.addEventListener('click', () => {
    if (actions.exportPDF) actions.exportPDF();
  });
}

/**
 * Render a canonical event row (e.g. "Begin Checkout") showing which platforms detected it.
 */
function renderCanonicalEventRow(canonical, key, diffs, existingEvents, networkRequests, streamEventNames, streamEventNamesLower, installedPlatforms) {
  // Filter to only platforms actually detected on this site
  const platformEntries = Object.entries(canonical.platforms)
    .filter(([platform]) => installedPlatforms.has(platform));

  // If none of this event's platforms are installed, skip the entire row
  if (platformEntries.length === 0) return '';

  const platformResults = []; // { platform, status, source }

  for (const [platform, eventName] of platformEntries) {
    let status = 'missing';
    let source = '';

    // Check in enhanced diff (exact match first, then case-insensitive)
    const eventLower = eventName.toLowerCase();
    const diffResult = diffs.find((d) => d.expected?.eventName === eventName)
      || diffs.find((d) => d.expected?.eventName && d.expected.eventName.toLowerCase() === eventLower);
    if (diffResult) {
      if (diffResult.status === 'match') { status = 'found'; source = 'dataLayer'; }
      else if (diffResult.status === 'partial') { status = 'found'; source = 'dataLayer'; }
      else if (diffResult.status === 'network_confirmed') {
        status = 'network';
        source = diffResult.networkMatch?.source === 'custom_pixel' ? 'Custom Pixel' : 'network';
      }
    }

    // Check existingEvents fallback (case-insensitive)
    if (status === 'missing') {
      const exists = existingEvents.some((e) =>
        e.event === eventName || (e.event && e.event.toLowerCase() === eventLower)
      );
      if (exists) { status = 'found'; source = 'dataLayer'; }
    }

    // Check live dataLayer stream (catches events pushed after initial snapshot)
    if (status === 'missing' && (streamEventNames.has(eventName) || streamEventNamesLower.has(eventLower))) {
      status = 'found'; source = 'dataLayer';
    }

    // Check network fallback
    let networkMatchRef = null;
    if (status === 'missing') {
      const netMatch = findNetworkMatchForEvent(platform, eventName, networkRequests);
      if (netMatch) {
        status = 'network';
        source = netMatch.source === 'custom_pixel' ? 'Custom Pixel' : 'network';
        networkMatchRef = netMatch;
      }
    }

    // For Google Ads, also capture from diffResult network match
    if (platform === 'google_ads') {
      if (!networkMatchRef && diffResult?.networkMatch) {
        networkMatchRef = diffResult.networkMatch;
      }
      // Last resort: search network requests directly
      if (!networkMatchRef && status !== 'missing') {
        networkMatchRef = findNetworkMatchForEvent(platform, eventName, networkRequests);
      }
    }

    platformResults.push({ platform, eventName, status, source, networkMatchRef });
  }

  const detectedPlatforms = platformResults.filter((p) => p.status !== 'missing');
  const allPlatforms = platformResults.length;
  const detectedCount = detectedPlatforms.length;

  // Overall status for the row
  let dotColor, statusLabel;
  if (detectedCount === 0) {
    dotColor = '#FF6B6B'; statusLabel = 'Not detected';
  } else if (detectedCount === allPlatforms) {
    dotColor = '#00B894'; statusLabel = `${detectedCount} platform${detectedCount > 1 ? 's' : ''}`;
  } else {
    dotColor = '#F0932B'; statusLabel = `${detectedCount}/${allPlatforms} platforms`;
  }

  // Platform icons (detected ones in color, missing ones grayed)
  const iconsHtml = platformResults.map((p) => {
    const opacity = p.status === 'missing' ? '0.25' : '1';
    return `<span style="opacity: ${opacity};" title="${PLATFORM_LABELS[p.platform] || p.platform}: ${p.status === 'missing' ? 'not detected' : p.status}">${platformIconHtml(p.platform, 14)}</span>`;
  }).join('');

  // Detail rows (hidden by default, shown on click)
  const detailRows = platformResults.map((p) => {
    const pLabel = PLATFORM_LABELS[p.platform] || p.platform;
    const icon = platformIconHtml(p.platform, 13);
    let statusHtml;
    if (p.status === 'found') {
      statusHtml = `<span style="color: #00B894;">Found in dataLayer</span>`;
    } else if (p.status === 'partial') {
      statusHtml = `<span style="color: #F0932B;">Partial match</span>`;
    } else if (p.status === 'network') {
      statusHtml = `<span style="color: #00CEC9;">Sent via ${p.source}</span>`;
    } else {
      statusHtml = `<span style="color: #FF6B6B; opacity: 0.6;">Tag detected, no events</span>`;
    }
    // Google Ads: show conversion label with copy button
    let conversionLabelHtml = '';
    if (p.platform === 'google_ads' && p.networkMatchRef) {
      const label = p.networkMatchRef.params?.label || null;
      const pixelId = p.networkMatchRef.pixelId || null;
      if (label) {
        const fullLabel = pixelId ? `${pixelId}/${label}` : label;
        conversionLabelHtml = `
          <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px; padding-left: 20px;">
            <span style="font-size: 10px; color: var(--tp-text-muted);">Label:</span>
            <code data-copy-label="${escapeHtml(fullLabel)}" style="
              font-size: 10px; color: #4285F4; background: rgba(66,133,244,0.08);
              padding: 1px 6px; border-radius: 4px; cursor: pointer; user-select: all;
              border: 1px solid rgba(66,133,244,0.15);
            " title="Click to copy">${escapeHtml(fullLabel)}</code>
            <span data-copy-label="${escapeHtml(fullLabel)}" style="cursor: pointer; font-size: 10px; color: var(--tp-text-muted);" title="Copy label">📋</span>
          </div>`;
      }
    }

    const rowOpacity = p.status === 'missing' ? 'opacity: 0.55;' : '';
    return `
      <div style="display: flex; flex-direction: column; padding: 3px 0; font-size: 11px; ${rowOpacity}">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${icon}
          <span style="color: var(--tp-text); min-width: 55px;">${pLabel}</span>
          <span style="color: var(--tp-text-muted);">${escapeHtml(p.eventName)}</span>
          <span style="margin-left: auto;">${statusHtml}</span>
        </div>
        ${conversionLabelHtml}
      </div>
    `;
  }).join('');

  return `
    <div style="padding: 6px 0; border-bottom: 1px solid var(--tp-border);">
      <div data-audit-toggle data-audit-key="${key}" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span>
        <span style="color: var(--tp-text); font-size: 12px; font-weight: 600; flex: 1;">${canonical.label}</span>
        <span style="display: flex; align-items: center; gap: 2px;">${iconsHtml}</span>
        <span style="
          font-size: 10px; color: ${dotColor};
          background: ${dotColor}15; padding: 1px 6px;
          border-radius: 10px; white-space: nowrap;
        ">${statusLabel}</span>
        <span data-arrow style="color: var(--tp-text-muted); font-size: 10px; width: 10px; text-align: center;">${expandedAuditRows.has(key) ? '▾' : '▸'}</span>
      </div>
      <div data-audit-detail style="display: ${expandedAuditRows.has(key) ? 'block' : 'none'}; padding: 6px 0 2px 16px;">
        ${detailRows}
      </div>
    </div>
  `;
}

function groupFieldsByCategory(fields) {
  const groups = {};
  const priceKeys = new Set(['value', 'currency', 'tax', 'shipping', 'coupon', 'discount', 'ecomm_totalvalue', 'ecomm_pagetype']);
  const idKeys = new Set(['transaction_id', 'affiliation', 'item_list_id', 'item_list_name', 'ecomm_prodid']);

  for (const field of fields) {
    const leaf = field.path.split('.').pop().replace(/\[\d+\]$/, '');
    let cat;
    if (field.path.includes('items[')) cat = 'Items';
    else if (priceKeys.has(leaf)) cat = 'Price & Currency';
    else if (idKeys.has(leaf)) cat = 'Identifiers';
    else cat = 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(field);
  }
  return groups;
}

function formatFieldValue(val) {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'string') return val.length > 30 ? val.substring(0, 27) + '...' : val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return `[${val.length} item${val.length > 1 ? 's' : ''}]`;
  if (typeof val === 'object') return `{${Object.keys(val).length} keys}`;
  return String(val);
}

function renderFieldDiffs(item) {
  const grouped = groupFieldsByCategory(item.issues.slice(0, 15));

  const groupsHtml = Object.entries(grouped).map(([category, fields]) => `
    <div style="margin-bottom: 6px;">
      <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--tp-text-muted); padding-left: 8px; margin-bottom: 2px;">${category}</div>
      ${fields.map((field) => {
        const isRecommended = field.status === 'recommended';
        const isInfo = field.status === 'info';
        const icon = field.status === 'missing' ? '&#10007;' : isRecommended ? '&#9737;' : isInfo ? '&#8505;' : '&#9888;';
        const iconColor = field.status === 'missing' ? '#FF6B6B' : isRecommended ? '#006d77' : isInfo ? '#74B9FF' : '#F0932B';
        let valueHtml;
        if (field.status === 'missing') {
          valueHtml = `<span style="color: #FF6B6B;">missing</span>`;
        } else if (isRecommended) {
          valueHtml = `<span style="color: #006d77; opacity: 0.8;">recommended</span>`;
        } else if (isInfo) {
          valueHtml = `<span style="color: #74B9FF;"><code style="background: rgba(116,185,255,0.1); padding: 1px 4px; border-radius: 3px; font-size: 10px;">${escapeHtml(formatFieldValue(field.actual))}</code></span>
            <span style="color: var(--tp-text-muted); margin: 0 2px; font-size: 9px;">variant ID</span>`;
        } else {
          valueHtml = `<span style="color: #FF6B6B;"><code style="background: rgba(255,107,107,0.1); padding: 1px 4px; border-radius: 3px; font-size: 10px;">${escapeHtml(formatFieldValue(field.actual))}</code></span>
            <span style="color: var(--tp-text-muted); margin: 0 2px;">/</span>
            <span style="color: #00CEC9;"><code style="background: rgba(0,206,201,0.1); padding: 1px 4px; border-radius: 3px; font-size: 10px;">${escapeHtml(formatFieldValue(field.expected))}</code></span>`;
        }
        return `
          <div style="display: flex; align-items: flex-start; gap: 6px; padding: 2px 8px; font-size: 11px;">
            <span style="color: ${iconColor}; font-weight: bold; min-width: 12px;">${icon}</span>
            <span style="min-width: 110px; color: var(--tp-text-secondary); font-family: monospace; font-size: 10px;">${escapeHtml(field.path)}</span>
            <span style="flex: 1;">${valueHtml}</span>
          </div>`;
      }).join('')}
    </div>
  `).join('');

  return `
    <div style="margin-bottom: 10px; padding: 8px; border-radius: 6px; border: 1px solid var(--tp-border); background: var(--tp-surface-hover);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 600;">${escapeHtml(item.eventName || '')}</span>
        <span style="font-size: 10px; color: ${item.matchPercentage >= 80 ? '#F0932B' : '#FF6B6B'}; background: ${item.matchPercentage >= 80 ? 'rgba(240,147,43,0.1)' : 'rgba(255,107,107,0.1)'}; padding: 1px 8px; border-radius: 10px;">${item.matchPercentage}% match</span>
      </div>
      ${groupsHtml}
      ${item.issues.length > 15 ? `<div style="padding-left: 8px; font-size: 10px; color: var(--tp-text-muted);">... and ${item.issues.length - 15} more</div>` : ''}
    </div>
  `;
}

function renderNetworkRequestsSection(networkRequests) {
  if (networkRequests.length === 0) {
    return `
      <div class="tp-card">
        <div class="p-3">
          <div class="text-[12px] font-medium mb-2" style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--tp-text-muted);">&#9889;</span>
            Network Requests
          </div>
          <div class="text-[11px] text-tp-text-muted">
            No tracking network requests captured yet. Interact with the page to trigger events.
          </div>
        </div>
      </div>
    `;
  }

  const byPlatform = {};
  for (const req of networkRequests) {
    if (!byPlatform[req.platform]) byPlatform[req.platform] = [];
    byPlatform[req.platform].push(req);
  }

  const platformRows = Object.entries(byPlatform).map(([platform, reqs]) => {
    const events = [...new Set(reqs.map((r) => r.eventName).filter(Boolean))];
    const count = reqs.length;
    const label = PLATFORM_LABELS[platform] || platform;
    const icon = platformIconHtml(platform, 14);
    const netKey = `net_${platform}`;
    const isExpanded = expandedAuditRows.has(netKey);

    // Detail rows: individual requests
    const detailRows = reqs.map((req) => {
      const evName = req.eventName || '(unknown)';
      const source = req.source === 'custom_pixel' ? 'Custom Pixel' : req.source || '';
      const method = req.method || 'GET';
      const ts = req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : '';

      // Key params to display
      const paramEntries = Object.entries(req.params || {}).filter(
        ([k]) => !k.startsWith('_') && k !== 'pixelId'
      ).slice(0, 6);

      return `
        <div style="padding: 4px 0; border-top: 1px solid var(--tp-border); font-size: 10px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--tp-text-muted); min-width: 32px;">${escapeHtml(method)}</span>
            <span style="font-weight: 600; color: var(--tp-text);">${escapeHtml(evName)}</span>
            ${source ? `<span style="color: #006d77; font-size: 9px;">${escapeHtml(source)}</span>` : ''}
            <span style="margin-left: auto; color: var(--tp-text-muted);">${ts}</span>
          </div>
          ${paramEntries.length > 0 ? `
            <div style="padding: 2px 0 0 38px; display: flex; flex-wrap: wrap; gap: 4px;">
              ${paramEntries.map(([k, v]) => {
                const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40);
                return `<span style="background: var(--tp-surface); border: 1px solid var(--tp-border); border-radius: 3px; padding: 0 4px; font-family: monospace; font-size: 9px;">${escapeHtml(k)}=${escapeHtml(val)}</span>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div style="padding: 6px 0; border-bottom: 1px solid var(--tp-border);">
        <div data-audit-toggle data-audit-key="${netKey}" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
          <span class="tp-dot tp-dot-green"></span>
          ${icon}
          <span style="flex: 1; font-size: 12px;">
            <span class="font-medium">${label}</span>
            <span class="text-tp-text-muted"> &mdash; ${count} req</span>
          </span>
          <span style="display: flex; gap: 2px; flex-wrap: wrap; max-width: 60%;">
            ${events.slice(0, 4).map((e) => `<span class="tp-badge tp-badge-page" style="display:inline-block; font-size:9px; padding: 1px 5px;">${escapeHtml(e)}</span>`).join('')}
            ${events.length > 4 ? `<span style="font-size: 9px; color: var(--tp-text-muted);">+${events.length - 4}</span>` : ''}
          </span>
          <span data-arrow style="color: var(--tp-text-muted); font-size: 10px; width: 10px; text-align: center;">${isExpanded ? '▾' : '▸'}</span>
        </div>
        <div data-audit-detail style="display: ${isExpanded ? 'block' : 'none'}; padding: 4px 0 2px 20px;">
          ${detailRows}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="tp-card">
      <div class="p-3">
        <div class="text-[12px] font-medium mb-2" style="display: flex; align-items: center; gap: 6px;">
          <span style="color: #F0932B;">&#9889;</span>
          Network Requests Detected
          <span style="
            font-size: 10px; color: var(--tp-text-muted);
            background: var(--tp-surface-hover); padding: 1px 6px;
            border-radius: 10px; border: 1px solid var(--tp-border);
          ">${networkRequests.length}</span>
        </div>
        ${platformRows}
      </div>
    </div>
  `;
}

function generateTextAuditReport(state, enhancedDiff) {
  const lines = [];
  const pageType = state.pageType?.pageType || 'unknown';
  const cms = state.cms?.cms || 'unknown';
  const networkRequests = state.networkRequests || [];
  const diff = enhancedDiff || enhanceAuditWithNetworkData(state.audit?.diff || [], networkRequests);

  lines.push(`Traacky Audit Report`);
  lines.push(`========================`);
  lines.push(`URL: ${state.url || ''}`);
  lines.push(`CMS: ${cms} (${state.cms?.confidence || 0}% confidence)`);
  lines.push(`Page Type: ${pageType}`);
  lines.push(``);

  lines.push(`Event Status:`);
  for (const d of diff) {
    const name = d.expected?.eventName || 'unknown';
    const platform = d.expected?.platform || '';
    const statusMarker = d.status === 'match' ? '[OK]'
      : d.status === 'partial' ? '[!!]'
      : d.status === 'network_confirmed' ? '[NR]'
      : '[XX]';
    lines.push(`  ${statusMarker} ${platform}: ${name} — ${d.matchPercentage || 0}% match`);

    if (d.status === 'partial' || d.status === 'missing') {
      const issues = (d.fields || []).filter((f) => f.status !== 'match' && f.status !== 'extra');
      for (const f of issues.slice(0, 5)) {
        lines.push(`      ${f.status}: ${f.path} — expected: ${JSON.stringify(f.expected)}, actual: ${JSON.stringify(f.actual)}`);
      }
    }
  }

  lines.push(``);
  lines.push(`Pixels Detected:`);
  for (const p of state.pixels || []) {
    lines.push(`  ${p.active ? '[ON]' : '[--]'} ${p.platform}: ${p.id || 'ID unknown'}`);
  }

  lines.push(``);
  lines.push(`Network Requests:`);
  if (networkRequests.length === 0) {
    lines.push(`  No tracking requests captured`);
  } else {
    const byPlatform = {};
    for (const r of networkRequests) {
      if (!byPlatform[r.platform]) byPlatform[r.platform] = [];
      byPlatform[r.platform].push(r);
    }
    for (const [platform, reqs] of Object.entries(byPlatform)) {
      const events = [...new Set(reqs.map((r) => r.eventName).filter(Boolean))];
      lines.push(`  ${PLATFORM_LABELS[platform] || platform}: ${reqs.length} request(s) — events: ${events.join(', ') || 'unknown'}`);
    }
  }

  lines.push(``);
  lines.push(`Consent:`);
  const consent = state.consent || {};
  lines.push(`  CMP: ${consent.cmpDetected || 'none'}`);
  lines.push(`  Consent Mode: ${consent.consentModeActive ? 'Active' : 'Inactive'}`);
  if (consent.googleConsent) {
    for (const [key, val] of Object.entries(consent.googleConsent)) {
      lines.push(`    ${key}: ${val || 'not set'}`);
    }
  }

  return lines.join('\n');
}
