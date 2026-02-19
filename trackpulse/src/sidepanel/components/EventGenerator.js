/**
 * EventGenerator Component — Shows generated events grouped by platform.
 * V2: Plan-gated features — blurred code on Free, locked Copy/Push buttons.
 */

import { syntaxHighlight, escapeHtml } from '../../shared/utils.js';
import { renderDataExtracted } from './DataExtracted.js';
import { applyCodePaywall, renderLockedButton, renderCMSGateBanner } from './Paywall.js';
import { getSyntheticEvents } from '../../content/generators/synthetic-events.js';

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
  const capabilities = state.capabilities;
  const supportedPlatforms = capabilities?.supportedPlatforms || ['ga4'];
  const detectedCMS = state.cms?.cms || 'unknown';

  // Check CMS support
  const cmsSupported = !capabilities || capabilities.supportedCMS.includes(detectedCMS) || detectedCMS === 'unknown';

  // Render platform toggles — show all platforms, mark unsupported ones
  const toggles = Object.keys(PLATFORM_LABELS)
    .map((platform) => {
      const isActive = activePlatforms.includes(platform);
      const isSupported = supportedPlatforms.includes(platform);
      const isLocked = !isSupported;
      return `
      <button
        class="tp-platform-toggle ${isActive && isSupported ? 'active' : ''} ${isLocked ? 'locked' : ''}"
        data-platform="${platform}"
        data-locked="${isLocked}"
        style="${isActive && isSupported ? `border-color: ${PLATFORM_COLORS[platform]}40; color: ${PLATFORM_COLORS[platform]};` : ''}
               ${isLocked ? 'opacity: 0.5; cursor: pointer;' : ''}"
        title="${isLocked ? `${PLATFORM_LABELS[platform]} — requires upgrade` : PLATFORM_LABELS[platform]}"
      >
        ${isLocked ? '&#128274; ' : ''}${PLATFORM_LABELS[platform]}
      </button>
    `;
    })
    .join('');

  // Render extracted data summary (always available)
  const dataSummary = renderDataExtracted(
    state.ecommerceData,
    state.pageType?.pageType
  );

  // Collect all events for active + supported platforms
  const allEvents = [];
  const lockedPlatformEvents = [];

  for (const platform of activePlatforms) {
    const platformEvents = events[platform] || [];
    if (supportedPlatforms.includes(platform)) {
      for (const event of platformEvents) {
        allEvents.push(event);
      }
    } else {
      // Show locked cards for unsupported platforms
      for (const event of platformEvents) {
        lockedPlatformEvents.push(event);
      }
    }
  }

  // Compute synthetic events for Quick Push
  const syntheticEvents = getSyntheticEvents(
    state.pageType?.pageType,
    state.ecommerceData
  );
  const hasFrames = (state.customPixelFrames || []).length > 0;
  const quickPushTarget = state.quickPushTarget || 'top';

  // Build Quick Push section HTML
  let quickPushHtml = '';
  if (syntheticEvents.length > 0) {
    if (!capabilities?.canPushEvents) {
      // Locked state for non-Pro users
      quickPushHtml = `
        <div class="tp-quick-push-section locked">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--tp-text); opacity: 0.5;">
              &#9889; Quick Push
            </span>
            <span style="font-size: 10px; color: var(--tp-primary); font-weight: 700;">PRO</span>
          </div>
          <div class="tp-quick-push-locked">
            <span style="font-size: 11px; color: var(--tp-text-muted);">
              &#128274; Push synthetic events to test your tracking
            </span>
            <button id="quick-push-upgrade-btn" style="
              margin-top: 8px; padding: 6px 14px; border-radius: 6px; border: none;
              background: var(--tp-primary); color: white; font-size: 11px; font-weight: 600;
              cursor: pointer;
            ">Unlock with Pro</button>
          </div>
        </div>
      `;
    } else {
      // Target selector (only when Shopify custom pixel frames detected)
      let targetSelector = '';
      if (hasFrames) {
        const frameOptions = state.customPixelFrames
          .map(
            (f) =>
              `<option value="${f.frameId}" ${quickPushTarget === f.frameId ? 'selected' : ''}>${escapeHtml(f.label)}</option>`
          )
          .join('');
        targetSelector = `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--tp-text-secondary);">Target:</span>
            <select id="quick-push-target" class="tp-target-select">
              <option value="top" ${quickPushTarget === 'top' ? 'selected' : ''}>dataLayer (top)</option>
              ${frameOptions}
            </select>
          </div>
        `;
      }

      // Event buttons
      const buttons = syntheticEvents
        .map(
          (evt, i) => `
          <button class="tp-quick-push-btn" data-synthetic-index="${i}" title="Push ${escapeHtml(evt.eventName)} to dataLayer">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v10M8 2l-3 3M8 2l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            ${escapeHtml(evt.label)}
          </button>
        `
        )
        .join('');

      quickPushHtml = `
        <div class="tp-quick-push-section">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--tp-text);">
              &#9889; Quick Push
            </span>
            <span style="font-size: 10px; color: var(--tp-text-muted);">Synthetic events</span>
          </div>
          ${targetSelector}
          <div class="tp-quick-push-buttons" id="quick-push-buttons">
            ${buttons}
          </div>
        </div>
      `;
    }
  }

  // Build events HTML
  let eventsHtml = '';

  if (allEvents.length === 0 && lockedPlatformEvents.length === 0) {
    eventsHtml = `
      <div class="tp-empty">
        <div class="tp-empty-icon">&#128269;</div>
        <p>No events generated for this page</p>
        <p class="text-[11px] mt-1">This may be a non-ecommerce page</p>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="p-3 flex gap-2 flex-wrap border-b border-tp-border">
      ${toggles}
    </div>
    ${dataSummary}
    ${quickPushHtml}
    <div id="cms-gate-banner"></div>
    <div id="event-cards-container">
      ${eventsHtml}
    </div>
    <div class="h-4"></div>
  `;

  // Show CMS gate banner if needed
  if (!cmsSupported) {
    const bannerEl = container.querySelector('#cms-gate-banner');
    renderCMSGateBanner(bannerEl, detectedCMS, capabilities.supportedCMS);
  }

  // Bind Quick Push buttons
  if (syntheticEvents.length > 0 && capabilities?.canPushEvents) {
    container.querySelectorAll('.tp-quick-push-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.syntheticIndex);
        const evt = syntheticEvents[index];
        if (evt) {
          const target = state.quickPushTarget || 'top';
          actions.pushSyntheticEvent(evt.code, target);
          btn.classList.add('pushed');
          setTimeout(() => btn.classList.remove('pushed'), 600);
        }
      });
    });

    const targetSelect = container.querySelector('#quick-push-target');
    if (targetSelect) {
      targetSelect.addEventListener('change', (e) => {
        actions.setQuickPushTarget(e.target.value);
      });
    }
  } else if (syntheticEvents.length > 0 && !capabilities?.canPushEvents) {
    const upgradeBtn = container.querySelector('#quick-push-upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        if (actions.navigateToPricing) actions.navigateToPricing();
      });
    }
  }

  // Render event cards with plan gating (DOM-based for paywall overlay)
  const cardsContainer = container.querySelector('#event-cards-container');

  // Render supported platform events
  allEvents.forEach((event, index) => {
    const card = createEventCard(event, index, index > 0, capabilities, actions);
    cardsContainer.appendChild(card);
  });

  // Render locked platform events
  lockedPlatformEvents.forEach((event) => {
    const card = createLockedPlatformCard(event, actions);
    cardsContainer.appendChild(card);
  });

  // Bind platform toggles
  container.querySelectorAll('.tp-platform-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.locked === 'true') {
        if (actions.navigateToPricing) actions.navigateToPricing();
      } else {
        actions.togglePlatform(btn.dataset.platform);
      }
    });
  });
}

