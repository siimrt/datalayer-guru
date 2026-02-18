/**
 * PAYWALL OVERLAY COMPONENTS
 *
 * Applied to event code blocks on Free plan.
 * Shows first 3 lines clearly, then blurs the rest.
 * Also used for gated features (Audit tab, Push button, etc.)
 */

import { PLAN_PRICING } from '../../shared/plans.js';

// === Message helpers ===

const PAYWALL_MESSAGES = {
  eventCopy: 'Unlock copy-to-clipboard for all generated events.',
  eventPush: 'Push events directly to the dataLayer for testing.',
  eventGeneration: 'See the full generated tracking code.',
  auditDiff: "Compare your expected events with what's actually firing on the page.",
  funnelMode: 'Audit entire purchase funnels across multiple pages.',
  pdfExport: 'Generate professional PDF audit reports for your clients.',
  pdfWhiteLabel: 'Add your agency logo and branding to PDF reports.',
  platformMeta: 'Generate Meta/Facebook Pixel events.',
  platformTikTok: 'Generate TikTok Pixel events.',
  platformPinterest: 'Generate Pinterest Tag events.',
  cmsPrestaShop: 'PrestaShop support is available from Starter.',
  cmsMagento: 'Magento/Adobe Commerce support is available in Pro.',
  cmsWebflow: 'Webflow Commerce support is available in Pro.',
  debugSnippets: 'Access ready-made debug snippets for force-triggering events.',
  domainLimit: "You've reached the domain limit for your plan.",
};

const PAYWALL_TITLES = {
  auditDiff: 'Tracking Audit & Diff',
  funnelMode: 'Funnel Mode',
  pdfExport: 'PDF Reports',
  pdfWhiteLabel: 'White-Label Reports',
  debugSnippets: 'Debug Snippet Library',
};

const PAYWALL_ICONS = {
  auditDiff: '&#128269;',
  funnelMode: '&#128279;',
  pdfExport: '&#128196;',
  pdfWhiteLabel: '&#127991;',
  debugSnippets: '&#129514;',
};

function getPaywallMessage(feature) {
  return PAYWALL_MESSAGES[feature] || 'This feature is available on a paid plan.';
}

function getPaywallTitle(feature) {
  return PAYWALL_TITLES[feature] || 'Premium Feature';
}

function getPaywallIcon(feature) {
  return PAYWALL_ICONS[feature] || '&#11088;';
}

function triggerUpgrade() {
  chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_PAYMENT' });
}

/**
 * Wrap an event code block with a paywall blur.
 * @param {HTMLElement} codeBlock - The code container element
 * @param {string} feature - Which feature is gated
 * @param {string} upgradePlan - Which plan to suggest
 */
