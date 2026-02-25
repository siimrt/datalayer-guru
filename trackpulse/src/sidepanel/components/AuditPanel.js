/**
 * AuditPanel Component — Shows tracking audit results (expected vs actual events).
 * V2: Gated for Free/Starter users — shows paywall overlay.
 */

import { escapeHtml } from '../../shared/utils.js';
import { PAGE_TYPE_LABELS, GA4_EVENT_MAP, META_EVENT_MAP, TIKTOK_EVENT_MAP } from '../../shared/constants.js';
import { renderSectionPaywall } from './Paywall.js';

export function renderAuditPanel(container, state, actions) {
  // V2: Check if audit is accessible
  if (state.capabilities && !state.capabilities.canAudit) {
    renderSectionPaywall(container, 'auditDiff', 'pro');
    return;
  }

  // Original V1 audit logic below
  const pageType = state.pageType?.pageType || 'unknown';
  const pageLabel = PAGE_TYPE_LABELS[pageType] || 'Unknown';
  const diff = state.audit?.diff || [];
  const existingEvents = state.audit?.existingEvents || [];

  // Build expected events list
  const expectedGA4 = GA4_EVENT_MAP[pageType];
  const expectedMeta = META_EVENT_MAP[pageType];
  const expectedTikTok = TIKTOK_EVENT_MAP[pageType];

  let auditHtml = '';

  if (!expectedGA4 && !expectedMeta && !expectedTikTok) {
    auditHtml = `
      <div class="tp-empty">
        <div class="tp-empty-icon">&#9989;</div>
        <p>No ecommerce events expected for "${pageLabel}" page</p>
      </div>
    `;
  } else {
    auditHtml = `
      <div class="tp-card">
        <div class="p-3">
          <div class="text-[12px] font-medium mb-3">Expected events for "${pageLabel}" page</div>
          ${renderAuditRow('GA4', expectedGA4, diff, existingEvents)}
          ${renderAuditRow('Meta', expectedMeta, diff, existingEvents)}
          ${renderAuditRow('TikTok', expectedTikTok, diff, existingEvents)}
        </div>
      </div>
    `;

    // Show field-level diffs
    const fieldsWithIssues = [];
    for (const d of diff) {
      if (d.status === 'partial') {
        const issues = (d.fields || []).filter(
          (f) => f.status !== 'match' && f.status !== 'extra'
        );
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

    // Existing dataLayer events summary
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
  auditHtml += renderNetworkRequestsSection(state.networkRequests || []);

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

  // Bind copy audit
  container.querySelector('#copy-audit')?.addEventListener('click', () => {
    const report = generateTextAuditReport(state);
    actions.copyCode(report);
  });

  // Bind PDF export
  container.querySelector('#export-pdf')?.addEventListener('click', () => {
    if (actions.exportPDF) {
      actions.exportPDF();
    }
  });
}

function renderAuditRow(platform, expectedEvent, diffs, existingEvents) {
  if (!expectedEvent) return '';

  const diffResult = diffs.find(
    (d) => d.expected?.eventName === expectedEvent
  );

  let statusIcon, statusText, statusClass;

  if (diffResult) {
    if (diffResult.status === 'match') {
      statusIcon = '<span class="tp-dot tp-dot-green"></span>';
      statusText = 'Found — Full match';
      statusClass = 'tp-diff-match';
    } else if (diffResult.status === 'partial') {
      const missingCount = (diffResult.fields || []).filter(
        (f) => f.status !== 'match' && f.status !== 'extra'
      ).length;
      statusIcon = '<span class="tp-dot tp-dot-yellow"></span>';
      statusText = `Found — ${diffResult.matchPercentage}% match (${missingCount} fields differ)`;
      statusClass = 'tp-diff-partial';
    } else {
      statusIcon = '<span class="tp-dot tp-dot-red"></span>';
      statusText = 'Not found in dataLayer';
      statusClass = 'tp-diff-missing';
    }
  } else {
    const exists = existingEvents.some((e) => e.event === expectedEvent);
    if (exists) {
      statusIcon = '<span class="tp-dot tp-dot-green"></span>';
      statusText = 'Found';
      statusClass = 'tp-diff-match';
    } else {
      statusIcon = '<span class="tp-dot tp-dot-red"></span>';
      statusText = 'Not found';
      statusClass = 'tp-diff-missing';
    }
  }

  return `
    <div class="flex items-start gap-2 py-2 border-b border-tp-border last:border-0">
      <div class="mt-1">${statusIcon}</div>
      <div class="flex-1">
        <div class="text-[12px]">
          <span class="text-tp-text-secondary">${platform}:</span>
          <span class="font-medium">${escapeHtml(expectedEvent)}</span>
        </div>
        <div class="text-[11px] ${statusClass}">${statusText}</div>
      </div>
    </div>
  `;
}

function renderFieldDiffs(item) {
  return `
    <div class="mb-3">
      <div class="text-[11px] font-medium mb-1">
        ${escapeHtml(item.eventName || '')}
        <span class="text-tp-text-muted">(${item.matchPercentage}% match)</span>
      </div>
      ${item.issues
        .slice(0, 10)
        .map(
          (field) => `
        <div class="flex items-start gap-1 pl-3 py-1 text-[11px]">
          <span class="${field.status === 'missing' ? 'tp-diff-missing' : 'tp-diff-partial'}">
            ${field.status === 'missing' ? '&#10007;' : '&#9888;'}
          </span>
          <span class="text-tp-text-secondary">${escapeHtml(field.path)}:</span>
          ${field.status === 'missing'
            ? `<span class="tp-diff-missing">missing</span>`
            : `<span class="tp-diff-partial">"${escapeHtml(String(field.actual ?? ''))}" vs expected "${escapeHtml(String(field.expected ?? ''))}"</span>`
          }
        </div>
      `
        )
        .join('')}
      ${item.issues.length > 10 ? `<div class="pl-3 text-[10px] text-tp-text-muted">... and ${item.issues.length - 10} more</div>` : ''}
    </div>
  `;
}

const PLATFORM_LABELS = {
  ga4: 'GA4', meta: 'Meta', tiktok: 'TikTok',
  pinterest: 'Pinterest', snapchat: 'Snapchat', linkedin: 'LinkedIn',
};

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

  // Group by platform
  const byPlatform = {};
  for (const req of networkRequests) {
    if (!byPlatform[req.platform]) byPlatform[req.platform] = [];
    byPlatform[req.platform].push(req);
  }

  const platformRows = Object.entries(byPlatform).map(([platform, reqs]) => {
    const events = [...new Set(reqs.map((r) => r.eventName).filter(Boolean))];
    const count = reqs.length;
    const label = PLATFORM_LABELS[platform] || platform;

    return `
      <div class="flex items-start gap-2 py-2 border-b border-tp-border last:border-0">
        <div class="mt-1"><span class="tp-dot tp-dot-green"></span></div>
        <div class="flex-1">
          <div class="text-[12px]">
            <span class="font-medium">${label}</span>
            <span class="text-tp-text-muted"> &mdash; ${count} request${count > 1 ? 's' : ''}</span>
          </div>
          <div class="text-[11px] text-tp-text-secondary mt-1">
            ${events.length > 0
              ? events.map((e) => `<span class="tp-badge tp-badge-page mr-1 mb-1" style="display:inline-block; font-size:10px; padding: 1px 6px;">${escapeHtml(e)}</span>`).join('')
              : '<span class="text-tp-text-muted">No event names parsed</span>'
            }
          </div>
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

function generateTextAuditReport(state) {
  const lines = [];
  const pageType = state.pageType?.pageType || 'unknown';
  const cms = state.cms?.cms || 'unknown';

  lines.push(`Traacky Audit Report`);
  lines.push(`========================`);
  lines.push(`URL: ${state.url || ''}`);
  lines.push(`CMS: ${cms} (${state.cms?.confidence || 0}% confidence)`);
  lines.push(`Page Type: ${pageType}`);
  lines.push(``);

  const diff = state.audit?.diff || [];
  lines.push(`Event Status:`);
  for (const d of diff) {
    const name = d.expected?.eventName || 'unknown';
    const platform = d.expected?.platform || '';
    lines.push(`  ${d.status === 'match' ? '[OK]' : d.status === 'partial' ? '[!!]' : '[XX]'} ${platform}: ${name} — ${d.matchPercentage}% match`);

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
  const netReqs = state.networkRequests || [];
  if (netReqs.length === 0) {
    lines.push(`  No tracking requests captured`);
  } else {
    const byPlatform = {};
    for (const r of netReqs) {
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
