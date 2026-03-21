/**
 * PricingPage Component — Simplified Free vs Pro pricing page.
 * V2.1: Single paid plan (Pro). Clean, focused conversion page.
 */

import { PLAN_CONFIG } from '../../shared/plans.js';
import { trackEvent } from '../../shared/analytics.js';

// ExtensionPay plan nicknames (must match dashboard config)
const PLAN_NICKNAMES = {
  'pro-monthly': 'pro-monthly',
  'pro-annual': 'pro-annual',
};

// Pricing data
const PRICING = {
  pro: { monthly: 25, annualPerMonth: 17, annualTotal: 199 },
};

// Free features
const FREE_FEATURES = [
  'CMS & framework detection (all 24)',
  'Page type & site type detection',
  'Pixel & tag detection (8 platforms)',
  'GA4 event generation',
  'Meta, TikTok, Pinterest event generation',
  'DataLayer live view',
  'Tracking audit & diff engine',
  'Consent diagnostic',
  'Network request monitoring',
];

// Pro features (what you unlock)
const PRO_FEATURES = [
  'Copy generated events to clipboard',
  'Push events to dataLayer for testing',
  'Quick Push synthetic events',
  'Funnel Mode — multi-page audits',
  'PDF audit reports for clients',
  'CAPI event name customisation',
];

/**
 * Dynamic hero subtitle based on where the user came from.
 */
function getHeroSubtitle(state) {
  const eventCount = Object.values(state.generatedEvents || {}).flat().length;
  const cms = state.cms?.cms;
  const cmsName = cms && cms !== 'unknown' && cms !== 'custom' ? cms.charAt(0).toUpperCase() + cms.slice(1) : null;

  if (state.previousTab === 'events' && eventCount > 0) {
    return `You have ${eventCount} events ready${cmsName ? ` for ${cmsName}` : ''}. Pro lets you copy &amp; push them.`;
  }
  if (state.previousTab === 'funnel') {
    return 'Audit your entire purchase funnel across multiple pages.';
  }
  if (state.previousTab === 'audit') {
    return 'Export your audit as a professional PDF report.';
  }
  return 'Everything is free to see. Pro lets you act on it.';
}

let billingCycle = 'annual'; // pre-selected