export function applyCodePaywall(codeBlock, feature, upgradePlan) {
  const wrapper = document.createElement('div');
  wrapper.className = 'paywall-wrapper';

  codeBlock.parentNode.insertBefore(wrapper, codeBlock);
  wrapper.appendChild(codeBlock);

  // Blur gradient overlay (shows top ~3 lines clearly)
  const overlay = document.createElement('div');
  overlay.className = 'paywall-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 25%,
      rgba(15, 15, 16, 0.7) 40%,
      rgba(15, 15, 16, 0.95) 60%,
      rgba(15, 15, 16, 1) 80%
    );
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 40px;
    z-index: 10;
    pointer-events: auto;
  `;

  const planPrice = PLAN_PRICING[upgradePlan] || PLAN_PRICING.pro;

  overlay.innerHTML = `
    <div style="text-align: center; padding: 16px; max-width: 280px;">
      <div style="font-size: 13px; color: #E8E8ED; margin-bottom: 12px; line-height: 1.4;">
        &#128274; ${getPaywallMessage(feature)}
      </div>
      <button class="paywall-upgrade-btn" style="
        background: #6C5CE7; color: white; border: none;
        padding: 8px 20px; border-radius: 6px; font-size: 13px;
        font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%;
      ">
        Unlock ${upgradePlan.charAt(0).toUpperCase() + upgradePlan.slice(1)} (${planPrice})
      </button>
      <div style="font-size: 11px; color: #5E5E72; margin-top: 8px;">
        30-day money-back guarantee
      </div>
    </div>
  `;

  wrapper.appendChild(overlay);

  const btn = overlay.querySelector('.paywall-upgrade-btn');
  btn.addEventListener('click', triggerUpgrade);
  btn.addEventListener('mouseenter', () => { btn.style.background = '#7d6ef0'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#6C5CE7'; });
}

/**
 * Render a full-section paywall (for Audit tab, Funnel Mode, etc.)
 */
export function renderSectionPaywall(container, feature, upgradePlan) {
  const planPrice = PLAN_PRICING[upgradePlan] || PLAN_PRICING.pro;
  const planLabel = upgradePlan.charAt(0).toUpperCase() + upgradePlan.slice(1);

  container.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 200px; padding: 32px 24px; text-align: center;
    ">
      <div style="font-size: 40px; margin-bottom: 16px;">${getPaywallIcon(feature)}</div>
      <div style="font-size: 15px; font-weight: 600; color: #E8E8ED; margin-bottom: 8px;">
        ${getPaywallTitle(feature)}
      </div>
      <div style="font-size: 13px; color: #9B9BAE; margin-bottom: 20px; line-height: 1.5; max-width: 300px;">
        ${getPaywallMessage(feature)}
      </div>
      <button class="section-paywall-btn" style="
        background: #6C5CE7; color: white; border: none;
        padding: 10px 24px; border-radius: 8px; font-size: 14px;
        font-weight: 600; cursor: pointer; transition: all 0.2s;
      ">
        Upgrade to ${planLabel} (${planPrice}) &rarr;
      </button>
      <div style="font-size: 11px; color: #5E5E72; margin-top: 12px;">
        &#10003; Cancel anytime &middot; &#10003; 30-day guarantee
      </div>
    </div>
  `;

  const btn = container.querySelector('.section-paywall-btn');
  btn.addEventListener('click', triggerUpgrade);
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#7d6ef0';
    btn.style.transform = 'scale(1.02)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#6C5CE7';
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
    triggerUpgrade();
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.borderColor = '#6C5CE7';
    btn.style.color = '#9B9BAE';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = '';
    btn.style.color = '';
  });

  container.appendChild(btn);
  return btn;
}

/**
 * Render a CMS gate banner when detected CMS is not supported by current plan.
 */
export function renderCMSGateBanner(container, detectedCMS, supportedCMS) {
  if (supportedCMS.includes(detectedCMS)) return false;

  const planNeeded = {
    prestashop: 'Starter',
    magento: 'Pro',
    webflow: 'Pro',
  };
  const cmsLabel = detectedCMS.charAt(0).toUpperCase() + detectedCMS.slice(1);
  const needed = planNeeded[detectedCMS] || 'Pro';

  const banner = document.createElement('div');
  banner.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #1a1a1e 100%);
    border: 1px solid #6C5CE7; border-radius: 8px;
    padding: 16px; margin: 12px; text-align: center;
  `;
  banner.innerHTML = `
    <div style="font-size: 14px; color: #E8E8ED; margin-bottom: 4px;">
      ${cmsLabel} detected
    </div>
    <div style="font-size: 12px; color: #9B9BAE; margin-bottom: 12px;">
      ${cmsLabel} support requires ${needed} plan
    </div>
    <button class="cms-gate-upgrade-btn" style="
      background: #6C5CE7; color: white; border: none; padding: 8px 16px;
      border-radius: 6px; font-size: 12px; cursor: pointer;
    ">Upgrade to ${needed}</button>
  `;

  banner.querySelector('.cms-gate-upgrade-btn').addEventListener('click', triggerUpgrade);
  container.appendChild(banner);
  return true;
}
