/**
 * PAYWALL COMPONENTS
 *
 * V2.1: Simplified — only gates actions (Copy, Push, Funnel, PDF, CAPI).
 * No more CMS gating, no more platform gating, no more code blur.
 */

import { PLAN_PRICING } from '../../shared/plans.js';
import { trackEvent } from '../../shared/analytics.js';

// === Message helpers ===

const PAYWALL_MESSAGES = {
  eventCopy: 'Copy events to clipboard — available in Pro.',
  eventPush: 'Push events directly to the dataLayer for testing.',
  funnelMode: 'Audit entire purchase funnels across multiple pages.',
  pdfExport: 'Generate professional PDF audit reports for your clients.',
  capiConfig: 'Customise CAPI event names for server-side tracking.',
};

const PAYWALL_TITLES = {
  funnelMode: 'Funnel Mode',
  pdfExport: 'PDF Reports',
  capiConfig: 'CAPI Configuration',
};

const PAYWALL_ICONS = {
  funnelMode: '&#128279;',
  pdfExport: '&#128196;',
  capiConfig: '&#9881;',
};

function getPaywallMessage(feature) {
  return PAYWALL_MESSAGES[feature] || 'This feature is available in Pro.';
}

function getPaywallTitle(feature) {
  return PAYWALL_TITLES[feature] || 'Pro Feature';
}

function getPaywallIcon(feature) {
  return PAYWALL_ICONS[feature] || '&#11088;';
}

/**
 * Mini visual preview of Funnel Mode for the paywall.
 */
function renderFunnelPreview() {
  const steps = [
    { label: 'Product', icon: '&#128230;', status: 'ok' },
    { label: 'Cart', icon: '&#128722;', status: 'ok' },
    { label: 'Checkout', icon: '&#128179;', status: 'warn' },
    { label: 'Purchase', icon: '&#9989;', status: 'miss' },
  ];
  const stepHtml = steps.map((s, i) => {
    const color = s.status === 'ok' ? 'var(--tp-success)' : s.status === 'warn' ? '#F59E0B' : 'var(--tp-error)';
    const connector = i < steps.length - 1 ? `<div style="width: 20px; height: 2px; background: var(--tp-border); margin: 0 -2px;"></div>` : '';
    return `
      <div style="display: flex; align-items: center;">
        <div style="
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        ">
          <div style="
            width: 32px; height: 32px; border-radius: 8px;
            background: rgba(0,0,0,0.04); display: flex; align-items: center;
            justify-content: center; font-size: 16px;
            border: 2px solid ${color};
          ">${s.icon}</div>
          <span style="font-size: 9px; color: var(--tp-text-muted);">${s.label}</span>
        </div>
        ${connector}
      </div>
    `;
  }).join('');

  return `
    <div style="
      display: flex; align-items: center; justify-content: center;
      gap: 4px; margin-bottom: 16px; opacity: 0.7;
      padding: 12px; background: var(--tp-surface); border-radius: 10px;
      border: 1px dashed var(--tp-border);
    ">
      ${stepHtml}
    </div>
  `;
}

// Module-level upgrade handler — set from main.js to navigate to pricing page
let _upgradeHandler = () => {
  chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
};

// Current plan (set from main.js for paywall tracking context)
let _currentPlan = 'free';

// Debounce: only fire paywall_shown once per feature per session
const _paywallShownThisSession = new Set();

export function setCurrentPlan(plan) {
  _currentPlan = plan;
}

/**
 * Set the upgrade handler. Called once from main.js to route to the pricing page.
 */
export function setUpgradeHandler(handler) {
  _upgradeHandler = handler;
}

function triggerUpgrade(feature, targetPlan) {
  trackEvent('paywall_upgrade_clicked', {
    feature: feature || 'unknown',
    currentPlan: _currentPlan,
    targetPlan: targetPlan || 'pro',
  });
  _upgradeHandler();
}

/**
 * Render a full-section paywall (for Funnel Mode, PDF export, etc.)
 */
export function renderSectionPaywall(container, feature, upgradePlan) {
  if (!_paywallShownThisSession.has(feature)) {
    _paywallShownThisSession.add(feature);
    trackEvent('paywall_shown', { feature, currentPlan: _currentPlan, requiredPlan: upgradePlan || 'pro' });
  }

  const planPrice = PLAN_PRICING.pro;

  container.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 200px; padding: 32px 24px; text-align: center;
    ">
      ${feature === 'funnelMode' ? renderFunnelPreview() : `<div style="font-size: 40px; margin-bottom: 16px;">${getPaywallIcon(feature)}</div>`}
      <div style="font-size: 15px; font-weight: 600; color: var(--tp-text); margin-bottom: 8px;">
        ${getPaywallTitle(feature)}
      </div>
      <div style="font-size: 13px; color: var(--tp-text-secondary); margin-bottom: 20px; line-height: 1.5; max-width: 300px;">
        ${getPaywallMessage(feature)}
      </div>
      <button class="section-paywall-btn" style="
        background: var(--tp-primary); color: white; border: none;
        padding: 10px 24px; border-radius: 8px; font-size: 14px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
      ">
        Upgrade to Pro (${planPrice}) &rarr;
      </button>
      <div style="font-size: 11px; color: var(--tp-text-muted); margin-top: 12px;">
        &#10003; Cancel anytime &middot; &#10003; 30-day guarantee
      </div>
    </div>
  `;

  const btn = container.querySelector('.section-paywall-btn');
  btn.addEventListener('click', () => triggerUpgrade(feature, 'pro'));
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#005a63';
    btn.style.transform = 'scale(1.02)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'var(--tp-primary)';
    btn.style.transform = 'scale(1)';
  });
}

/**
 * Render a locked button (for Copy, Push) with tooltip.
 */
export function renderLockedButton(container, label, feature, upgradePlan) {
  const btn = document.createElement('button');
  btn.className = 'tp-btn tp-btn-sm locked-btn';
  btn.innerHTML = `&#128274; ${label}`;
  btn.title = getPaywallMessage(feature);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerUpgrade(feature, upgradePlan || 'pro');
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.borderColor = 'var(--tp-primary)';
    btn.style.color = 'var(--tp-text-secondary)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = '';
    btn.style.color = '';
  });

  container.appendChild(btn);
  return btn;
}
