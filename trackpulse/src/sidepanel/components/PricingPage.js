/**
 * PricingPage Component — Custom pricing page displayed in the sidepanel.
 * 3-column layout: Starter | Pro (highlighted) | Agency side-by-side.
 * Feature comparison table below. Free plan discrete at bottom.
 */

import { PLAN_CONFIG } from '../../shared/plans.js';

// ExtensionPay plan nicknames (must match dashboard config)
const PLAN_NICKNAMES = {
  'starter-monthly': 'starter-monthly',
  'starter-annual': 'starter-annual',
  'pro-monthly': 'pro-monthly',
  'pro-annual': 'pro-annual',
  'agency-monthly': 'agency-monthly',
  'agency-annual': 'agency-annual',
};

// Pricing data
const PRICING = {
  starter: { monthly: 9, annualPerMonth: 6, annualTotal: 72 },
  pro: { monthly: 19, annualPerMonth: 12.40, annualTotal: 149 },
  agency: { monthly: 49, annualPerMonth: 32.50, annualTotal: 390 },
};

// Feature comparison rows: [label, starter, pro, agency]
const FEATURE_TABLE = [
  ['CMS detection', true, true, true],
  ['DataLayer live', true, true, true],
  ['Pixel detection', true, true, true],
  ['Copy events', true, true, true],
  ['GA4 + Meta', true, true, true],
  ['TikTok + Pinterest', false, true, true],
  ['Push to dataLayer', false, true, true],
  ['Audit & diff engine', false, true, true],
  ['Funnel Mode', false, true, true],
  ['PDF export', false, true, true],
  ['All CMS support', false, true, true],
  ['Consent diagnostic', false, true, true],
  ['White-label reports', false, false, true],
  ['Debug snippets', false, false, true],
  ['Team seats (5)', false, false, true],
  ['Priority support', false, false, true],
];

let billingCycle = 'annual'; // pre-selected

export function renderPricingPage(container, state, onBack) {
  const currentPlan = state.plan || 'free';

  container.innerHTML = `
    <div style="padding: 16px; overflow-y: auto; max-height: 100vh;">
      <!-- Back button -->
      <button id="pricing-back" style="
        background: none; border: none; color: var(--tp-text-muted);
        font-size: 13px; cursor: pointer; padding: 4px 0; margin-bottom: 12px;
        display: flex; align-items: center; gap: 4px;
      ">&larr; Back</button>

      <!-- Hero -->
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 18px; font-weight: 700; color: var(--tp-text); margin-bottom: 4px;">
          Unlock TrackPulse
        </div>
        <div style="font-size: 12px; color: var(--tp-text-secondary);">
          Stop wasting 4h/week on manual tracking audits.
        </div>
      </div>

      <!-- Billing toggle -->
      ${renderBillingToggle()}

      <!-- 3-column plan cards -->
      <div style="
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
        margin-bottom: 20px;
      ">
        ${renderCompactCard('starter', currentPlan)}
        ${renderCompactCard('pro', currentPlan)}
        ${renderCompactCard('agency', currentPlan)}
      </div>

      <!-- Feature comparison table -->
      ${renderFeatureTable(currentPlan)}

      <!-- Free plan section -->
      ${renderFreePlanSection(currentPlan)}

      <!-- Trust signals -->
      <div style="
        text-align: center; padding: 16px 0 12px; font-size: 11px;
        color: var(--tp-text-muted); line-height: 2;
      ">
        <div style="color: var(--tp-text-secondary);">&#10003; Cancel anytime</div>
        <div style="color: var(--tp-text-secondary);">&#10003; 30-day money-back guarantee</div>
        <div style="color: var(--tp-text-secondary);">&#10003; Secure payment via Stripe</div>
      </div>

      ${currentPlan !== 'free' ? `
      <div style="
        margin-top: 8px; padding: 14px; background: var(--tp-surface);
        border: 1px solid var(--tp-border); border-radius: 10px; text-align: center;
      ">
        <div style="font-size: 12px; color: var(--tp-text-secondary); margin-bottom: 10px;">
          Manage your billing, update payment method, or cancel anytime.
        </div>
        <button id="pricing-manage" style="
          background: var(--tp-surface-hover); color: var(--tp-text); border: 1px solid var(--tp-border);
          padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s; width: 100%;
        ">Manage Subscription &rarr;</button>
      </div>` : ''}
    </div>
  `;

  bindPricingEvents(container, state, onBack);
}

