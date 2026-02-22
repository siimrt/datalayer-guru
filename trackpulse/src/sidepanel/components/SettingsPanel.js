/**
 * SettingsPanel Component — Shows account info, plan management, usage stats, and theme toggle.
 */

import { renderPlanBadge } from './PlanBadge.js';
import { PLAN_CONFIG } from '../../shared/plans.js';

export function renderSettingsPanel(container, state, actions) {
  const plan = state.plan || 'free';
  const email = state.userEmail;
  const capabilities = state.capabilities;
  const isDark = document.documentElement.classList.contains('dark');
  const autoSwitch = state.autoSwitchTab || false;

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
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="color: var(--tp-text); font-size: 12px; font-weight: 500;">Auto-switch on tab change</div>
              <div style="color: var(--tp-text-muted); font-size: 11px; margin-top: 2px;">Reload detection when switching browser tabs</div>
            </div>
            <label class="tp-switch">
              <input type="checkbox" id="auto-switch-tab" ${autoSwitch ? 'checked' : ''} />
              <span class="tp-switch-slider"></span>
            </label>
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

      <!-- Plan Comparison (Free only) -->
      ${plan === 'free' ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">Plan Features</h3>
        <div style="
          background: var(--tp-surface); border-radius: 8px; padding: 12px; border: 1px solid var(--tp-border);
          font-size: 12px; line-height: 2;
        ">
          <div style="color: var(--tp-text-secondary); margin-bottom: 8px;"><b style="color: var(--tp-text);">Free</b> &mdash; CMS detection, dataLayer live, pixel status</div>
          <div style="color: #5B9BD5; margin-bottom: 8px;"><b>Starter ($9/mo)</b> &mdash; Copy events, Meta Pixel, PrestaShop, 5 domains</div>
          <div style="color: #6C5CE7; margin-bottom: 8px;"><b>Pro ($19/mo)</b> &mdash; Push to dataLayer, Audit, Funnel Mode, PDF, all CMS</div>
          <div style="color: #D4A017;"><b>Agency ($49/mo)</b> &mdash; White-label, debug snippets, unlimited</div>
        </div>
      </div>
      ` : ''}

      <!-- Debug Info -->
      ${state.planDebug ? `
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

      <!-- About -->
      <div>
        <h3 style="color: var(--tp-text); font-size: 14px; margin-bottom: 12px;">About</h3>
        <div style="color: var(--tp-text-secondary); font-size: 12px; line-height: 1.6;">
          TrackPulse v2.0.0<br>
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
    upgradeBtn.addEventListener('mouseenter', () => { upgradeBtn.style.background = '#7d6ef0'; });
    upgradeBtn.addEventListener('mouseleave', () => { upgradeBtn.style.background = 'var(--tp-primary)'; });
  }

  // Manage button
  const manageBtn = container.querySelector('#settings-manage-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
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

  // Auto-switch tab toggle
  const autoSwitchCheckbox = container.querySelector('#auto-switch-tab');
  if (autoSwitchCheckbox) {
    autoSwitchCheckbox.addEventListener('change', (e) => {
      if (actions.toggleAutoSwitchTab) actions.toggleAutoSwitchTab(e.target.checked);
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
