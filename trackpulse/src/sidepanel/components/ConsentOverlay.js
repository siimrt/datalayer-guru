/**
 * ConsentOverlay — Modal overlay shown when a consent signal changes to 'denied'.
 * Displays CMP name, Google Consent Mode status, and the 4 consent signals.
 */

import { trackEvent } from '../../shared/analytics.js';

const CMP_NAMES = {
  cookieyes: 'CookieYes', cookiebot: 'Cookiebot', onetrust: 'OneTrust',
  didomi: 'Didomi', axeptio: 'Axeptio', tarteaucitron: 'Tarteaucitron',
  complianz: 'Complianz', acceptio: 'Acceptio', iubenda: 'Iubenda',
  usercentrics: 'Usercentrics', quantcast: 'Quantcast (TCF)',
  none: 'None detected',
};

const CONSENT_LABELS = {
  ad_storage: 'Ad Storage', analytics_storage: 'Analytics Storage',
  ad_user_data: 'Ad User Data', ad_personalization: 'Ad Personalization',
};

let _currentOverlay = null;

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Determines whether the consent overlay should be shown.
 * Returns 'denied' when a signal changes to denied, 'granted' when
 * a signal changes from denied to granted, or false otherwise.
 *
 * @param {object} newConsent
 * @param {object|null|undefined} previousConsent
 * @returns {'denied'|'granted'|false}
 */
export function shouldShowConsentOverlay(newConsent, previousConsent) {
  // First load — ignore first detection
  if (!previousConsent) return false;

  const prevSignals = previousConsent.googleConsent || {};
  const newSignals = newConsent.googleConsent || {};

  let newlyDenied = false;
  let newlyGranted = false;

  for (const key of Object.keys(CONSENT_LABELS)) {
    if (newSignals[key] === 'denied' && prevSignals[key] !== 'denied') {
      newlyDenied = true;
    }
    if (newSignals[key] === 'granted' && prevSignals[key] === 'denied') {
      newlyGranted = true;
    }
  }

  if (newlyGranted) return 'granted';
  if (newlyDenied) return 'denied';
  return false;
}

/**
 * Show the consent overlay modal.
 *
 * @param {object} consent - { cmpDetected, consentModeActive, googleConsent }
 * @param {object} callbacks - { onReopenCMP, onReloadPage }
 * @param {'denied'|'granted'} changeType - What kind of consent change triggered this
 */
export function showConsentOverlay(consent, callbacks, changeType = 'denied') {
  // Clean up previous overlay
  if (_currentOverlay) {
    _currentOverlay.remove();
    _currentOverlay = null;
  }

  const { onReopenCMP, onReloadPage } = callbacks;
  const { cmpDetected, consentModeActive, googleConsent } = consent;
  const cmpLabel = CMP_NAMES[cmpDetected] || escapeHTML(cmpDetected || 'Unknown');
  const gcmStatus = consentModeActive ? 'Active' : 'Inactive';
  const gcmClass = consentModeActive ? 'success' : 'warning';

  const isGrantedChange = changeType === 'granted';

  // Build signal rows
  const signalRows = Object.entries(CONSENT_LABELS).map(([key, label]) => {
    const value = googleConsent?.[key];
    const isGranted = value === 'granted';
    const isDenied = value === 'denied';
    const dotClass = isGranted ? 'tp-dot-green' : isDenied ? 'tp-dot-red' : 'tp-dot-gray';
    const statusText = isGranted ? 'Granted' : isDenied ? 'Denied' : 'Not set';
    return `
      <div class="tp-consent-signal-row">
        <span class="tp-dot ${dotClass}"></span>
        <span>${escapeHTML(label)}</span>
        <span class="tp-consent-signal-value">${escapeHTML(statusText)}</span>
      </div>
    `;
  }).join('');

  // Action buttons depending on consent change type
  let actionBtns = '';
  if (isGrantedChange) {
    // Consent accepted → suggest reload so tags fire
    actionBtns = `
      <div class="tp-consent-hint" style="font-size: 11px; color: var(--tp-text-secondary); margin-bottom: 8px;">
        Reload the page to activate tracking tags.
      </div>
      <button class="tp-btn tp-btn-primary tp-consent-reload" style="width:100%; justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;">
          <path d="M13.65 2.35A7.958 7.958 0 008 0C3.58 0 .01 3.58.01 8S3.58 16 8 16c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 018 2c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/>
        </svg>
        Reload Page
      </button>
    `;
  } else if (cmpDetected !== 'none') {
    // Consent denied → offer to reopen CMP
    actionBtns = `<button class="tp-btn tp-btn-primary tp-consent-reopen" style="width:100%; justify-content:center;">🍪 Reopen Cookies</button>`;
  }

  const title = isGrantedChange ? 'Cookies Accepted' : 'Consent Status';

  const overlay = document.createElement('div');
  overlay.className = 'tp-consent-overlay';
  overlay.innerHTML = `
    <div class="tp-consent-modal">
      <div class="tp-consent-modal-header">
        <span>${escapeHTML(title)}</span>
        <button class="tp-consent-close" title="Close">&times;</button>
      </div>
      <div class="tp-consent-modal-body">
        <div class="tp-consent-info-row">
          <strong>CMP:</strong> ${escapeHTML(cmpLabel)}
        </div>
        <div class="tp-consent-info-row">
          <strong>Google Consent Mode:</strong>
          <span class="tp-consent-gcm-status ${gcmClass}">${escapeHTML(gcmStatus)}</span>
        </div>
        <div class="tp-consent-signals">
          ${signalRows}
        </div>
        ${actionBtns}
      </div>
    </div>
  `;

  // Close button handler
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.tp-consent-close') || e.target === overlay) {
      trackEvent('consent_overlay_action', { action: 'close' });
      cleanup();
    }
  });

  // Reopen CMP handler
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.tp-consent-reopen')) {
      trackEvent('consent_overlay_action', { action: 'reopen' });
      cleanup();
      if (typeof onReopenCMP === 'function') {
        onReopenCMP(cmpDetected);
      }
    }
  });

  // Reload page handler
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.tp-consent-reload')) {
      trackEvent('consent_overlay_action', { action: 'reload' });
      cleanup();
      if (typeof onReloadPage === 'function') {
        onReloadPage();
      }
    }
  });

  trackEvent('consent_overlay_shown', {
    cmpName: cmpDetected || 'unknown',
    status: changeType,
  });

  document.body.appendChild(overlay);
  _currentOverlay = overlay;
}

function cleanup() {
  if (_currentOverlay) {
    _currentOverlay.remove();
    _currentOverlay = null;
  }
}
