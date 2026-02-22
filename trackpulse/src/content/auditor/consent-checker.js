/**
 * Consent Checker — Checks the current consent state on the page.
 * Detects CMP platforms and Google Consent Mode v2 status.
 */

export class ConsentChecker {
  /**
   * Check the consent status on the current page.
   *
   * @param {Object} pageContext - Data from the page-context-script
   * @returns {ConsentStatus}
   */
  check(pageContext = {}) {
    const cmpDetected = this._detectCMP(pageContext);
    const googleConsent = this._getGoogleConsentState(pageContext);
    const consentModeActive = this._isConsentModeActive(pageContext);

    return {
      cmpDetected,
      googleConsent,
      consentModeActive,
      raw: pageContext.consent || null,
    };
  }

  /**
   * Detect which Consent Management Platform is in use.
   */
  _detectCMP(pageContext) {
    const consent = pageContext.consent || {};

    if (consent.cookieyes) return 'cookieyes';
    if (consent.cookiebot) return 'cookiebot';
    if (consent.oneTrust) return 'onetrust';
    if (consent.didomi) return 'didomi';
    if (consent.axeptio) return 'axeptio';
    if (consent.tarteaucitron) return 'tarteaucitron';
    if (consent.complianz) return 'complianz';

    // Fallback: check DOM for known CMP elements
    const cmpSelectors = {
      cookieyes: '#cky-consent, .cky-consent-container',
      cookiebot: '#CybotCookiebotDialog, [data-cookieconsent]',
      onetrust: '#onetrust-banner-sdk, .onetrust-pc-dark-filter',
      didomi: '#didomi-host, .didomi-popup-container',
      axeptio: '#axeptio_overlay, .axeptio_widget',
      tarteaucitron: '#tarteaucitronRoot',
      complianz: '.cmplz-cookiebanner, #cmplz-cookiebanner-container',
    };

    for (const [cmp, selector] of Object.entries(cmpSelectors)) {
      try {
        if (document.querySelector(selector)) return cmp;
      } catch (e) {}
    }

    return 'none';
  }

  /**
   * Get the current Google Consent Mode v2 state.
   */
  _getGoogleConsentState(pageContext) {
    const result = {
      ad_storage: null,
      analytics_storage: null,
      ad_user_data: null,
      ad_personalization: null,
    };

    // Parse consent events from dataLayer
    const consentEvents = pageContext.googleConsentEvents || [];

    for (const entry of consentEvents) {
      let consentData = null;

      // Handle array format: ['consent', 'default', { ... }]
      if (Array.isArray(entry)) {
        if (entry[0] === 'consent' && entry[2]) {
          consentData = entry[2];
        }
      }
      // Handle object format with consent data
      else if (entry && typeof entry === 'object') {
        // gtm.init_consent event
        if (entry.event === 'gtm.init_consent') {
          // Consent data may be in various places
          for (const key of Object.keys(result)) {
            if (entry[key]) result[key] = entry[key];
          }
          continue;
        }
        // consent_update event
        if (entry.event === 'consent_update') {
          consentData = entry;
        }
      }

      if (consentData) {
        for (const key of Object.keys(result)) {
          if (consentData[key]) {
            result[key] = consentData[key];
          }
        }
      }
    }

    // Also check the full dataLayer for consent defaults
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        if (Array.isArray(entry) && entry[0] === 'consent') {
          const action = entry[1]; // 'default' or 'update'
          const data = entry[2];
          if (data && typeof data === 'object') {
            for (const key of Object.keys(result)) {
              if (data[key]) {
                result[key] = data[key];
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Determine if Google Consent Mode v2 is active.
   */
  _isConsentModeActive(pageContext) {
    // Check if any consent events exist in the dataLayer
    if (pageContext.googleConsentEvents?.length > 0) return true;

    // Check dataLayer for consent commands
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        if (Array.isArray(entry) && entry[0] === 'consent') return true;
        if (entry?.event === 'gtm.init_consent') return true;
        if (entry?.event === 'consent_update') return true;
      }
    }

    return false;
  }
}
