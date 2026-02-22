/**
 * EventGenerator Component — Shows generated events grouped by platform.
 * V2: Plan-gated features — blurred code on Free, locked Copy/Push buttons.
 * Quick Push: Expandable code preview cards below event cards.
 */

import { syntaxHighlight, escapeHtml } from '../../shared/utils.js';
import { platformIconHtml } from '../../shared/platform-icons.js';
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
  tiktok: '#1A1A1A',
  pinterest: '#E60023',
};

/**
 * Generate mock/placeholder code for gated platforms.
 * Looks structurally correct but contains redacted values.
 * This is what free-tier users see in the DOM — real code never touches the DOM.
 */
function generateMockCode(platform, eventName) {
  const mock = {
    content_type: 'product',
    content_ids: ['XXXXX', 'XXXXX'],
    content_name: '••••••••••',
    currency: '•••',
    value: 0.00,
    num_items: 0,
  };

  switch (platform) {
    case 'meta':
      return `fbq('track', '${eventName}', ${JSON.stringify(mock, null, 2)});`;
    case 'tiktok':
      return `ttq.track('${eventName}', ${JSON.stringify(mock, null, 2)});`;
    case 'pinterest':
      return `pintrk('track', '${eventName}', ${JSON.stringify(mock, null, 2)});`;
    default:
      return `// ${eventName} — upgrade to view full code`;
  }
}

