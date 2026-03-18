/**
 * SettingsPanel Component — Shows account info, plan management, usage stats, and theme toggle.
 */

import { renderPlanBadge } from './PlanBadge.js';
import { PLAN_CONFIG } from '../../shared/plans.js';
import { trackEvent } from '../../shared/analytics.js';
import { CANONICAL_EVENTS, CANONICAL_EVENTS_LEADGEN } from '../../shared/canonical-audit.js';

// Dev/admin mode: show debug info only when extension is loaded unpacked (no update_url)
function isDevMode() {
  try {
    const manifest = chrome.runtime.getManifest();
    return !manifest.update_url;
  } catch (e) { return false; }
}

const CAPI_PLATFORMS = [
  { key: 'meta', label: 'Meta', default: 'meta_capi_' },
  { key: 'tiktok', label: 'TikTok', default: 'tiktok_capi_' },
  { key: 'pinterest', label: 'Pinterest', default: 'pinterest_capi_' },
  { key: 'snapchat', label: 'Snapchat', default: 'snapchat_capi_' },
  { key: 'linkedin', label: 'LinkedIn', default: 'linkedin_capi_' },
  { key: 'google_ads', label: 'Google Ads', default: 'gads_capi_' },
];

/**
 * Collect all canonical events relevant to a given platform key.
 * Returns an array of { canonicalKey, platformEventName, label }.
 */
function getEventsForPlatform(platformKey) {
  const allCanonical = { ...CANONICAL_EVENTS, ...CANONICAL_EVENTS_LEADGEN };
  const events = [];
  for (const [canonicalKey, def] of Object.entries(allCanonical)) {
    const platformEventName = def.platforms[platformKey];
    if (platformEventName) {
      events.push({ canonicalKey, platformEventName, label: def.label });
    }
  }
  return events;
}

// Track which CAPI platform sub-accordions are expanded (persists within session)
const expandedCapiPlatforms = new Set();

