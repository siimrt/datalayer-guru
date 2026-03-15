/**
 * ConsentOverlay — Modal overlay shown when a consent signal changes to 'denied'.
 * Displays CMP name, Google Consent Mode status, and the 4 consent signals.
 */

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
 * Returns true when any consent signal changes to 'denied'.
 *
 * @param {object} newConsent
 * @param {object|null|undefined} previousConsent
 * @returns {boolean}
 */
export function shouldShowConsentOverlay(newConsent, previousConsent) {
  // First load — ignore first detection
  if (!previousConsent) return false;

  const prevSignals = previousConsent.googleConsent || {};
  const newSignals = newConsent.googleConsent || {};

  for (const key of Object.keys(CONSENT_LABELS)) {
    if (newSignals[key] === 'denied' && prevSignals[key] !== 'denied') {
      return true;
    }
  }

  return false;
}

/**
 * Show the consent overlay modal.
 *
 * @param {object} consent - { cmpDetected, consentModeActive, googleConsent: { ad_storage, analytics_storage, ad_user_data, ad_personalization } }
 * @param {Function} onReopenCMP - Called with cmpName string when user clicks "Reopen Cookies"
 */
export function showConsentOverlay(consent, onReopenCMP) {
  // Clean up previous overlay
  if (_currentOverlay) {
    _currentOverlay.remove();
    _currentOverlay = null;
  }

  const { cmpDetected, consentModeActive, googleConsent } = consent;
  const cmpLabel = CMP_NAMES[cmpDetected] || escapeHTML(cmpDetected || 'Unknown');
  const gcmStatus = consentModeActive ? 'Active' : 'Inactive';
  const gcmClass = consentModeActive ? 'success' : 'warning';

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

  // Reopen button (only when a CMP is detected)
  const reopenBtn = cmpDetected !== 'none'
    ? `<button class="tp-btn tp-btn-primary tp-consent-reopen">Reopen Cookies</button>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'tp-consent-overlay';
  overlay.innerHTML = `
    <div class="tp-consent-modal">
      <div class="tp-consent-modal-header">
        <span>Consent Status</span>
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
        ${reopenBtn}
      </div>
    </div>
  `;

  // Close button handler
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.tp-consent-close') || e.target === overlay) {
      cleanup();
    }
  });

  // Reopen CMP handler
  if (cmpDetected !== 'none') {
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.tp-consent-reopen')) {
        cleanup();
        if (typeof onReopenCMP === 'function') {
          onReopenCMP(cmpDetected);
        }
      }
    });
  }

  document.body.appendChild(overlay);
  _currentOverlay = overlay;
}

function cleanup() {
  if (_currentOverlay) {
    _currentOverlay.remove();
    _currentOverlay = null;
  }
}
