/**
 * PixelStatus Component — Shows detected pixels and consent status.
 */

import { escapeHtml } from '../../shared/utils.js';

const PLATFORM_NAMES = {
  gtm: 'Google Tag Manager',
  ga4: 'Google Analytics 4',
  ua: 'Universal Analytics',
  meta: 'Meta Pixel',
  tiktok: 'TikTok Pixel',
  pinterest: 'Pinterest Tag',
  snapchat: 'Snapchat Pixel',
  linkedin: 'LinkedIn Insight',
  twitter: 'Twitter/X Pixel',
};

const CONSENT_LABELS = {
  ad_storage: 'Ad Storage',
  analytics_storage: 'Analytics Storage',
  ad_user_data: 'Ad User Data',
  ad_personalization: 'Ad Personalization',
};

const CMP_NAMES = {
  cookiebot: 'Cookiebot',
  onetrust: 'OneTrust',
  didomi: 'Didomi',
  axeptio: 'Axeptio',
  tarteaucitron: 'Tarteaucitron',
  complianz: 'Complianz',
  none: 'None detected',
};

export function renderPixelStatus(container, state) {
  const pixels = state.pixels || [];
  const consent = state.consent || {};

  // All possible platforms (to show "not detected" for missing ones)
  const knownPlatforms = ['gtm', 'ga4', 'meta', 'tiktok', 'pinterest', 'snapchat', 'linkedin', 'twitter'];
  const detectedPlatforms = new Set(pixels.map((p) => p.platform));

  let pixelHtml = '';

  // Detected pixels
  for (const pixel of pixels) {
    pixelHtml += renderPixelRow(pixel, true);
  }

  // Not-detected platforms
  for (const platform of knownPlatforms) {
    if (!detectedPlatforms.has(platform)) {
      pixelHtml += renderPixelRow({ platform, id: null, active: false }, false);
    }
  }

  // Consent section
  const consentHtml = renderConsentSection(consent);

  container.innerHTML = `
    <div class="tp-card">
      <div class="p-3">
        <div class="text-[12px] font-medium mb-2">Installed Pixels</div>
        ${pixelHtml}
      </div>
    </div>
    ${consentHtml}
    <div class="h-4"></div>
  `;
}

function renderPixelRow(pixel, detected) {
  const name = PLATFORM_NAMES[pixel.platform] || pixel.platform;
  const dotClass = detected && pixel.active ? 'tp-dot-green' : 'tp-dot-gray';

  return `
    <div class="tp-pixel-row">
      <span class="tp-dot ${dotClass}"></span>
      <span class="flex-1 ${detected ? 'text-tp-text' : 'text-tp-text-muted'}">
        ${escapeHtml(name)}
      </span>
      <span class="text-[11px] ${detected ? 'text-tp-text-secondary' : 'text-tp-text-muted'}">
        ${detected ? (pixel.id ? escapeHtml(pixel.id) : 'Detected') : 'Not detected'}
      </span>
    </div>
  `;
}

function renderConsentSection(consent) {
  const cmpName = CMP_NAMES[consent.cmpDetected] || consent.cmpDetected || 'None';
  const consentModeActive = consent.consentModeActive;
  const googleConsent = consent.googleConsent || {};

  const hasConsentData = Object.values(googleConsent).some((v) => v != null);

  return `
    <div class="tp-card">
      <div class="p-3">
        <div class="text-[12px] font-medium mb-2">Consent Status</div>
        <div class="tp-consent-row">
          <span class="text-tp-text-secondary">CMP</span>
          <span class="font-medium">${escapeHtml(cmpName)}</span>
        </div>
        <div class="tp-consent-row">
          <span class="text-tp-text-secondary">Google Consent Mode</span>
          <span class="font-medium ${consentModeActive ? 'text-tp-success' : 'text-tp-text-muted'}">
            ${consentModeActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        ${hasConsentData ? `
          <div class="mt-2 pt-2 border-t border-tp-border">
            ${Object.entries(CONSENT_LABELS)
              .map(([key, label]) => {
                const value = googleConsent[key];
                const isGranted = value === 'granted';
                const isDenied = value === 'denied';
                return `
                  <div class="tp-consent-row pl-3">
                    <span class="text-tp-text-secondary">${label}</span>
                    <span class="flex items-center gap-1">
                      ${value
                        ? `<span class="tp-dot ${isGranted ? 'tp-dot-green' : isDenied ? 'tp-dot-red' : 'tp-dot-gray'}"></span>
                           <span class="${isGranted ? 'text-tp-success' : isDenied ? 'text-tp-error' : 'text-tp-text-muted'}">${escapeHtml(value)}</span>`
                        : '<span class="text-tp-text-muted">not set</span>'
                      }
                    </span>
                  </div>
                `;
              })
              .join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
