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
    const cmpDetails = this._getCMPDetails(pageContext, cmpDetected);

    return {
      cmpDetected,
      googleConsent,
      consentModeActive,
      cmpDetails,
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
    if (consent.acceptio) return 'acceptio';
    if (consent.iubenda) return 'iubenda';
    if (consent.usercentrics) return 'usercentrics';
    if (consent.quantcast) return 'quantcast';

    // Fallback: check DOM for known CMP elements
    const cmpSelectors = {
      cookieyes: '#cky-consent, .cky-consent-container',
      cookiebot: '#CybotCookiebotDialog, [data-cookieconsent]',
      onetrust: '#onetrust-banner-sdk, .onetrust-pc-dark-filter',
      didomi: '#didomi-host, .didomi-popup-container',
      axeptio: '#axeptio_overlay, .axeptio_widget',
      tarteaucitron: '#tarteaucitronRoot',
      complianz: '.cmplz-cookiebanner, #cmplz-cookiebanner-container',
      acceptio: '#acceptio-app',
      iubenda: '.iubenda-cs-container',
      usercentrics: '#usercentrics-root',
      quantcast: '.qc-cmp2-container',
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
      // Handle arguments-style object: {0: 'consent', 1: 'default', 2: {...}}
      else if (entry && typeof entry === 'object' && entry['0'] === 'consent' && entry['2']) {
        consentData = entry['2'];
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
        let data = null;
        if (Array.isArray(entry) && entry[0] === 'consent') {
          data = entry[2];
        } else if (typeof entry === 'object' && !Array.isArray(entry) && entry['0'] === 'consent') {
          data = entry['2'];
        }
        if (data && typeof data === 'object') {
          for (const key of Object.keys(result)) {
            if (data[key]) {
              result[key] = data[key];
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
        if (typeof entry === 'object' && !Array.isArray(entry) && entry['0'] === 'consent') return true;
        if (entry?.event === 'gtm.init_consent') return true;
        if (entry?.event === 'consent_update') return true;
      }
    }

    return false;
  }

  /**
   * Extract CMP-specific details for display in the consent overlay.
   */
  _getCMPDetails(pageContext, cmpName) {
    const consent = pageContext.consent || {};
    const details = { cmp: cmpName };

    try {
      switch (cmpName) {
        case 'cookiebot':
          if (consent.cookiebot && typeof consent.cookiebot === 'object') {
            details.consent = consent.cookiebot.consent || null;
            details.consentID = consent.cookiebot.consentID || null;
          }
          break;
        case 'onetrust':
          if (consent.oneTrust && typeof consent.oneTrust === 'object') {
            details.activeGroups = consent.oneTrust.activeGroups || null;
          }
          break;
        case 'didomi':
          if (consent.didomi && typeof consent.didomi === 'object') {
            details.userStatus = consent.didomi.userStatus || null;
            details.currentUserStatus = consent.didomi.currentUserStatus || null;
          }
          break;
        case 'tarteaucitron':
          if (consent.tarteaucitron && typeof consent.tarteaucitron === 'object') {
            details.state = consent.tarteaucitron.state || null;
          }
          break;
        case 'complianz':
          if (consent.complianz && typeof consent.complianz === 'object') {
            details.categories = consent.complianz.categories || null;
          }
          break;
        case 'axeptio':
          if (consent.axeptio && typeof consent.axeptio === 'object') {
            details.settings = consent.axeptio.settings || null;
          }
          break;
        case 'iubenda':
          if (consent.iubenda && typeof consent.iubenda === 'object') {
            details.consent = consent.iubenda.consent || null;
          }
          break;
        case 'usercentrics':
          if (consent.usercentrics && typeof consent.usercentrics === 'object') {
            details.services = consent.usercentrics.services || null;
          }
          break;
        case 'quantcast':
          if (consent.quantcast && typeof consent.quantcast === 'object') {
            details.tcfData = consent.quantcast.tcfData || null;
          }
          break;
      }
    } catch (e) {}

    return details;
  }
}
