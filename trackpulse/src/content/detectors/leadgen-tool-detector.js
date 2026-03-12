/**
 * Lead Gen Tool Detector — Detects CRM, call tracking, chat, and scheduling tools.
 *
 * Follows the same cascade approach as PixelDetector:
 * 1. Script tags — check <script src="..."> for known CDN URLs
 * 2. Inline scripts — scan <script> blocks for SDK init calls
 * 3. DOM elements — check for widget containers, iframes, etc.
 * 4. Globals — check pageContext for known JS globals
 */

import { LEADGEN_PLATFORMS, LEADGEN_PIXEL_PATTERNS, LEADGEN_TOOL_INFO } from '../../shared/constants.js';

export class LeadGenToolDetector {
  /**
   * Detect all installed lead gen tools on the current page.
   *
   * @param {Object} pageContext - Data from the page-context-script
   * @returns {Array<{ platform: string, category: string, name: string, method: string, active: boolean }>}
   */
  detect(pageContext = {}) {
    const tools = [];

    const domCache = {
      inlineScripts: document.querySelectorAll('script:not([src])'),
      allScripts: document.querySelectorAll('script[src]'),
    };

    // CRM tools
    tools.push(...this._detectHubSpot(pageContext, domCache));
    tools.push(...this._detectPardot(pageContext, domCache));
    tools.push(...this._detectMarketo(pageContext, domCache));
    tools.push(...this._detectActiveCampaign(pageContext, domCache));

    // Call tracking
    tools.push(...this._detectCallRail(pageContext, domCache));
    tools.push(...this._detectCTM(pageContext, domCache));
    tools.push(...this._detectWhatConverts(pageContext, domCache));

    // Chat tools
    tools.push(...this._detectDrift(pageContext, domCache));
    tools.push(...this._detectIntercom(pageContext, domCache));
    tools.push(...this._detectCrisp(pageContext, domCache));
    tools.push(...this._detectLiveChat(pageContext, domCache));
    tools.push(...this._detectTidio(pageContext, domCache));

    // Scheduling
    tools.push(...this._detectCalendly(pageContext, domCache));
    tools.push(...this._detectChiliPiper(pageContext, domCache));

    return tools;
  }

  /* ------------------------------------------------------------------ */
  /*  Helper                                                             */
  /* ------------------------------------------------------------------ */

  _result(platform, method) {
    const info = LEADGEN_TOOL_INFO[platform] || { name: platform, category: 'unknown' };
    return {
      platform,
      category: info.category,
      name: info.name,
      method,
      active: true,
    };
  }

  _hasScript(domCache, pattern) {
    for (const script of domCache.allScripts) {
      if (pattern.test(script.src)) return true;
    }
    return false;
  }

  _hasInlineMatch(domCache, pattern) {
    for (const script of domCache.inlineScripts) {
      if (pattern.test(script.textContent || '')) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  CRM                                                                */
  /* ------------------------------------------------------------------ */

  _detectHubSpot(pageContext, domCache) {
    // Script: js.hs-scripts.com, js.hsforms.net, js.hs-analytics.net
    if (this._hasScript(domCache, /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/)) {
      return [this._result(LEADGEN_PLATFORMS.HUBSPOT, 'script')];
    }
    // Inline: _hsq, hbspt
    if (this._hasInlineMatch(domCache, /_hsq\s*=|hbspt\./)) {
      return [this._result(LEADGEN_PLATFORMS.HUBSPOT, 'inline')];
    }
    // DOM: HubSpot forms
    if (document.querySelector('.hbspt-form, .hs-form, [data-hs-form-id]')) {
      return [this._result(LEADGEN_PLATFORMS.HUBSPOT, 'dom')];
    }
    // Global
    if (pageContext.pixels?.hsq || pageContext.pixels?.hbspt) {
      return [this._result(LEADGEN_PLATFORMS.HUBSPOT, 'global')];
    }
    return [];
  }

  _detectPardot(pageContext, domCache) {
    // Script: pi.pardot.com, pardot.com/pd.js
    if (this._hasScript(domCache, /pi\.pardot\.com|pardot\.com\/pd\.js/)) {
      return [this._result(LEADGEN_PLATFORMS.PARDOT, 'script')];
    }
    // Inline: piAId, piCId
    if (this._hasInlineMatch(domCache, /piAId\s*=|piCId\s*=/)) {
      return [this._result(LEADGEN_PLATFORMS.PARDOT, 'inline')];
    }
    // Iframe: pardot forms
    if (document.querySelector('iframe[src*="pardot.com"], iframe[src*="go.pardot.com"]')) {
      return [this._result(LEADGEN_PLATFORMS.PARDOT, 'dom')];
    }
    return [];
  }

  _detectMarketo(pageContext, domCache) {
    // Script: munchkin.marketo.net, marketo.com
    if (this._hasScript(domCache, /munchkin\.marketo\.net|\.marketo\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.MARKETO, 'script')];
    }
    // Inline: Munchkin.init
    if (this._hasInlineMatch(domCache, /Munchkin\.init\s*\(/)) {
      return [this._result(LEADGEN_PLATFORMS.MARKETO, 'inline')];
    }
    // DOM: Marketo forms
    if (document.querySelector('.mktoForm, form[id^="mktoForm_"]')) {
      return [this._result(LEADGEN_PLATFORMS.MARKETO, 'dom')];
    }
    return [];
  }

  _detectActiveCampaign(pageContext, domCache) {
    // Script: trackcmp.net, activehosted.com
    if (this._hasScript(domCache, /trackcmp\.net|activehosted\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.ACTIVECAMPAIGN, 'script')];
    }
    // DOM: ActiveCampaign forms
    if (document.querySelector('form._form, ._form-content, [class*="ac-form"]')) {
      return [this._result(LEADGEN_PLATFORMS.ACTIVECAMPAIGN, 'dom')];
    }
    return [];
  }

  /* ------------------------------------------------------------------ */
  /*  Call Tracking                                                      */
  /* ------------------------------------------------------------------ */

  _detectCallRail(pageContext, domCache) {
    if (this._hasScript(domCache, /cdn\.callrail\.com|calltrk\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.CALLRAIL, 'script')];
    }
    if (this._hasInlineMatch(domCache, /CallTrk\.|calltrk/)) {
      return [this._result(LEADGEN_PLATFORMS.CALLRAIL, 'inline')];
    }
    return [];
  }

