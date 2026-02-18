/**
 * PricingPage Component — Custom pricing page displayed in the sidepanel.
 * Replaces the default ExtensionPay payment page with a branded, conversion-optimized UI.
 * Uses cognitive biases: anchoring, decoy effect, center stage, loss aversion.
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

// Feature lists per plan
const PLAN_FEATURES = {
  free: {
    title: 'FREE',
    subtitle: 'Inspector',
    included: [
      'CMS auto-detection',
      'DataLayer live stream',
      'Pixel detection',
      'GA4 event preview',
    ],
  },
  starter: {
    title: 'STARTER',
    subtitle: 'Implementer',
    included: [
      'Full event generation',
      'Copy to clipboard',
      'GA4 + Meta events',
      'Shopify + Woo + PrestaShop',
      '5 domains/month',
    ],
    excluded: [
      'Push to dataLayer',
      'Audit & diff engine',
    ],
  },
  pro: {
    title: 'PRO',
    subtitle: 'Popular',
    highlight: true,
    included: [
      'Everything in Starter, plus:',
      'Push to dataLayer 1-click',
      'Full audit & diff engine',
      'All CMS (Magento, Webflow)',
      'All platforms (TikTok, Pinterest)',
      'Funnel Mode (20 pages)',
      'PDF export (10/month)',
      'Consent Mode diagnostic',
      'Unlimited domains',
    ],
  },
  agency: {
    title: 'AGENCY',
    subtitle: 'Scale',
    included: [
      'Everything in Pro, plus:',
      'White-label PDF reports',
      'Unlimited PDF exports',
      'Unlimited funnel pages',
      'Debug snippet library',
      '5 team seats',
      'Priority support (24h)',
      '90-day audit history',
    ],
  },
};

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
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 18px; font-weight: 700; color: var(--tp-text); margin-bottom: 6px;">
          Unlock TrackPulse
        </div>
        <div style="font-size: 13px; color: var(--tp-text-secondary); line-height: 1.5;">
          Stop wasting 4h/week on<br>manual tracking audits.
        </div>
      </div>

      <!-- Billing toggle -->
      <div style="
        display: flex; justify-content: center; margin-bottom: 20px;
        background: var(--tp-surface); border-radius: 8px; padding: 3px;
        border: 1px solid var(--tp-border);
      ">
        <button id="toggle-monthly" class="pricing-toggle ${billingCycle === 'monthly' ? 'active' : ''}" style="
          flex: 1; padding: 7px 12px; border-radius: 6px; border: none;
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          background: ${billingCycle === 'monthly' ? 'var(--tp-primary)' : 'transparent'};
          color: ${billingCycle === 'monthly' ? '#fff' : 'var(--tp-text-muted)'};
        ">Monthly</button>
        <button id="toggle-annual" class="pricing-toggle ${billingCycle === 'annual' ? 'active' : ''}" style="
          flex: 1; padding: 7px 12px; border-radius: 6px; border: none;
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          background: ${billingCycle === 'annual' ? 'var(--tp-primary)' : 'transparent'};
          color: ${billingCycle === 'annual' ? '#fff' : 'var(--tp-text-muted)'};
        ">Annual <span style="
          font-size: 10px; background: rgba(0,184,148,0.15); color: #00B894;
          padding: 1px 5px; border-radius: 3px; margin-left: 4px;
        ">-33%</span></button>
      </div>
      ${billingCycle === 'annual' ? `
      <div style="text-align: center; font-size: 11px; color: #00B894; margin-top: -12px; margin-bottom: 16px;">
        2 months free
      </div>` : ''}

      <!-- Plan cards -->
      ${renderPlanCard('free', currentPlan)}
      ${renderPlanCard('starter', currentPlan)}
      ${renderPlanCard('pro', currentPlan)}
      ${renderPlanCard('agency', currentPlan)}

      <!-- Trust signals -->
      <div style="
        text-align: center; padding: 20px 0 12px; font-size: 11px;
        color: var(--tp-text-muted); line-height: 2;
      ">
        <div style="color: var(--tp-text-secondary);">&#10003; Cancel anytime</div>
        <div style="color: var(--tp-text-secondary);">&#10003; 30-day money-back guarantee</div>
        <div style="color: var(--tp-text-secondary);">&#10003; Secure payment via Stripe</div>
        <div style="margin-top: 8px; font-size: 10px;">Trusted by 200+ agencies</div>
      </div>

      ${currentPlan !== 'free' ? `
      <div style="text-align: center; padding-bottom: 16px;">
        <button id="pricing-manage" style="
          background: none; border: none; color: var(--tp-text-muted);
          font-size: 11px; cursor: pointer; text-decoration: underline;
        ">Manage subscription</button>
      </div>` : ''}
    </div>
  `;

  // Bind events
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
      const nickname = btn.dataset.planNickname;
      handlePlanSelect(nickname);
    });
    // Hover effects
    const isProBtn = btn.dataset.planNickname?.includes('pro');
    if (isProBtn) {
      btn.addEventListener('mouseenter', () => { btn.style.background = '#7d6ef0'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#6C5CE7'; });
    } else {
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--tp-primary)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--tp-border)'; });
    }
  });

  // Manage subscription
  container.querySelector('#pricing-manage')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TRACKPULSE_OPEN_MANAGEMENT' });
  });
}

function renderPlanCard(planKey, currentPlan) {
  const plan = PLAN_FEATURES[planKey];
  const pricing = PRICING[planKey];
  const config = PLAN_CONFIG[planKey];
  const isCurrentPlan = currentPlan === planKey;
  const isHigherPlan = planHierarchy(planKey) > planHierarchy(currentPlan);
  const isLowerPlan = planHierarchy(planKey) < planHierarchy(currentPlan);
  const isHighlighted = plan.highlight;
  const isFree = planKey === 'free';

  // Determine border/glow
  let borderStyle = '1px solid var(--tp-border)';
  let boxShadow = 'none';
  if (isHighlighted) {
    borderStyle = '2px solid #6C5CE7';
    boxShadow = '0 0 20px rgba(108, 92, 231, 0.3)';
  }
  if (isCurrentPlan) {
    borderStyle = `2px solid ${config.text}`;
  }

  // Price display
  let priceHtml = '';
  if (pricing) {
    if (billingCycle === 'annual') {
      priceHtml = `
        <div style="display: flex; align-items: baseline; gap: 6px;">
          <span style="font-size: 24px; font-weight: 800; color: var(--tp-text);">
            &euro;${pricing.annualPerMonth}
          </span>
          <span style="font-size: 12px; color: var(--tp-text-muted);">/mo</span>
          <span style="
            font-size: 11px; color: var(--tp-text-muted); text-decoration: line-through;
          ">&euro;${pricing.monthly}/mo</span>
        </div>
        <div style="font-size: 11px; color: var(--tp-text-muted); margin-top: 2px;">
          &euro;${pricing.annualTotal} billed annually
        </div>
      `;
    } else {
      priceHtml = `
        <div style="display: flex; align-items: baseline; gap: 6px;">
          <span style="font-size: 24px; font-weight: 800; color: var(--tp-text);">
            &euro;${pricing.monthly}
          </span>
          <span style="font-size: 12px; color: var(--tp-text-muted);">/mo</span>
        </div>
        <div style="font-size: 11px; color: var(--tp-text-muted); margin-top: 2px;">
          Save 33% with annual billing
        </div>
      `;
    }
  }

  // Features list
  const featuresHtml = [
    ...(plan.included || []).map((f) => {
      const isGroupHeader = f.startsWith('Everything in');
      return `<div style="
        font-size: 12px; padding: 2px 0;
        color: ${isGroupHeader ? 'var(--tp-text-secondary)' : 'var(--tp-text)'};
        ${isGroupHeader ? 'font-style: italic; margin-bottom: 2px;' : ''}
      ">
        ${isGroupHeader ? '' : '<span style="color: #00B894;">&#10003;</span> '}${f}
      </div>`;
    }),
    ...(plan.excluded || []).map((f) =>
      `<div style="font-size: 12px; padding: 2px 0; color: var(--tp-text-muted); text-decoration: line-through;">
        <span style="color: var(--tp-text-muted);">&#10007;</span> ${f}
      </div>`
    ),
  ].join('');

  // CTA button
  let ctaHtml = '';
  if (isFree) {
    if (isCurrentPlan) {
      ctaHtml = `<div style="
        text-align: center; padding: 8px; font-size: 12px;
        color: var(--tp-text-muted); font-weight: 600;
      ">Current plan</div>`;
    } else {
      ctaHtml = `<div style="
        text-align: center; padding: 8px; font-size: 12px;
        color: var(--tp-text-muted);
      ">Included in your plan</div>`;
    }
  } else if (isCurrentPlan) {
    ctaHtml = `<div style="
      text-align: center; padding: 10px; font-size: 13px;
      color: ${config.text}; font-weight: 700;
      background: ${config.bg}; border-radius: 8px;
    ">&#10003; Current plan</div>`;
  } else if (isLowerPlan) {
    ctaHtml = `<div style="
      text-align: center; padding: 8px; font-size: 12px;
      color: var(--tp-text-muted);
    ">Included in your plan</div>`;
  } else {
    // CTA for upgrade
    const nickname = PLAN_NICKNAMES[`${planKey}-${billingCycle}`];
    if (isHighlighted) {
      ctaHtml = `<button data-plan-nickname="${nickname}" style="
        width: 100%; padding: 12px; border-radius: 8px; border: none;
        background: #6C5CE7; color: white; font-size: 14px; font-weight: 700;
        cursor: pointer; transition: all 0.2s;
        box-shadow: 0 0 20px rgba(108, 92, 231, 0.3);
      ">${currentPlan === 'free' ? 'Unlock Pro &mdash; Best Value' : 'Upgrade to Pro'} &rarr;</button>`;
    } else {
      ctaHtml = `<button data-plan-nickname="${nickname}" style="
        width: 100%; padding: 10px; border-radius: 8px;
        border: 1px solid var(--tp-border); background: var(--tp-surface);
        color: var(--tp-text); font-size: 13px; font-weight: 600;
        cursor: pointer; transition: all 0.2s;
      ">${isHigherPlan ? `Choose ${plan.title.charAt(0) + plan.title.slice(1).toLowerCase()}` : 'Select'}</button>`;
    }
  }

  return `
    <div style="
      background: var(--tp-surface);
      border: ${borderStyle};
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: ${boxShadow};
      ${isHighlighted ? 'transform: scale(1.01);' : ''}
      position: relative;
    ">
      ${isHighlighted ? `
      <div style="
        position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
        background: #6C5CE7; color: white; font-size: 10px; font-weight: 700;
        padding: 3px 12px; border-radius: 10px; letter-spacing: 0.5px;
      ">&#11088; POPULAR</div>` : ''}

      <!-- Plan header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <span style="
            font-size: 14px; font-weight: 700; color: ${config.text};
            letter-spacing: 0.5px;
          ">${plan.title}</span>
          <span style="font-size: 11px; color: var(--tp-text-muted); margin-left: 6px;">
            &mdash; ${plan.subtitle}
          </span>
        </div>
        ${isCurrentPlan ? `<span style="
          font-size: 9px; background: ${config.bg}; color: ${config.text};
          padding: 2px 6px; border-radius: 4px; border: 1px solid ${config.border};
        ">&#10003;</span>` : ''}
      </div>

      <!-- Price -->
      ${priceHtml}

      <!-- Features -->
      <div style="margin: 12px 0; padding: 12px 0; border-top: 1px solid var(--tp-border);">
        ${featuresHtml}
      </div>

      <!-- CTA -->
      ${ctaHtml}
    </div>
  `;
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