export function renderPricingPage(container, state, onBack) {
  trackEvent('pricing_page_viewed', { source: state.previousTab || 'unknown' });
  const currentPlan = state.plan || 'free';
  const isPro = currentPlan === 'pro';

  const price = billingCycle === 'annual' ? PRICING.pro.annualPerMonth : PRICING.pro.monthly;
  const savings = billingCycle === 'annual'
    ? Math.round((1 - PRICING.pro.annualTotal / (PRICING.pro.monthly * 12)) * 100)
    : 0;

  container.innerHTML = `
    <div style="padding: 16px; overflow-y: auto; max-height: 100vh;">
      <!-- Back button -->
      <button id="pricing-back" style="
        background: none; border: none; color: var(--tp-text-muted);
        font-size: 13px; cursor: pointer; padding: 4px 0; margin-bottom: 12px;
        display: flex; align-items: center; gap: 4px;
      ">&larr; Back</button>

      <!-- Hero (contextual) -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 20px; font-weight: 800; color: var(--tp-text); margin-bottom: 6px; letter-spacing: -0.3px;">
          Unlock Traacky Pro
        </div>
        <div style="font-size: 12px; color: var(--tp-text-secondary); line-height: 1.5;">
          ${getHeroSubtitle(state)}
        </div>
      </div>

      <!-- Billing toggle -->
      ${renderBillingToggle()}

      <!-- Pro card -->
      <div style="
        background: linear-gradient(180deg, color-mix(in srgb, var(--tp-primary) 4%, var(--tp-surface)), var(--tp-surface));
        border: 2px solid var(--tp-primary);
        border-radius: 14px; padding: 20px; margin-bottom: 20px;
        box-shadow: 0 4px 20px rgba(0, 109, 119, 0.15);
        text-align: center; position: relative;
      ">
        <div style="
          position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          background: var(--tp-primary); color: white; font-size: 9px; font-weight: 700;
          padding: 3px 12px; border-radius: 8px; letter-spacing: 0.6px;
          text-transform: uppercase;
        ">Pro</div>

        <!-- Price -->
        <div style="margin: 10px 0 4px;">
          <span style="font-size: 36px; font-weight: 800; color: var(--tp-text); letter-spacing: -1.5px;">&euro;${price}</span>
          <span style="font-size: 12px; color: var(--tp-text-muted);">/mo</span>
        </div>
        ${billingCycle === 'annual' ? `
        <div style="font-size: 13px; color: var(--tp-text-secondary); margin-bottom: 4px;">
          <span style="text-decoration: line-through; font-size: 14px; font-weight: 600; color: var(--tp-text-muted);">&euro;${PRICING.pro.monthly}/mo</span>
          <span style="
            color: var(--tp-success); font-weight: 700; margin-left: 6px;
            background: rgba(0, 184, 148, 0.12); padding: 2px 8px; border-radius: 4px;
            font-size: 12px;
          ">Save ${savings}%</span>
        </div>
        <div style="font-size: 10px; color: var(--tp-text-muted); margin-bottom: 16px;">
          Billed &euro;${PRICING.pro.annualTotal}/year
        </div>
        ` : '<div style="height: 16px;"></div>'}

        <!-- Pro features list -->
        <div style="text-align: left; margin-bottom: 16px;">
          ${PRO_FEATURES.map((f) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 5px 0;">
              <span style="color: var(--tp-primary); font-weight: 600; font-size: 13px;">&#10003;</span>
              <span style="font-size: 12px; color: var(--tp-text);">${f}</span>
            </div>
          `).join('')}
        </div>

        <!-- CTA -->
        ${isPro ? `
        <div style="
          padding: 10px; font-size: 13px; font-weight: 700;
          color: ${PLAN_CONFIG.pro.text}; background: ${PLAN_CONFIG.pro.bg};
          border-radius: 8px;
        ">&#10003; You're on Pro</div>
        ` : `
        <button id="pro-cta" class="upgrade-pulse" data-plan-nickname="${PLAN_NICKNAMES[`pro-${billingCycle}`]}" style="
          width: 100%; padding: 12px; border-radius: 10px; border: none;
          background: var(--tp-primary); color: white; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 109, 119, 0.3);
        ">Get Pro &rarr;</button>
        `}
      </div>

      <!-- Free features (collapsible — don't overshadow Pro) -->
      <div style="
        background: var(--tp-surface); border-radius: 12px; padding: 14px 16px;
        border: 1px solid var(--tp-border); margin-bottom: 16px;
      ">
        <div id="free-features-toggle" style="
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; user-select: none;
        ">
          <div style="font-size: 12px; font-weight: 600; color: var(--tp-text-secondary);">
            Free plan includes ${FREE_FEATURES.length} features
          </div>
          <svg class="tp-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div id="free-features-list" style="display: none; margin-top: 10px;">
          ${FREE_FEATURES.map((f) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
              <span style="color: var(--tp-text-muted); font-size: 11px;">&#10003;</span>
              <span style="font-size: 11px; color: var(--tp-text-muted);">${f}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Trust signals -->
      <div style="
        text-align: center; padding: 12px 0;
        display: flex; flex-direction: column; gap: 6px;
      ">
        <div style="
          display: flex; justify-content: center; gap: 16px; font-size: 11px;
          color: var(--tp-text-secondary);
        ">
          <span>&#10003; Cancel anytime</span>
          <span>&#10003; 30-day guarantee</span>
        </div>
        <div style="font-size: 10px; color: var(--tp-text-muted);">
          Secure payment via Stripe
        </div>
      </div>

      ${isPro ? `
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
      background: var(--tp-surface); border-radius: 10px; padding: 3px;
      border: 1px solid var(--tp-border);
    ">
      <button id="toggle-monthly" style="
        flex: 1; padding: 7px 10px; border-radius: 8px; border: none;
        font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        background: ${billingCycle === 'monthly' ? 'var(--tp-primary)' : 'transparent'};
        color: ${billingCycle === 'monthly' ? '#fff' : 'var(--tp-text-muted)'};
      ">Monthly</button>
      <button id="toggle-annual" style="
        flex: 1; padding: 7px 10px; border-radius: 8px; border: none;
        font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        background: ${billingCycle === 'annual' ? 'var(--tp-primary)' : 'transparent'};
        color: ${billingCycle === 'annual' ? '#fff' : 'var(--tp-text-muted)'};
      ">Annual <span style="
        font-size: 9px; background: rgba(0,184,148,0.15); color: var(--tp-success);
        padding: 1px 5px; border-radius: 4px; margin-left: 2px; font-weight: 700;
      ">Save 32%</span></button>
    </div>
  `;
}

function bindPricingEvents(container, state, onBack) {
  container.querySelector('#pricing-back')?.addEventListener('click', onBack);

  // Free features collapsible
  container.querySelector('#free-features-toggle')?.addEventListener('click', () => {
    const list = container.querySelector('#free-features-list');
    const chevron = container.querySelector('#free-features-toggle .tp-chevron');
    if (list) {
      const isHidden = list.style.display === 'none';
      list.style.display = isHidden ? 'block' : 'none';
      if (chevron) chevron.classList.toggle('open', isHidden);
    }
  });

  container.querySelector('#toggle-monthly')?.addEventListener('click', () => {
    trackEvent('pricing_billing_toggled', {
      from: billingCycle,
      to: 'monthly',
      currentPlan: state.plan || 'free',
    });
    billingCycle = 'monthly';
    renderPricingPage(container, state, onBack);
  });

  container.querySelector('#toggle-annual')?.addEventListener('click', () => {
    trackEvent('pricing_billing_toggled', {
      from: billingCycle,
      to: 'annual',
      currentPlan: state.plan || 'free',
    });
    billingCycle = 'annual';
    renderPricingPage(container, state, onBack);
  });

  // Bind Pro CTA
  const proCta = container.querySelector('#pro-cta');
  if (proCta) {
    proCta.addEventListener('click', () => {
      const nickname = proCta.dataset.planNickname;
      trackEvent('pricing_plan_selected', {
        selectedPlan: 'pro',
        billingCycle,
        planNickname: nickname,
        currentPlan: state.plan || 'free',
      });
      handlePlanSelect(nickname);
    });
    proCta.addEventListener('mouseenter', () => {
      proCta.style.background = '#005a63';
      proCta.style.transform = 'translateY(-1px)';
      proCta.style.boxShadow = '0 4px 12px rgba(0, 109, 119, 0.4)';
    });
    proCta.addEventListener('mouseleave', () => {
      proCta.style.background = 'var(--tp-primary)';
      proCta.style.transform = 'translateY(0)';
      proCta.style.boxShadow = '0 2px 8px rgba(0, 109, 119, 0.3)';
    });
  }

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