export function renderEventGenerator(container, state, actions) {
  const events = state.generatedEvents || {};
  const activePlatforms = state.activePlatforms || ['ga4', 'meta', 'tiktok', 'pinterest'];
  const capabilities = state.capabilities;
  const supportedPlatforms = capabilities?.supportedPlatforms || ['ga4'];
  const detectedCMS = state.cms?.cms || 'unknown';

  // Check CMS support
  const cmsSupported = !capabilities || capabilities.supportedCMS.includes(detectedCMS) || detectedCMS === 'unknown';

  // Platforms that get a blurred preview in free (not fully locked)
  const isFreeUser = capabilities?.plan === 'free';
  const previewPlatforms = ['meta']; // Meta: visible but blurred in free

  // Render platform toggles — show all platforms, mark unsupported ones
  // Meta is NOT locked for free users (shown as preview), only TikTok/Pinterest are locked
  const toggles = Object.keys(PLATFORM_LABELS)
    .map((platform) => {
      const isActive = activePlatforms.includes(platform);
      const isSupported = supportedPlatforms.includes(platform);
      const isPreview = isFreeUser && previewPlatforms.includes(platform);
      const isLocked = !isSupported && !isPreview;
      return `
      <button
        class="tp-platform-toggle ${isActive && (isSupported || isPreview) ? 'active' : ''} ${isLocked ? 'locked' : ''}"
        data-platform="${platform}"
        data-locked="${isLocked}"
        style="${isActive && (isSupported || isPreview) ? `border-color: ${PLATFORM_COLORS[platform]}40; color: ${PLATFORM_COLORS[platform]};` : ''}
               ${isLocked ? 'opacity: 0.5; cursor: pointer;' : ''}"
        title="${isLocked ? `${PLATFORM_LABELS[platform]} — requires upgrade` : PLATFORM_LABELS[platform]}"
      >
        ${platformIconHtml(platform, 14)}
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
  // Meta in free: goes into allEvents (blurred preview, not locked card)
  // TikTok/Pinterest in free: stay in lockedPlatformEvents (opaque locked cards)
  const allEvents = [];
  const lockedPlatformEvents = [];

  for (const platform of activePlatforms) {
    const platformEvents = events[platform] || [];
    const isPreviewPlatform = isFreeUser && previewPlatforms.includes(platform);
    if (supportedPlatforms.includes(platform) || isPreviewPlatform) {
      for (const event of platformEvents) {
        allEvents.push(event);
      }
    } else {
      // Show locked cards for unsupported platforms (TikTok, Pinterest)
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

  // Build Quick Push section HTML (now placed BELOW event cards)
  let quickPushHtml = '';
  if (syntheticEvents.length > 0) {
    if (!capabilities?.canPushEvents) {
      // Locked state for non-Pro users
      quickPushHtml = `
        <div class="tp-quick-push-section locked" style="margin-top: 4px;">
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
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
            <span style="font-size: 11px; color: var(--tp-text-secondary);">Target:</span>
            <select id="quick-push-target" class="tp-target-select">
              <option value="top" ${quickPushTarget === 'top' ? 'selected' : ''}>dataLayer (top)</option>
              ${frameOptions}
            </select>
          </div>
        `;
      }

      // Build expandable code preview cards for each synthetic event
      const syntheticCards = syntheticEvents.map((evt, i) => {
        const jsonPreview = JSON.stringify(evt.data, null, 2);
        const highlighted = syntaxHighlight(jsonPreview);

        return `
          <div class="tp-synthetic-card" data-synthetic-index="${i}">
            <div class="tp-synthetic-card-header" data-toggle-code="${i}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px;">&#9889;</span>
                <span style="font-size: 12px; font-weight: 600; color: var(--tp-text);">${escapeHtml(evt.eventName)}</span>
              </div>
              <button class="tp-btn tp-btn-sm tp-btn-primary" data-push-index="${i}" style="padding: 4px 12px;">
                Push
              </button>
            </div>
            <div style="padding: 0 14px;">
              <div class="tp-synthetic-code-preview" id="synthetic-code-${i}">
                <div class="code-block" style="margin: 0; border-radius: 6px; font-size: 10.5px;">${highlighted}</div>
                <div class="tp-synthetic-code-fade"></div>
              </div>
            </div>
            <div class="tp-synthetic-actions">
              <button class="tp-btn tp-btn-sm" data-expand-index="${i}" style="font-size: 10px; padding: 3px 8px;">
                Show more
              </button>
              <button class="tp-btn tp-btn-sm" data-copy-index="${i}" style="font-size: 10px; padding: 3px 8px;">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
                Copy
              </button>
            </div>
          </div>
        `;
      }).join('');

      quickPushHtml = `
        <div class="tp-playground-section">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--tp-text);">
              &#9889; Quick Push
            </span>
            <span style="font-size: 10px; color: var(--tp-text-muted);">Synthetic events</span>
          </div>
          ${targetSelector}
          ${syntheticCards}
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

  // Layout: Platform toggles → Data Summary → CMS Gate → Event Cards → Quick Push (moved below)
  container.innerHTML = `
    <div class="p-3 flex gap-2 flex-wrap border-b border-tp-border">
      ${toggles}
    </div>
    ${dataSummary}
    <div id="cms-gate-banner"></div>
    <div id="event-cards-container">
      ${eventsHtml}
    </div>
    ${quickPushHtml}
    <div class="h-4"></div>
  `;

  // Show CMS gate banner if needed
  if (!cmsSupported) {
    const bannerEl = container.querySelector('#cms-gate-banner');
    renderCMSGateBanner(bannerEl, detectedCMS, capabilities.supportedCMS);
  }

  // Bind Quick Push expandable card interactions
  if (syntheticEvents.length > 0 && capabilities?.canPushEvents) {
    // Push buttons
    container.querySelectorAll('[data-push-index]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.pushIndex);
        const evt = syntheticEvents[index];
        if (evt) {
          const target = state.quickPushTarget || 'top';
          actions.pushSyntheticEvent(evt.code, target);
          const originalText = btn.textContent;
          btn.textContent = 'Pushed!';
          btn.style.background = 'var(--tp-success)';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
          }, 800);
        }
      });
    });

    // Expand/collapse buttons
    container.querySelectorAll('[data-expand-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = btn.dataset.expandIndex;
        const preview = container.querySelector(`#synthetic-code-${index}`);
        if (preview) {
          const isExpanded = preview.classList.contains('expanded');
          preview.classList.toggle('expanded');
          btn.textContent = isExpanded ? 'Show more' : 'Show less';
        }
      });
    });

    // Header toggle (expand/collapse code)
    container.querySelectorAll('[data-toggle-code]').forEach((header) => {
      header.addEventListener('click', (e) => {
        // Don't toggle when clicking the push button inside the header
        if (e.target.closest('[data-push-index]')) return;
        const index = header.dataset.toggleCode;
        const preview = container.querySelector(`#synthetic-code-${index}`);
        if (preview) {
          preview.classList.toggle('expanded');
          const expandBtn = container.querySelector(`[data-expand-index="${index}"]`);
          if (expandBtn) {
            expandBtn.textContent = preview.classList.contains('expanded') ? 'Show less' : 'Show more';
          }
        }
      });
    });

    // Copy buttons
    container.querySelectorAll('[data-copy-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.copyIndex);
        const evt = syntheticEvents[index];
        if (evt) {
          actions.copyCode(evt.code);
        }
      });
    });

    // Target selector
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
  const isFree = capabilities?.plan === 'free';
  const isGatedPlatform = isFree && event.platform !== 'ga4';

  // For gated platforms: render mock code in DOM, never expose real code
  const displayCode = isGatedPlatform
    ? generateMockCode(event.platform, event.eventName)
    : event.code;
  const highlighted = syntaxHighlight(displayCode);
  const escapedCode = escapeHtml(displayCode);

  // Create card element
  const card = document.createElement('div');
  card.className = 'tp-event-card animate-slide-in';

  // Header
  const header = document.createElement('div');
  header.className = 'tp-event-header';
  const cardIcon = platformIconHtml(event.platform, 14);
  header.innerHTML = `
    <div class="flex items-center gap-2">
      ${cardIcon}
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
  codeBlock.style.userSelect = 'none';
  codeBlock.style.webkitUserSelect = 'none';
  codeBlock.innerHTML = highlighted;
  body.appendChild(codeBlock);

  // If FREE plan + gated platform: apply blur paywall over mock code
  // Real code is never in the DOM — the blur is purely a visual indicator
  if (isGatedPlatform) {
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
  const lockedIcon = platformIconHtml(event.platform, 14, 'opacity: 0.5;');
  card.innerHTML = `
    <div class="tp-event-header" style="opacity: 0.7;">
      <div class="flex items-center gap-2">
        ${lockedIcon}
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