  _detectCTM(pageContext, domCache) {
    if (this._hasScript(domCache, /tctm\.co|calltrackingmetrics\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.CTM, 'script')];
    }
    if (this._hasInlineMatch(domCache, /__ctm\.|CallTrackingMetrics/)) {
      return [this._result(LEADGEN_PLATFORMS.CTM, 'inline')];
    }
    return [];
  }

  _detectWhatConverts(pageContext, domCache) {
    if (this._hasScript(domCache, /whatconverts\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.WHATCONVERTS, 'script')];
    }
    return [];
  }

  /* ------------------------------------------------------------------ */
  /*  Chat                                                               */
  /* ------------------------------------------------------------------ */

  _detectDrift(pageContext, domCache) {
    if (this._hasScript(domCache, /js\.driftt\.com|drift\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.DRIFT, 'script')];
    }
    if (this._hasInlineMatch(domCache, /drift\.load\s*\(|driftt\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.DRIFT, 'inline')];
    }
    if (document.querySelector('#drift-widget, #drift-frame')) {
      return [this._result(LEADGEN_PLATFORMS.DRIFT, 'dom')];
    }
    return [];
  }

  _detectIntercom(pageContext, domCache) {
    if (this._hasScript(domCache, /widget\.intercom\.io|intercomcdn\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.INTERCOM, 'script')];
    }
    if (this._hasInlineMatch(domCache, /Intercom\s*\(\s*['"]boot['"]/)) {
      return [this._result(LEADGEN_PLATFORMS.INTERCOM, 'inline')];
    }
    if (document.querySelector('#intercom-container, .intercom-lightweight-app')) {
      return [this._result(LEADGEN_PLATFORMS.INTERCOM, 'dom')];
    }
    return [];
  }

  _detectCrisp(pageContext, domCache) {
    if (this._hasScript(domCache, /client\.crisp\.chat/)) {
      return [this._result(LEADGEN_PLATFORMS.CRISP, 'script')];
    }
    if (this._hasInlineMatch(domCache, /\$crisp\s*=|CRISP_WEBSITE_ID/)) {
      return [this._result(LEADGEN_PLATFORMS.CRISP, 'inline')];
    }
    if (document.querySelector('.crisp-client, #crisp-chatbox')) {
      return [this._result(LEADGEN_PLATFORMS.CRISP, 'dom')];
    }
    return [];
  }

  _detectLiveChat(pageContext, domCache) {
    if (this._hasScript(domCache, /cdn\.livechatinc\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.LIVECHAT, 'script')];
    }
    if (this._hasInlineMatch(domCache, /LiveChatWidget\.|__lc\s*=/)) {
      return [this._result(LEADGEN_PLATFORMS.LIVECHAT, 'inline')];
    }
    if (document.querySelector('#chat-widget-container, [data-lc-widget]')) {
      return [this._result(LEADGEN_PLATFORMS.LIVECHAT, 'dom')];
    }
    return [];
  }

  _detectTidio(pageContext, domCache) {
    if (this._hasScript(domCache, /code\.tidio\.co/)) {
      return [this._result(LEADGEN_PLATFORMS.TIDIO, 'script')];
    }
    if (this._hasInlineMatch(domCache, /tidioChatCode|tidio\.co/)) {
      return [this._result(LEADGEN_PLATFORMS.TIDIO, 'inline')];
    }
    if (document.querySelector('#tidio-chat, #tidio-chat-iframe')) {
      return [this._result(LEADGEN_PLATFORMS.TIDIO, 'dom')];
    }
    return [];
  }

  /* ------------------------------------------------------------------ */
  /*  Scheduling                                                         */
  /* ------------------------------------------------------------------ */

  _detectCalendly(pageContext, domCache) {
    if (this._hasScript(domCache, /assets\.calendly\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.CALENDLY, 'script')];
    }
    if (document.querySelector('.calendly-inline-widget, .calendly-badge-widget, [data-url*="calendly.com"]')) {
      return [this._result(LEADGEN_PLATFORMS.CALENDLY, 'dom')];
    }
    if (document.querySelector('iframe[src*="calendly.com"]')) {
      return [this._result(LEADGEN_PLATFORMS.CALENDLY, 'dom')];
    }
    return [];
  }

  _detectChiliPiper(pageContext, domCache) {
    if (this._hasScript(domCache, /js\.chilipiper\.com/)) {
      return [this._result(LEADGEN_PLATFORMS.CHILIPIPER, 'script')];
    }
    if (this._hasInlineMatch(domCache, /ChiliPiper\.|chilipiper/)) {
      return [this._result(LEADGEN_PLATFORMS.CHILIPIPER, 'inline')];
    }
    return [];
  }
}
