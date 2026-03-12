/**
 * Header Component — Shows CMS badge, page type, currency, plan badge, and refresh button.
 */

import { CMS_INFO, CMS_LOGOS, PAGE_TYPE_LABELS, SITE_TYPE_INFO, SITE_TYPES } from '../../shared/constants.js';
import { renderPlanBadge } from './PlanBadge.js';

function getPageTypeIcon(pageType) {
  const icons = {
    home: '🏠 ',
    collection: '🗂️ ',
    product: '📦 ',
    cart: '🛒 ',
    checkout: '💳 ',
    thank_you: '✅ ',
    search: '🔍 ',
  };
  return icons[pageType] || '';
}

function getSiteTypeIcon(siteType) {
  const icons = {
    ecommerce: '🛒 ',
    leadgen: '🎯 ',
    hybrid: '🔀 ',
  };
  return icons[siteType] || '';
}

function getSiteTypeStyle(siteType) {
  const styles = {
    ecommerce: 'background:#F0FDF4;color:#166534;border:none;padding:4px 10px',
    leadgen: 'background:#EEF2FF;color:#3730A3;border:none;padding:4px 10px',
    hybrid: 'background:#FAF5FF;color:#6B21A8;border:none;padding:4px 10px',
  };
  return styles[siteType] || 'background:#F1F5F9;color:#334155;border:none;padding:4px 10px';
}

export function renderHeader(container, state, onRefresh, onUpgrade) {
  const cms = state.cms?.cms || 'unknown';
  const cmsInfo = CMS_INFO[cms] || CMS_INFO.unknown;
  const confidence = state.cms?.confidence || 0;
  const pageType = state.pageType?.pageType || 'unknown';
  const pageLabel = PAGE_TYPE_LABELS[pageType] || 'Unknown';
  const currency = state.ecommerceData?.currency || '';
  const version = state.cms?.version || '';
  const effectiveSiteType = state.siteTypeOverride || state.siteType?.siteType || 'unknown';
  const siteTypeInfo = SITE_TYPE_INFO?.[effectiveSiteType] || { name: 'Unknown', color: '#888' };

  // Get hostname from URL
  let hostname = '';
  try {
    hostname = new URL(state.url || '').hostname;
  } catch (e) {
    hostname = '';
  }

  container.innerHTML = `
    <div class="tp-header">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="tp-cms-logo">${CMS_LOGOS[cms] || CMS_LOGOS.unknown}</div>
          <span class="tp-badge tp-badge-cms">
            ${cmsInfo.name}
            <span class="text-tp-text-muted text-[10px]">(${confidence}%)</span>
          </span>
          <span class="tp-badge tp-badge-page">${getPageTypeIcon(pageType)}${pageLabel}</span>
          <span class="tp-badge tp-badge-site-type" style="${getSiteTypeStyle(effectiveSiteType)}" id="site-type-badge" title="Site type: ${siteTypeInfo.name}${state.siteTypeOverride ? ' (override)' : ''}">${getSiteTypeIcon(effectiveSiteType)}${siteTypeInfo.name}${state.siteTypeOverride ? ' *' : ''}</span>
          ${currency ? `<span class="tp-badge tp-badge-currency">${currency}</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          <span id="header-plan-badge"></span>
          <button class="tp-refresh-btn" id="refresh-btn" title="Re-detect">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.65 2.35A7.958 7.958 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 018 2c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 text-[11px] text-tp-text-muted">
        ${hostname ? `<span>${hostname}</span>` : ''}
        ${version ? `<span>&middot; ${version}</span>` : ''}
        ${state.pageType?.method ? `<span>&middot; Detection: ${state.pageType.method}</span>` : ''}
      </div>
    </div>
  `;

  // Bind refresh
  container.querySelector('#refresh-btn')?.addEventListener('click', onRefresh);

  // Render plan badge
  const planBadgeEl = container.querySelector('#header-plan-badge');
  if (planBadgeEl) {
    renderPlanBadge(planBadgeEl, state.plan || 'free', onUpgrade);
  }
}
