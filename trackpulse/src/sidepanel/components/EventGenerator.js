/**
 * EventGenerator Component — Shows generated events grouped by platform.
 */

import { syntaxHighlight, escapeHtml } from '../../shared/utils.js';
import { renderDataExtracted } from './DataExtracted.js';

const PLATFORM_LABELS = {
  ga4: 'GA4',
  meta: 'Meta Pixel',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

const PLATFORM_COLORS = {
  ga4: '#4285F4',
  meta: '#1877F2',
  tiktok: '#00F2EA',
  pinterest: '#E60023',
};

export function renderEventGenerator(container, state, actions) {
  const events = state.generatedEvents || {};
  const activePlatforms = state.activePlatforms || ['ga4', 'meta', 'tiktok', 'pinterest'];

  // Render platform toggles
  const toggles = Object.keys(PLATFORM_LABELS)
    .map(
      (platform) => `
      <button
        class="tp-platform-toggle ${activePlatforms.includes(platform) ? 'active' : ''}"
        data-platform="${platform}"
        style="${activePlatforms.includes(platform) ? `border-color: ${PLATFORM_COLORS[platform]}40; color: ${PLATFORM_COLORS[platform]};` : ''}"
      >
        ${PLATFORM_LABELS[platform]}
      </button>
    `
    )
    .join('');

  // Render extracted data summary
  const dataSummary = renderDataExtracted(
    state.ecommerceData,
    state.pageType?.pageType
  );

  // Collect all events for active platforms
  const allEvents = [];
  for (const platform of activePlatforms) {
    const platformEvents = events[platform] || [];
    for (const event of platformEvents) {
      allEvents.push(event);
    }
  }

  // Render events
  let eventsHtml = '';
  if (allEvents.length === 0) {
    eventsHtml = `
      <div class="tp-empty">
        <div class="tp-empty-icon">&#128269;</div>
        <p>No events generated for this page</p>
        <p class="text-[11px] mt-1">This may be a non-ecommerce page</p>
      </div>
    `;
  } else {
    eventsHtml = allEvents
      .map((event, index) => renderEventCard(event, index, index > 0))
      .join('');
  }

  container.innerHTML = `
    <div class="p-3 flex gap-2 flex-wrap border-b border-tp-border">
      ${toggles}
    </div>
    ${dataSummary}
    ${eventsHtml}
    <div class="h-4"></div>
  `;

  // Bind platform toggles
  container.querySelectorAll('.tp-platform-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      actions.togglePlatform(btn.dataset.platform);
    });
  });

  // Bind expand/collapse
  container.querySelectorAll('.tp-event-header').forEach((header) => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const chevron = header.querySelector('.tp-chevron');
      if (body && body.classList.contains('tp-event-body')) {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (chevron) chevron.classList.toggle('open', isHidden);
      }
    });
  });

  // Bind copy buttons
  container.querySelectorAll('[data-action="copy"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      actions.copyCode(code);
    });
  });

  // Bind push buttons
  container.querySelectorAll('[data-action="push"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.dataset.code;
      actions.pushToDataLayer(code);
    });
  });
}

function renderEventCard(event, index, collapsed) {
  const platformLabel = PLATFORM_LABELS[event.platform] || event.platform;
  const platformColor = PLATFORM_COLORS[event.platform] || '#6C5CE7';
  const highlighted = syntaxHighlight(event.code);
  const escapedCode = escapeHtml(event.code);

  return `
    <div class="tp-event-card animate-slide-in">
      <div class="tp-event-header">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider" style="color: ${platformColor};">${platformLabel}</span>
          <span class="text-[12px] font-medium text-tp-text">${event.eventName}</span>
        </div>
        <svg class="tp-chevron ${collapsed ? '' : 'open'}" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="tp-event-body" style="display: ${collapsed ? 'none' : 'block'};">
        <div class="code-block">${highlighted}</div>
        <div class="tp-event-actions">
          <button class="tp-btn tp-btn-sm" data-action="copy" data-code="${escapedCode}">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
            Copy
          </button>
          ${event.platform === 'ga4' ? `
          <button class="tp-btn tp-btn-sm tp-btn-primary" data-action="push" data-code="${escapedCode}">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Push to dataLayer
          </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