function renderCapiPatternRows(capiPatterns, capiOverrides) {
  const patterns = capiPatterns || {};
  const overrides = capiOverrides || {};

  return CAPI_PLATFORMS.map(p => {
    const prefix = patterns[p.key] || p.default;
    const events = getEventsForPlatform(p.key);
    const platformOverrides = overrides[p.key] || {};
    const isExpanded = expandedCapiPlatforms.has(p.key);
    const hasOverrides = Object.keys(platformOverrides).length > 0;

    const eventRowsHtml = events.map(ev => {
      const defaultName = prefix + ev.platformEventName;
      const overriddenName = platformOverrides[ev.platformEventName] || '';
      const displayValue = overriddenName || defaultName;
      const isOverridden = !!overriddenName;
      return `
        <div style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
          <span style="color: var(--tp-text-secondary); font-size: 11px; min-width: 100px; flex-shrink: 0;">${ev.label}</span>
          ${isOverridden ? '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--tp-primary); flex-shrink: 0;" title="Custom override"></span>' : '<span style="width: 6px; flex-shrink: 0;"></span>'}
          <input type="text" data-capi-event-platform="${p.key}" data-capi-event-name="${ev.platformEventName}" value="${displayValue}" placeholder="${defaultName}" style="
            background: var(--tp-surface-hover); color: var(--tp-text); border: 1px solid var(--tp-border);
            border-radius: 6px; padding: 3px 6px; font-size: 11px; font-family: monospace; flex: 1; min-width: 0;
          " />
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--tp-text); font-size: 12px; font-weight: 500; min-width: 80px;">${p.label}</span>
            ${hasOverrides ? '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--tp-primary); flex-shrink: 0;" title="Has custom overrides"></span>' : ''}
            <input type="text" data-capi-key="${p.key}" value="${prefix}" style="
              background: var(--tp-surface-hover); color: var(--tp-text); border: 1px solid var(--tp-border);
              border-radius: 6px; padding: 4px 8px; font-size: 11px; font-family: monospace; width: 140px;
            " />
          </div>
          <span data-capi-platform-toggle="${p.key}" style="cursor: pointer; font-size: 14px; color: var(--tp-text-muted); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; user-select: none; border-radius: 4px; transition: background 0.15s;" title="Customize per-event names">${isExpanded ? '▾' : '▸'}</span>
        </div>
        <div data-capi-platform-body="${p.key}" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 6px; padding-left: 12px; border-left: 2px solid var(--tp-primary);">
          ${eventRowsHtml}
          <div style="text-align: right; margin-top: 6px;">
            <button data-capi-reset="${p.key}" style="
              background: none; border: none; color: var(--tp-text-muted); font-size: 11px;
              cursor: pointer; text-decoration: underline; padding: 2px 4px;
            ">Reset to defaults</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

export function renderSettingsPanel(container, state, actions) {
  const plan = state.plan || 'free';
  const email = state.userEmail;
  const capabilities = state.capabilities;
  const isDark = document.documentElement.classList.contains('dark');
  const autoSwitch = state.autoSwitchTab || false;
  const autoReload = state.autoReload !== undefined ? state.autoReload : true;
  const showDebug = isDevMode();
  const version = chrome.runtime.getManifest().version;

  container.innerHTML = `
    <div style="padding: 16px;">
      <!-- Appearance Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Appearance</h3>
        <div class="tp-theme-toggle">
          <button id="theme-light" class="${!isDark ? 'active' : ''}">&#9728; Light</button>
          <button id="theme-dark" class="${isDark ? 'active' : ''}">&#9790; Dark</button>
        </div>
      </div>

      <!-- Behavior Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Behavior</h3>
        <div style="
          background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <div style="color: var(--tp-text); font-size: 12px; font-weight: 500;">Auto-switch on tab change</div>
              <div style="color: var(--tp-text-muted); font-size: 11px; margin-top: 2px;">Reload detection when switching browser tabs</div>
            </div>
            <label class="tp-switch">
              <input type="checkbox" id="auto-switch-tab" ${autoSwitch ? 'checked' : ''} />
              <span class="tp-switch-slider"></span>
            </label>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <div style="color: var(--tp-text); font-size: 12px; font-weight: 500;">Auto-reload on open</div>
              <div style="color: var(--tp-text-muted); font-size: 11px; margin-top: 2px;">Reload the page when sidepanel opens on an already-loaded page</div>
            </div>
            <label class="tp-switch">
              <input type="checkbox" id="auto-reload-toggle" ${autoReload ? 'checked' : ''} />
              <span class="tp-switch-slider"></span>
            </label>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: var(--tp-text); font-size: 12px; font-weight: 500;">Site Type Override</div>
              <div style="color: var(--tp-text-muted); font-size: 11px; margin-top: 2px;">Force ecommerce or lead gen mode</div>
            </div>
            <select id="site-type-override" style="
              background: var(--tp-surface-hover); color: var(--tp-text); border: 1px solid var(--tp-border);
              border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;
            ">
              <option value="" ${!state.siteTypeOverride ? 'selected' : ''}>Auto-detect</option>
              <option value="ecommerce" ${state.siteTypeOverride === 'ecommerce' ? 'selected' : ''}>Ecommerce</option>
              <option value="leadgen" ${state.siteTypeOverride === 'leadgen' ? 'selected' : ''}>Lead Gen</option>
              <option value="hybrid" ${state.siteTypeOverride === 'hybrid' ? 'selected' : ''}>Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Server-Side (CAPI) Patterns -->
      <div style="margin-bottom: 24px;">
        <div style="background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);">
          <div id="capi-accordion-toggle" style="
            display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
            color: var(--tp-text); font-size: 14px;
          ">
            <span id="capi-arrow" style="font-size: 10px; width: 10px;">&#9656;</span>
            <h3 style="margin: 0; font-size: 14px;">Server-Side (CAPI) Patterns</h3>
            <span id="capi-tooltip-wrapper" style="position: relative; display: inline-flex; align-items: center; justify-content: center;">
              <span id="capi-tooltip-trigger" style="
                font-size: 12px; color: var(--tp-text-muted); cursor: help;
                border: 1px solid var(--tp-border); border-radius: 50%; width: 16px; height: 16px;
                display: inline-flex; align-items: center; justify-content: center;
              ">i</span>
              <div class="tp-capi-tooltip" style="
                display: none; position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
                background: var(--tp-surface-hover); color: var(--tp-text); border: 1px solid var(--tp-border);
                border-radius: 8px; padding: 10px 12px; font-size: 11px; line-height: 1.5;
                width: 280px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                pointer-events: none;
              ">To detect server-side events sent via sGTM, configure the naming prefix for your CAPI events. Best practice: name your events {platform}_capi_{event} (e.g. meta_capi_Purchase). This allows Traacky to link a client-side event with its server-side counterpart.</div>
            </span>
          </div>
          <div id="capi-accordion-content" style="display: none; margin-top: 12px;">
            <div style="display: grid; gap: 8px;">
              ${renderCapiPatternRows(state.capiPatterns, state.capiOverrides)}
            </div>
          </div>
        </div>
      </div>

      <!-- Account Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Account</h3>
        <div style="
          background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: var(--tp-text-secondary); font-size: 12px;">Plan</span>
            <span id="settings-plan-badge"></span>
          </div>
          ${email ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--tp-text-secondary); font-size: 12px;">Email</span>
            <span style="color: var(--tp-text); font-size: 12px;">${email}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Upgrade / Manage Section -->
      <div style="margin-bottom: 24px;">
        ${plan === 'free' ? `
          <button id="settings-upgrade-btn" style="
            background: var(--tp-primary); color: white; border: none;
            padding: 10px 0; border-radius: 8px; width: 100%;
            font-size: 14px; font-weight: 600; cursor: pointer;
            transition: all 0.2s;
          ">&#9889; View Plans &amp; Pricing</button>
          <div style="text-align: center; margin-top: 8px;">
            <span style="color: var(--tp-text-muted); font-size: 11px;">Cancel anytime &middot; 30-day guarantee</span>
          </div>
        ` : `
          <button id="settings-manage-btn" style="
            background: var(--tp-surface); color: var(--tp-text-secondary); border: 1px solid var(--tp-border);
            padding: 10px 0; border-radius: 8px; width: 100%;
            font-size: 13px; cursor: pointer; transition: all 0.2s;
          ">Manage Subscription</button>
          <button id="settings-view-plans-btn" style="
            background: none; border: none; color: var(--tp-text-muted);
            font-size: 12px; cursor: pointer; width: 100%; padding: 8px 0;
            text-decoration: underline; transition: color 0.2s;
          ">View Plans &amp; Pricing</button>
        `}
      </div>

      <!-- Restore License -->
      <div style="margin-bottom: 16px;">
        <button id="settings-restore-license" style="
          background: var(--tp-surface); color: var(--tp-text-secondary); border: 1px solid var(--tp-border);
          padding: 8px 0; border-radius: 8px; width: 100%;
          font-size: 12px; cursor: pointer; transition: all 0.2s;
        ">Restore license on this browser</button>
        <div style="text-align: center; margin-top: 4px;">
          <span style="color: var(--tp-text-muted); font-size: 11px;">Already paid on another device? Click to link your subscription.</span>
        </div>
      </div>

      <!-- Usage Stats (Starter+) -->
      ${plan !== 'free' ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Usage This Month</h3>
        <div id="usage-stats" style="
          background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);
        ">
          <div style="color: var(--tp-text-secondary); font-size: 12px;">Loading...</div>
        </div>
      </div>
      ` : ''}


      <!-- Debug Info (admin/dev mode only) -->
      ${showDebug && state.planDebug ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">ExtensionPay Debug</h3>
        <div style="
          background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);
          font-family: monospace; font-size: 11px; color: var(--tp-text-secondary); line-height: 1.8;
        ">
          <div>paid: <span style="color: ${state.planDebug.userPaid ? 'var(--tp-success)' : 'var(--tp-error)'};">${String(state.planDebug.userPaid)}</span></div>
          <div>subscriptionStatus: <span style="color: #5B9BD5;">${state.planDebug.subscriptionStatus || 'null'}</span></div>
          <div>subscriptionPlanId: <span style="color: #D4A017;">${state.planDebug.subscriptionPlanId || 'null'}</span></div>
          <div>storedPlan: <span style="color: var(--tp-success);">${state.planDebug.storedPlan || 'null'}</span></div>
          <div>paidAt: <span style="color: var(--tp-text);">${state.planDebug.paidAt || 'null'}</span></div>
          <div>resolvedPlan: <span style="color: var(--tp-primary); font-weight: bold;">${plan}</span></div>
          ${state.planDebug.allKeys ? `<div>userKeys: <span style="color: var(--tp-text-secondary);">${state.planDebug.allKeys.join(', ')}</span></div>` : ''}
          ${state.planDebug.source ? `<div>source: <span style="color: #D4A017;">${state.planDebug.source}</span></div>` : ''}
          ${state.planDebug.error ? `<div>error: <span style="color: var(--tp-error);">${state.planDebug.error}</span></div>` : ''}
        </div>
        <button id="settings-force-refresh" style="
          margin-top: 8px; background: var(--tp-surface-hover); color: var(--tp-text-secondary); border: 1px solid var(--tp-border);
          padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;
        ">&#8635; Debug: Force Refresh Plan</button>
      </div>
      ` : ''}

      <!-- Help & Feedback -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Help &amp; Feedback</h3>
        <div style="display: flex; gap: 8px;">
          <a id="settings-support-btn" href="mailto:support@traacky.com" style="
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            background: var(--tp-surface); color: var(--tp-text-secondary); border: 1px solid var(--tp-border);
            padding: 10px 0; border-radius: 8px; font-size: 12px; font-weight: 500;
            cursor: pointer; text-decoration: none; transition: all 0.2s;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Support
          </a>
          <a id="settings-roadmap-btn" href="https://traacky.featurebase.app" target="_blank" style="
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            background: var(--tp-surface); color: var(--tp-text-secondary); border: 1px solid var(--tp-border);
            padding: 10px 0; border-radius: 8px; font-size: 12px; font-weight: 500;
            cursor: pointer; text-decoration: none; transition: all 0.2s;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Roadmap
          </a>
        </div>
      </div>

      <!-- About -->
      <div>
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">About</h3>
        <div style="color: var(--tp-text-secondary); font-size: 12px; line-height: 1.6;">
          Traacky v${version}<br>
          Made for tracking professionals
        </div>
      </div>
    </div>
  `;

  // Render plan badge
  const badgeContainer = container.querySelector('#settings-plan-badge');
  if (badgeContainer) {
    renderPlanBadge(badgeContainer, plan);
  }

  // Theme toggle
  container.querySelector('#theme-light')?.addEventListener('click', () => {
    if (actions.toggleTheme) actions.toggleTheme('light');
  });
  container.querySelector('#theme-dark')?.addEventListener('click', () => {
    if (actions.toggleTheme) actions.toggleTheme('dark');
  });

  // Upgrade button — navigates to pricing page
  const upgradeBtn = container.querySelector('#settings-upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      if (actions?.navigateToPricing) actions.navigateToPricing();
    });
    upgradeBtn.addEventListener('mouseenter', () => { upgradeBtn.style.background = '#005a63'; });
    upgradeBtn.addEventListener('mouseleave', () => { upgradeBtn.style.background = 'var(--tp-primary)'; });
  }

  // Manage button
  const manageBtn = container.querySelector('#settings-manage-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      trackEvent('manage_subscription_clicked', { plan: state.plan || 'free' });
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_MANAGEMENT' });
    });
    manageBtn.addEventListener('mouseenter', () => { manageBtn.style.borderColor = 'var(--tp-primary)'; });
    manageBtn.addEventListener('mouseleave', () => { manageBtn.style.borderColor = 'var(--tp-border)'; });
  }

  // View Plans button (paid users)
  const viewPlansBtn = container.querySelector('#settings-view-plans-btn');
  if (viewPlansBtn) {
    viewPlansBtn.addEventListener('click', () => {
      if (actions?.navigateToPricing) actions.navigateToPricing();
    });
    viewPlansBtn.addEventListener('mouseenter', () => { viewPlansBtn.style.color = 'var(--tp-primary)'; });
    viewPlansBtn.addEventListener('mouseleave', () => { viewPlansBtn.style.color = 'var(--tp-text-muted)'; });
  }

  // Restore license button
  const restoreBtn = container.querySelector('#settings-restore-license');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      restoreBtn.textContent = 'Opening login page...';
      restoreBtn.disabled = true;
      trackEvent('restore_license_clicked', { plan: state.plan || 'free' });
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_RESTORE_LICENSE' });
      // After 10s, check if the plan has been restored
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' }, (resp) => {
          const newPlan = resp?.plan || 'free';
          if (newPlan !== 'free') {
            restoreBtn.textContent = 'License restored!';
            restoreBtn.style.color = 'var(--tp-success)';
            restoreBtn.style.borderColor = 'var(--tp-success)';
            setTimeout(() => window.location.reload(), 1500);
          } else {
            restoreBtn.textContent = 'Restore license on this browser';
            restoreBtn.disabled = false;
          }
        });
      }, 10000);
    });
    restoreBtn.addEventListener('mouseenter', () => { restoreBtn.style.borderColor = 'var(--tp-primary)'; });
    restoreBtn.addEventListener('mouseleave', () => { restoreBtn.style.borderColor = 'var(--tp-border)'; });
  }

  // Site type override
  const siteTypeSelect = container.querySelector('#site-type-override');
  if (siteTypeSelect) {
    siteTypeSelect.addEventListener('change', (e) => {
      if (actions.setSiteTypeOverride) actions.setSiteTypeOverride(e.target.value);
    });
  }

  // Auto-switch tab toggle
  const autoSwitchCheckbox = container.querySelector('#auto-switch-tab');
  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.addEventListener('change', (e) => {
      if (actions.toggleAutoSwitchTab) actions.toggleAutoSwitchTab(e.target.checked);
    });
  }

  // Auto-reload toggle
  const autoReloadCheckbox = container.querySelector('#auto-reload-toggle');
  if (autoReloadCheckbox) {
    autoReloadCheckbox.addEventListener('change', (e) => {
      if (actions.toggleAutoReload) actions.toggleAutoReload(e.target.checked);
    });
  }

  // CAPI accordion toggle
  const capiToggle = container.querySelector('#capi-accordion-toggle');
  const capiContent = container.querySelector('#capi-accordion-content');
  const capiArrow = container.querySelector('#capi-arrow');
  if (capiToggle && capiContent) {
    capiToggle.addEventListener('click', (e) => {
      if (e.target.id === 'capi-tooltip-trigger' || e.target.closest('#capi-tooltip-wrapper')) return;
      const isHidden = capiContent.style.display === 'none';
      capiContent.style.display = isHidden ? 'block' : 'none';
      if (capiArrow) capiArrow.innerHTML = isHidden ? '&#9662;' : '&#9656;';
    });
  }

  // CAPI tooltip hover
  const tooltipWrapper = container.querySelector('#capi-tooltip-wrapper');
  const tooltipDiv = container.querySelector('.tp-capi-tooltip');
  if (tooltipWrapper && tooltipDiv) {
    tooltipWrapper.addEventListener('mouseenter', () => { tooltipDiv.style.display = 'block'; });
    tooltipWrapper.addEventListener('mouseleave', () => { tooltipDiv.style.display = 'none'; });
  }

  // CAPI pattern prefix inputs — propagate to non-overridden event inputs
  container.querySelectorAll('[data-capi-key]').forEach(input => {
    input.addEventListener('change', () => {
      const platformKey = input.dataset.capiKey;
      const newPrefix = input.value;
      const patterns = { ...(state.capiPatterns || {}) };
      patterns[platformKey] = newPrefix;
      if (actions.setCapiPatterns) actions.setCapiPatterns(patterns);

      // Update visible event inputs that are not manually overridden
      const overrides = (state.capiOverrides || {})[platformKey] || {};
      container.querySelectorAll(`[data-capi-event-platform="${platformKey}"]`).forEach(evInput => {
        const evName = evInput.dataset.capiEventName;
        if (!overrides[evName]) {
          evInput.value = newPrefix + evName;
        }
      });
    });
  });

  // CAPI platform sub-accordion toggles
  container.querySelectorAll('[data-capi-platform-toggle]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const platformKey = toggle.dataset.capiPlatformToggle;
      const body = container.querySelector(`[data-capi-platform-body="${platformKey}"]`);
      if (!body) return;
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      toggle.textContent = isHidden ? '▾' : '▸';
      if (isHidden) {
        expandedCapiPlatforms.add(platformKey);
      } else {
        expandedCapiPlatforms.delete(platformKey);
      }
    });
  });

  // CAPI per-event name inputs
  container.querySelectorAll('[data-capi-event-platform]').forEach(input => {
    input.addEventListener('change', () => {
      const platformKey = input.dataset.capiEventPlatform;
      const eventName = input.dataset.capiEventName;
      const prefix = (state.capiPatterns || {})[platformKey] || CAPI_PLATFORMS.find(p => p.key === platformKey)?.default || '';
      const defaultName = prefix + eventName;
      const newValue = input.value.trim();

      const allOverrides = { ...(state.capiOverrides || {}) };
      if (!allOverrides[platformKey]) allOverrides[platformKey] = {};

      if (newValue === defaultName || newValue === '') {
        // Remove override if it matches default
        delete allOverrides[platformKey][eventName];
        if (Object.keys(allOverrides[platformKey]).length === 0) delete allOverrides[platformKey];
        input.value = defaultName;
      } else {
        allOverrides[platformKey] = { ...allOverrides[platformKey], [eventName]: newValue };
      }

      if (actions.setCapiOverrides) actions.setCapiOverrides(allOverrides);

      // Update override dot indicator
      const dotSpan = input.previousElementSibling;
      if (dotSpan && dotSpan.style) {
        const isOverridden = !!(allOverrides[platformKey] && allOverrides[platformKey][eventName]);
        if (isOverridden) {
          dotSpan.style.width = '6px';
          dotSpan.style.height = '6px';
          dotSpan.style.borderRadius = '50%';
          dotSpan.style.background = 'var(--tp-primary)';
        } else {
          dotSpan.style.background = 'none';
        }
      }
    });
  });

  // CAPI reset to defaults buttons
  container.querySelectorAll('[data-capi-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const platformKey = btn.dataset.capiReset;
      const prefix = (state.capiPatterns || {})[platformKey] || CAPI_PLATFORMS.find(p => p.key === platformKey)?.default || '';

      // Remove all overrides for this platform
      const allOverrides = { ...(state.capiOverrides || {}) };
      delete allOverrides[platformKey];
      if (actions.setCapiOverrides) actions.setCapiOverrides(allOverrides);

      // Reset all event inputs to default values
      container.querySelectorAll(`[data-capi-event-platform="${platformKey}"]`).forEach(evInput => {
        evInput.value = prefix + evInput.dataset.capiEventName;
        // Clear override dot
        const dotSpan = evInput.previousElementSibling;
        if (dotSpan && dotSpan.style) {
          dotSpan.style.background = 'none';
        }
      });
    });
  });

  // Support & Roadmap hover effects + external link handling
  const supportBtn = container.querySelector('#settings-support-btn');
  if (supportBtn) {
    supportBtn.addEventListener('mouseenter', () => { supportBtn.style.borderColor = 'var(--tp-primary)'; supportBtn.style.color = 'var(--tp-primary)'; });
    supportBtn.addEventListener('mouseleave', () => { supportBtn.style.borderColor = 'var(--tp-border)'; supportBtn.style.color = 'var(--tp-text-secondary)'; });
  }
  const roadmapBtn = container.querySelector('#settings-roadmap-btn');
  if (roadmapBtn) {
    roadmapBtn.addEventListener('mouseenter', () => { roadmapBtn.style.borderColor = 'var(--tp-primary)'; roadmapBtn.style.color = 'var(--tp-primary)'; });
    roadmapBtn.addEventListener('mouseleave', () => { roadmapBtn.style.borderColor = 'var(--tp-border)'; roadmapBtn.style.color = 'var(--tp-text-secondary)'; });
    roadmapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://traacky.featurebase.app' });
    });
  }

  // Force refresh button
  const refreshBtn = container.querySelector('#settings-force-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.textContent = 'Refreshing...';
      refreshBtn.disabled = true;
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_REFRESH_PLAN' }, (resp) => {
        refreshBtn.textContent = 'Done! Plan: ' + (resp?.plan || 'unknown');
        // Re-render after a short delay to show updated state
        setTimeout(() => window.location.reload(), 1000);
      });
    });
  }

  // Load usage stats
  if (plan !== 'free') {
    loadAndRenderUsageStats(container, capabilities);
  }
}

async function loadAndRenderUsageStats(container, capabilities) {
  const statsContainer = container.querySelector('#usage-stats');
  if (!statsContainer) return;

  const usage = await chrome.storage.local.get('tp_usage');
  const stats = usage.tp_usage || { domains: [], pdfReportsCount: 0, funnelAuditsCount: 0 };

  const domainLimit = capabilities?.domainLimit;
  const pdfLimit = capabilities?.pdfLimit;
  const domainCount = stats.domains?.length || 0;
  const pdfCount = stats.pdfReportsCount || 0;

  let html = '<div style="display: grid; gap: 8px;">';

  if (domainLimit !== null && domainLimit !== undefined) {
    const pct = Math.min(100, (domainCount / domainLimit) * 100);
    const barClass = pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : '';
    html += `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: var(--tp-text-secondary); font-size: 12px;">Domains</span>
        <span style="color: var(--tp-text); font-size: 12px;">${domainCount} / ${domainLimit}</span>
      </div>
      <div class="usage-bar">
        <div class="usage-bar-fill ${barClass}" style="width: ${pct}%;"></div>
      </div>
    `;
  }

  if (pdfLimit !== null && pdfLimit !== undefined) {
    html += `
      <div style="display: flex; justify-content: space-between; margin-top: 4px;">
        <span style="color: var(--tp-text-secondary); font-size: 12px;">PDF Reports</span>
        <span style="color: var(--tp-text); font-size: 12px;">${pdfCount} / ${pdfLimit}</span>
      </div>
    `;
  }

  if ((domainLimit === null || domainLimit === undefined) && (pdfLimit === null || pdfLimit === undefined)) {
    html += '<div style="color: var(--tp-success); font-size: 12px;">&#10003; All usage unlimited on your plan</div>';
  }

  html += '</div>';
  statsContainer.innerHTML = html;
}