function renderBillingToggle() {
  return `
    <div style="
      display: flex; justify-content: center; margin-bottom: 16px;
      background: var(--tp-surface); border-radius: 8px; padding: 3px;
      border: 1px solid var(--tp-border);
    ">
      <button id="toggle-monthly" style="
        flex: 1; padding: 6px 10px; border-radius: 6px; border: none;
        font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        background: ${billingCycle === 'monthly' ? 'var(--tp-primary)' : 'transparent'};
        color: ${billingCycle === 'monthly' ? '#fff' : 'var(--tp-text-muted)'};
      ">Monthly</button>
      <button id="toggle-annual" style="
        flex: 1; padding: 6px 10px; border-radius: 6px; border: none;
        font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        background: ${billingCycle === 'annual' ? 'var(--tp-primary)' : 'transparent'};
        color: ${billingCycle === 'annual' ? '#fff' : 'var(--tp-text-muted)'};
      ">Annual <span style="
        font-size: 9px; background: rgba(0,184,148,0.15); color: var(--tp-success);
        padding: 1px 4px; border-radius: 3px; margin-left: 2px;
      ">-33%</span></button>
    </div>
    ${billingCycle === 'annual' ? `
    <div style="text-align: center; font-size: 10px; color: var(--tp-success); margin-top: -10px; margin-bottom: 12px;">
      2 months free
    </div>` : ''}
  `;
}