function createEventCard(event, index, collapsed, capabilities, actions) {
  const platformLabel = PLATFORM_LABELS[event.platform] || event.platform;
  const platformColor = PLATFORM_COLORS[event.platform] || '#6C5CE7';
  const highlighted = syntaxHighlight(event.code);
  const escapedCode = escapeHtml(event.code);
  const isFree = capabilities?.plan === 'free';

  // Create card element
  const card = document.createElement('div');
  card.className = 'tp-event-card animate-slide-in';

  // Header
  const header = document.createElement('div');
  header.className = 'tp-event-header';
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-semibold uppercase tracking-wider" style="color: ${platformColor};">${platformLabel}</span>
      <span class="text-[12px] font-medium text-tp-text">${event.eventName}</span>
    </div>
    <svg class="tp-chevron ${collapsed ? '' : 'open'}" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  card.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'tp-event-body';
  body.style.display = collapsed ? 'none' : 'block';

  // Code block
  const codeBlock = document.createElement('div');
  codeBlock.className = 'code-block';
  codeBlock.innerHTML = highlighted;
  body.appendChild(codeBlock);

  // If FREE plan: apply blur paywall to code
  if (isFree) {
    applyCodePaywall(codeBlock, 'eventGeneration', 'starter');
  }

  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tp-event-actions';

  // COPY button
  if (capabilities?.canCopyEvents) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tp-btn tp-btn-sm';
    copyBtn.dataset.action = 'copy';
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
      Copy
    `;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      actions.copyCode(escapedCode);
    });
    actionsDiv.appendChild(copyBtn);
  } else {
    renderLockedButton(actionsDiv, 'Copy', 'eventCopy', 'starter');
  }

  // PUSH button (GA4 only)
  if (event.platform === 'ga4') {
    if (capabilities?.canPushEvents) {
      const pushBtn = document.createElement('button');
      pushBtn.className = 'tp-btn tp-btn-sm tp-btn-primary';
      pushBtn.dataset.action = 'push';
      pushBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Push to dataLayer
      `;
      pushBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        actions.pushToDataLayer(escapedCode);
      });
      actionsDiv.appendChild(pushBtn);
    } else {
      renderLockedButton(actionsDiv, 'Push', 'eventPush', 'pro');
    }
  }

  body.appendChild(actionsDiv);
  card.appendChild(body);

  // Expand/collapse
  header.addEventListener('click', () => {
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    const chevron = header.querySelector('.tp-chevron');
    if (chevron) chevron.classList.toggle('open', isHidden);
  });

  return card;
}

function createLockedPlatformCard(event, actions) {
  const platformLabel = PLATFORM_LABELS[event.platform] || event.platform;
  const platformColor = PLATFORM_COLORS[event.platform] || '#6C5CE7';

  const card = document.createElement('div');
  card.className = 'tp-event-card animate-slide-in';
  card.style.cursor = 'pointer';
  card.style.opacity = '0.6';
  card.innerHTML = `
    <div class="tp-event-header" style="opacity: 0.7;">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider" style="color: ${platformColor};">${platformLabel}</span>
        <span class="text-[12px] font-medium text-tp-text">${event.eventName}</span>
      </div>
      <span style="font-size: 12px;">&#128274;</span>
    </div>
  `;

  card.addEventListener('click', () => {
    if (actions?.navigateToPricing) actions.navigateToPricing();
  });

  return card;
}
