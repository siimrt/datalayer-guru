/**
 * EventGenerator Component — Shows generated events grouped by platform.
 * V2.1: All platforms visible for all users. Only Copy/Push are gated (Pro).
 * Quick Push: Expandable code preview cards below event cards.
 */

import { syntaxHighlight, escapeHtml } from '../../shared/utils.js';
import { platformIconHtml } from '../../shared/platform-icons.js';
import { renderDataExtracted } from './DataExtracted.js';
import { renderLockedButton } from './Paywall.js';
import { trackEvent } from '../../shared/analytics.js';
import { getSyntheticEvents } from '../../content/generators/synthetic-events.js';
import { PLATFORM_LABELS as _PLAT_LABELS } from '../../shared/constants.js';

// Override 'meta' label to 'Meta Pixel' for event generation context
const PLATFORM_LABELS = { ..._PLAT_LABELS, meta: 'Meta Pixel' };

// Track which event cards are expanded (persists across re-renders, resets on page navigation)
const expandedCards = new Set();

export function resetEventGeneratorState() {
  expandedCards.clear();
}

const PLATFORM_COLORS = {
  ga4: '#4285F4',
  meta: '#1877F2',
  tiktok: '#69C9D0',
  pinterest: '#E60023',
  snapchat: '#FFFC00',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
};

export function renderEventGenerator(container, state, actions) {
  const events = state.generatedEvents || {};
  const detectedPlatforms = state.detectedPlatforms || new Set(['ga4']);
  const activePlatforms = state.activePlatforms || [...detectedPlatforms];
  const capabilities = state.capabilities;

  // Render platform toggles — all platforms visible, no locking
  const toggles = Object.keys(PLATFORM_LABELS)
    .filter((platform) => detectedPlatforms.has(platform))
    .map((platform) => {
      const isActive = activePlatforms.includes(platform);
      return `
      <button
        class="tp-platform-toggle ${isActive ? 'active' : ''}"
        data-platform="${platform}"
        title="${PLATFORM_LABELS[platform]}"
      >
        ${platformIconHtml(platform, 14)}
        ${PLATFORM_LABELS[platform]}
      </button>
    `;
    })
    .join('');

  // Render extracted data summary (always available)
  const dataSummary = renderDataExtracted(
    state.ecommerceData,
    state.pageType?.pageType
  );

  // Collect all events for active platforms (all visible now)
  const allEvents = [];
  for (const platform of activePlatforms) {
    const platformEvents = events[platform] || [];
    for (const event of platformEvents) {
      allEvents.push(event);
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
      // Locked state for Free users
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

  if (allEvents.length === 0) {
    eventsHtml = `
      <div class="tp-empty">
        <div class="tp-empty-icon">&#128269;</div>
        <p>No events generated for this page</p>
        <p class="text-[11px] mt-1">This may be a non-ecommerce page</p>
      </div>
    `;
  }

  // Intro hint for new/free users with events
  const showIntroHint = capabilities?.plan === 'free' && allEvents.length > 0;
  const introHintHtml = showIntroHint ? `
    <div style="
      padding: 8px 12px; margin: 0 12px 4px; border-radius: 8px;
      background: rgba(0, 109, 119, 0.06); font-size: 11px;
      color: var(--tp-text-secondary); line-height: 1.4;
    ">
      Ready-to-use tracking events for your site. Copy them into Google Tag Manager or your tag management system.
    </div>
  ` : '';

  // Layout: Platform toggles → Intro → Data Summary → Event Cards → Quick Push
  container.innerHTML = `
    <div class="p-3 flex gap-2 flex-wrap border-b border-tp-border">
      ${toggles}
    </div>
    ${introHintHtml}
    ${dataSummary}
    <div id="event-cards-container">
      ${eventsHtml}
    </div>
    ${quickPushHtml}
    <div class="h-4"></div>
  `;

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

  // Render event cards (all visible, Copy/Push gated)
  const cardsContainer = container.querySelector('#event-cards-container');

  allEvents.forEach((event, index) => {
    const card = createEventCard(event, index, index > 0, capabilities, actions);
    cardsContainer.appendChild(card);
  });

  // Bind platform toggles — all clickable now, no locked state
  container.querySelectorAll('.tp-platform-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const platform = btn.dataset.platform;
      const willBeEnabled = !state.activePlatforms.includes(platform);
      trackEvent('platform_toggled', {
        platform,
        enabled: willBeEnabled,
      });
      actions.togglePlatform(platform);
    });
  });
}

function createEventCard(event, index, _collapsed, capabilities, actions) {
  const cardKey = `${event.platform}:${event.eventName}`;
  // Use expandedCards set for state; default first card open
  const collapsed = expandedCards.size === 0 && index === 0 ? false
    : !expandedCards.has(cardKey);

  const platformLabel = PLATFORM_LABELS[event.platform] || event.platform;
  const platformColor = PLATFORM_COLORS[event.platform] || '#006d77';

  // All code is visible — no mock code, no blur
  const highlighted = syntaxHighlight(event.code);
  const escapedCode = escapeHtml(event.code);

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

  // Code block — visible to all users
  const codeBlock = document.createElement('div');
  codeBlock.className = 'code-block';
  // Code is readable by all — the paywall is the Copy button, not text selection
  codeBlock.innerHTML = highlighted;
  body.appendChild(codeBlock);

  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tp-event-actions';

  // COPY button — Pro users get unlimited, Free users get trial copies
  const hasFreeCopies = !capabilities?.canCopyEvents && (capabilities?.plan === 'free') && (state.freeCopiesRemaining > 0);
  if (capabilities?.canCopyEvents || hasFreeCopies) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tp-btn tp-btn-sm';
    copyBtn.dataset.action = 'copy';
    const trialLabel = hasFreeCopies ? ` (${state.freeCopiesRemaining} left)` : '';
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/></svg>
      Copy${trialLabel}
    `;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const originalHtml = copyBtn.innerHTML;
      actions.copyCode(escapedCode);
      // Visual feedback
      copyBtn.classList.add('copy-success');
      copyBtn.innerHTML = '&#10003; Copied!';
      setTimeout(() => {
        copyBtn.classList.remove('copy-success');
        copyBtn.innerHTML = originalHtml;
      }, 1200);
    });
    actionsDiv.appendChild(copyBtn);
  } else {
    renderLockedButton(actionsDiv, 'Copy', 'eventCopy', 'pro');
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
    // Persist state
    if (isHidden) {
      expandedCards.add(cardKey);
      trackEvent('event_card_expanded', {
        platform: event.platform,
        eventName: event.eventName,
      });
    } else {
      expandedCards.delete(cardKey);
    }
  });

  return card;
}