function renderCompactCard(planKey, currentPlan) {
  const config = PLAN_CONFIG[planKey];
  const pricing = PRICING[planKey];
  const isCurrentPlan = currentPlan === planKey;
  const isHigherPlan = planHierarchy(planKey) > planHierarchy(currentPlan);
  const isLowerPlan = planHierarchy(planKey) < planHierarchy(currentPlan);
  const isPro = planKey === 'pro';

  const price = billingCycle === 'annual' ? pricing.annualPerMonth : pricing.monthly;

  // Border styling
  let borderStyle = '1px solid var(--tp-border)';
  let boxShadow = 'none';
  let marginTop = '0';
  if (isPro) {
    borderStyle = '2px solid var(--tp-primary)';
    boxShadow = '0 0 16px rgba(108, 92, 231, 0.25)';
    marginTop = '-4px';
  }
  if (isCurrentPlan) {
    borderStyle = `2px solid ${config.text}`;
  }

  // Subtitle
  const subtitles = { starter: 'Implementer', pro: 'Popular', agency: 'Scale' };

  // CTA
  let ctaHtml = '';
  if (isCurrentPlan) {
    ctaHtml = `<div style="
      text-align: center; padding: 6px; font-size: 10px;
      color: ${config.text}; font-weight: 700;
      background: ${config.bg}; border-radius: 6px;
    ">&#10003; Current</div>`;
  } else if (isLowerPlan) {
    ctaHtml = `<div style="
      text-align: center; padding: 6px; font-size: 10px;
      color: var(--tp-text-muted);
    ">Included</div>`;
  } else {
    const nickname = PLAN_NICKNAMES[`${planKey}-${billingCycle}`];
    if (isPro) {
      ctaHtml = `<button data-plan-nickname="${nickname}" style="
        width: 100%; padding: 8px 4px; border-radius: 6px; border: none;
        background: var(--tp-primary); color: white; font-size: 11px; font-weight: 700;
        cursor: pointer; transition: all 0.2s;
      ">Choose Pro</button>`;
    } else {
      ctaHtml = `<button data-plan-nickname="${nickname}" style="
        width: 100%; padding: 7px 4px; border-radius: 6px;
        border: 1px solid var(--tp-border); background: var(--tp-surface);
        color: var(--tp-text); font-size: 11px; font-weight: 600;
        cursor: pointer; transition: all 0.2s;
      ">Choose</button>`;
    }
  }

  return `
    <div style="
      background: var(--tp-surface);
      border: ${borderStyle};
      border-radius: 10px;
      padding: 12px 8px;
      text-align: center;
      box-shadow: ${boxShadow};
      margin-top: ${marginTop};
      position: relative;
      display: flex; flex-direction: column; justify-content: space-between;
    ">
      ${isPro ? `
      <div style="
        position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
        background: var(--tp-primary); color: white; font-size: 8px; font-weight: 700;
        padding: 2px 8px; border-radius: 8px; letter-spacing: 0.5px;
        white-space: nowrap;
      ">&#11088; POPULAR</div>` : ''}

      <div>
        <!-- Plan name -->
        <div style="
          font-size: 11px; font-weight: 700; color: ${config.text};
          letter-spacing: 0.5px; margin-bottom: 2px;
          ${isPro ? 'margin-top: 4px;' : ''}
        ">${planKey.toUpperCase()}</div>
        <div style="font-size: 9px; color: var(--tp-text-muted); margin-bottom: 8px;">
          ${subtitles[planKey]}
        </div>

        <!-- Price -->
        <div style="margin-bottom: 4px;">
          <span style="font-size: 22px; font-weight: 800; color: var(--tp-text);">&euro;${price % 1 === 0 ? price : price.toFixed(0)}</span>
          <span style="font-size: 10px; color: var(--tp-text-muted);">/mo</span>
        </div>
        ${billingCycle === 'annual' ? `
        <div style="font-size: 9px; color: var(--tp-text-muted); text-decoration: line-through; margin-bottom: 8px;">
          &euro;${pricing.monthly}/mo
        </div>` : '<div style="height: 8px;"></div>'}
      </div>

      <!-- CTA -->
      ${ctaHtml}
    </div>
  `;
}

function renderFeatureTable(currentPlan) {
  const rows = FEATURE_TABLE.map(([label, starter, pro, agency]) => {
    return `
      <tr style="border-bottom: 1px solid var(--tp-border);">
        <td style="padding: 5px 4px; font-size: 11px; color: var(--tp-text-secondary);">${label}</td>
        <td style="padding: 5px 2px; text-align: center; font-size: 11px;">
          ${starter ? '<span style="color: var(--tp-success);">&#10003;</span>' : '<span style="color: var(--tp-text-muted);">&mdash;</span>'}
        </td>
        <td style="padding: 5px 2px; text-align: center; font-size: 11px;">
          ${pro ? '<span style="color: var(--tp-success);">&#10003;</span>' : '<span style="color: var(--tp-text-muted);">&mdash;</span>'}
        </td>
        <td style="padding: 5px 2px; text-align: center; font-size: 11px;">
          ${agency ? '<span style="color: var(--tp-success);">&#10003;</span>' : '<span style="color: var(--tp-text-muted);">&mdash;</span>'}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--tp-text); margin-bottom: 8px;">
        Feature Comparison
      </div>
      <div style="
        background: var(--tp-surface); border-radius: 8px; border: 1px solid var(--tp-border);
        overflow: hidden;
      ">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--tp-border);">
              <th style="padding: 8px 4px; font-size: 10px; color: var(--tp-text-muted); text-align: left; font-weight: 600;">Feature</th>
              <th style="padding: 8px 2px; font-size: 10px; color: ${PLAN_CONFIG.starter.text}; text-align: center; font-weight: 700;">Start</th>
              <th style="padding: 8px 2px; font-size: 10px; color: ${PLAN_CONFIG.pro.text}; text-align: center; font-weight: 700;">Pro</th>
              <th style="padding: 8px 2px; font-size: 10px; color: ${PLAN_CONFIG.agency.text}; text-align: center; font-weight: 700;">Agency</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFreePlanSection(currentPlan) {
  const isCurrent = currentPlan === 'free';
  return `
    <div style="
      background: var(--tp-surface); border-radius: 8px; padding: 12px;
      border: 1px solid var(--tp-border); margin-bottom: 16px;
      display: flex; justify-content: space-between; align-items: center;
    ">
      <div>
        <div style="font-size: 12px; font-weight: 600; color: var(--tp-text-muted);">Free Plan</div>
        <div style="font-size: 10px; color: var(--tp-text-muted); margin-top: 2px;">
          CMS detection, DataLayer live, pixel status
        </div>
      </div>
      ${isCurrent ? `
      <span style="
        font-size: 9px; background: ${PLAN_CONFIG.free.bg}; color: ${PLAN_CONFIG.free.text};
        padding: 3px 8px; border-radius: 4px; border: 1px solid ${PLAN_CONFIG.free.border};
        font-weight: 600;
      ">Current</span>` : ''}
    </div>
  `;
}

function bindPricingEvents(container, state, onBack) {
  container.querySelector('#pricing-back')?.addEventListener('click', onBack);

  container.querySelector('#toggle-monthly')?.addEventListener('click', () => {
    billingCycle = 'monthly';
    renderPricingPage(container, state, onBack);
  });

  container.querySelector('#toggle-annual')?.addEventListener('click', () => {
    billingCycle = 'annual';
    renderPricingPage(container, state, onBack);
  });

  // Bind CTA buttons
  container.querySelectorAll('[data-plan-nickname]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlePlanSelect(btn.dataset.planNickname);
    });
    // Hover effects
    const isProBtn = btn.dataset.planNickname?.includes('pro');
    if (isProBtn) {
      btn.addEventListener('mouseenter', () => { btn.style.background = '#7d6ef0'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--tp-primary)'; });
    } else {
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--tp-primary)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--tp-border)'; });
    }
  });

  // Manage subscription
  const manageBtn = container.querySelector('#pricing-manage');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_MANAGEMENT' });
    });
    manageBtn.addEventListener('mouseenter', () => { manageBtn.style.borderColor = 'var(--tp-primary)'; manageBtn.style.color = 'var(--tp-primary)'; });
    manageBtn.addEventListener('mouseleave', () => { manageBtn.style.borderColor = 'var(--tp-border)'; manageBtn.style.color = 'var(--tp-text)'; });
  }
}

function handlePlanSelect(planNickname) {
  chrome.runtime.sendMessage({
    type: 'TRACKPULSE_OPEN_STRIPE_CHECKOUT',
    payload: { planNickname },
  });
}

function planHierarchy(plan) {
  const h = { free: 0, starter: 1, pro: 2, agency: 3 };
  return h[plan] || 0;
}
