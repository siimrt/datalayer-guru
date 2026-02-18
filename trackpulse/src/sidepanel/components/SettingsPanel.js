/**
 * SettingsPanel Component — Shows account info, plan management, and usage stats.
 */

import { renderPlanBadge } from './PlanBadge.js';
import { PLAN_CONFIG } from '../../shared/plans.js';

export function renderSettingsPanel(container, state) {
  const plan = state.plan || 'free';
  const email = state.userEmail;
  const capabilities = state.capabilities;

  container.innerHTML = `
    <div style="padding: 16px;">
      <!-- Account Section -->
      <div style="margin-bottom: 24px;">
        <h3 style="color: #E8E8ED; font-size: 14px; margin-bottom: 12px;">Account</h3>
        <div style="
          background: #1A1A1E; border-radius: 8px; padding: 12px; border: 1px solid #2E2E34;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #9B9BAE; font-size: 12px;">Plan</span>
            <span id="settings-plan-badge"></span>
          </div>
          ${email ? `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #9B9BAE; font-size: 12px;">Email</span>
            <span style="color: #E8E8ED; font-size: 12px;">${email}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Upgrade / Manage Section -->
      <div style="margin-bottom: 24px;">
        ${plan === 'free' ? `
          <button id="settings-upgrade-btn" style="
            background: #6C5CE7; color: white; border: none;
            padding: 10px 0; border-radius: 8px; width: 100%;
            font-size: 14px; font-weight: 600; cursor: pointer;
            transition: all 0.2s;
          ">&#9889; Upgrade to Pro &mdash; $19/mo</button>
          <div style="text-align: center; margin-top: 8px;">
            <span style="color: #5E5E72; font-size: 11px;">Cancel anytime &middot; 30-day guarantee</span>
          </div>
        ` : `
          <button id="settings-manage-btn" style="
            background: #1A1A1E; color: #9B9BAE; border: 1px solid #2E2E34;
            padding: 10px 0; border-radius: 8px; width: 100%;
            font-size: 13px; cursor: pointer; transition: all 0.2s;
          ">Manage Subscription</button>
        `}
      </div>

      <!-- Usage Stats (Starter+) -->
      ${plan !== 'free' ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #E8E8ED; font-size: 14px; margin-bottom: 12px;">Usage This Month</h3>
        <div id="usage-stats" style="
          background: #1A1A1E; border-radius: 8px; padding: 12px; border: 1px solid #2E2E34;
        ">
          <div style="color: #9B9BAE; font-size: 12px;">Loading...</div>
        </div>
      </div>
      ` : ''}

      <!-- Plan Comparison (Free only) -->
      ${plan === 'free' ? `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #E8E8ED; font-size: 14px; margin-bottom: 12px;">Plan Features</h3>
        <div style="
          background: #1A1A1E; border-radius: 8px; padding: 12px; border: 1px solid #2E2E34;
          font-size: 12px; line-height: 2;
        ">
          <div style="color: #9B9BAE; margin-bottom: 8px;"><b style="color: #E8E8ED;">Free</b> &mdash; CMS detection, dataLayer live, pixel status</div>
          <div style="color: #5B9BD5; margin-bottom: 8px;"><b>Starter ($9/mo)</b> &mdash; Copy events, Meta Pixel, PrestaShop, 5 domains</div>
          <div style="color: #6C5CE7; margin-bottom: 8px;"><b>Pro ($19/mo)</b> &mdash; Push to dataLayer, Audit, Funnel Mode, PDF, all CMS</div>
          <div style="color: #FDCB6E;"><b>Agency ($49/mo)</b> &mdash; White-label, debug snippets, unlimited</div>
        </div>
      </div>
      ` : ''}

      <!-- About -->
      <div>
        <h3 style="color: #E8E8ED; font-size: 14px; margin-bottom: 12px;">About</h3>
        <div style="color: #9B9BAE; font-size: 12px; line-height: 1.6;">
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

  // Upgrade button
  const upgradeBtn = container.querySelector('#settings-upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
    });
    upgradeBtn.addEventListener('mouseenter', () => { upgradeBtn.style.background = '#7d6ef0'; });
    upgradeBtn.addEventListener('mouseleave', () => { upgradeBtn.style.background = '#6C5CE7'; });
  }

  // Manage button
  const manageBtn = container.querySelector('#settings-manage-btn');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_MANAGEMENT' });
    });
    manageBtn.addEventListener('mouseenter', () => { manageBtn.style.borderColor = '#6C5CE7'; });
    manageBtn.addEventListener('mouseleave', () => { manageBtn.style.borderColor = '#2E2E34'; });
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
        <span style="color: #9B9BAE; font-size: 12px;">Domains</span>
        <span style="color: #E8E8ED; font-size: 12px;">${domainCount} / ${domainLimit}</span>
      </div>
      <div class="usage-bar">
        <div class="usage-bar-fill ${barClass}" style="width: ${pct}%;"></div>
      </div>
    `;
  }

  if (pdfLimit !== null && pdfLimit !== undefined) {
    html += `
      <div style="display: flex; justify-content: space-between; margin-top: 4px;">
        <span style="color: #9B9BAE; font-size: 12px;">PDF Reports</span>
        <span style="color: #E8E8ED; font-size: 12px;">${pdfCount} / ${pdfLimit}</span>
      </div>
    `;
  }

  if ((domainLimit === null || domainLimit === undefined) && (pdfLimit === null || pdfLimit === undefined)) {
    html += '<div style="color: #00B894; font-size: 12px;">&#10003; All usage unlimited on your plan</div>';
  }

  html += '</div>';
  statsContainer.innerHTML = html;
}
