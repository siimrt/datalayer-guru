/**
 * Header Component — Shows CMS badge, page type, currency, and refresh button.
 */

import { CMS_INFO, CMS_LOGOS, PAGE_TYPE_LABELS } from '../../shared/constants.js';

export function renderHeader(container, state, onRefresh) {
  const cms = state.cms?.cms || 'unknown';
  const cmsInfo = CMS_INFO[cms] || CMS_INFO.unknown;
  const confidence = state.cms?.confidence || 0;
  const pageType = state.pageType?.pageType || 'unknown';
  const pageLabel = PAGE_TYPE_LABELS[pageType] || 'Unknown';
  const currency = state.ecommerceData?.currency || '';
  const version = state.cms?.version || '';

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
          <span class="tp-badge tp-badge-page">${pageLabel}</span>
          ${currency ? `<span class="tp-badge tp-badge-currency">${currency}</span>` : ''}
        </div>
        <button class="tp-refresh-btn" id="refresh-btn" title="Re-detect">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.65 2.35A7.958 7.958 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 018 2c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="flex items-center gap-2 text-[11px] text-tp-text-muted">
        ${hostname ? `<span>${hostname}</span>` : ''}
        ${version ? `<span>· ${version}</span>` : ''}
        ${state.pageType?.method ? `<span>· Detection: ${state.pageType.method}</span>` : ''}
      </div>
    </div>
  `;

  // Bind refresh
  container.querySelector('#refresh-btn')?.addEventListener('click', onRefresh);
}
