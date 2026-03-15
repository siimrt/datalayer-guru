(function () {
  'use strict';

  /**
   * Page Context Script — Runs in the MAIN world (page context).
   * Collects all relevant window objects and relays them to the content script
   * via window.postMessage.
   */

  // --- Reusable consent collection helpers ---
  function collectConsentData() {
    var consent = {
      cookieyes: false,
      cookiebot: null,
      oneTrust: null,
      axeptio: false,
      didomi: false,
      tarteaucitron: false,
      complianz: false,
      acceptio: false,
      iubenda: false,
      usercentrics: false,
      quantcast: false,
    };

    // CookieYes — no rich API
    consent.cookieyes = !!(window.CookieYes || window.ckyConsent);

    // Cookiebot — already rich
    if (window.Cookiebot) {
      try {
        consent.cookiebot = {
          consent: window.Cookiebot.consent
            ? JSON.parse(JSON.stringify(window.Cookiebot.consent))
            : null,
          consentID: window.Cookiebot.consentID || null,
        };
      } catch (e) {
        consent.cookiebot = { detected: true };
      }
    }

    // OneTrust — already rich
    if (window.OneTrust) {
      consent.oneTrust = {
        activeGroups: window.OptanonActiveGroups || null,
      };
    }

    // Didomi — rich extraction
    if (typeof window.Didomi !== 'undefined') {
      try {
        var didomiData = { detected: true };
        if (window.Didomi.getUserStatus) {
          didomiData.userStatus = JSON.parse(JSON.stringify(window.Didomi.getUserStatus()));
        }
        if (window.Didomi.getCurrentUserStatus) {
          didomiData.currentUserStatus = JSON.parse(JSON.stringify(window.Didomi.getCurrentUserStatus()));
        }
        consent.didomi = didomiData;
      } catch (e) {
        consent.didomi = { detected: true };
      }
    }

    // Axeptio — rich extraction
    if (typeof window._axcb !== 'undefined') {
      try {
        var axeptioData = { detected: true };
        if (window.axeptioSettings) {
          axeptioData.settings = JSON.parse(JSON.stringify(window.axeptioSettings));
        }
        consent.axeptio = axeptioData;
      } catch (e) {
        consent.axeptio = { detected: true };
      }
    }

    // Tarteaucitron — rich extraction
    if (typeof window.tarteaucitron !== 'undefined') {
      try {
        var tartData = { detected: true };
        if (window.tarteaucitron.state) {
          tartData.state = JSON.parse(JSON.stringify(window.tarteaucitron.state));
        }
        consent.tarteaucitron = tartData;
      } catch (e) {
        consent.tarteaucitron = { detected: true };
      }
    }

    // Complianz — rich extraction
    if (typeof window.complianz !== 'undefined') {
      try {
        var complianzData = { detected: true };
        if (window.complianz.categories) {
          complianzData.categories = JSON.parse(JSON.stringify(window.complianz.categories));
        }
        consent.complianz = complianzData;
      } catch (e) {
        consent.complianz = { detected: true };
      }
    }

    // Acceptio — no rich API known
    consent.acceptio = typeof window.acceptioSdk !== 'undefined' || typeof window.Acceptio !== 'undefined';

    // Iubenda — rich extraction
    if (typeof window._iub !== 'undefined') {
      try {
        var iubData = { detected: true };
        if (window._iub.cs && window._iub.cs.consent) {
          iubData.consent = JSON.parse(JSON.stringify(window._iub.cs.consent));
        }
        consent.iubenda = iubData;
      } catch (e) {
        consent.iubenda = { detected: true };
      }
    }

    // Usercentrics — rich extraction
    if (typeof window.UC_UI !== 'undefined') {
      try {
        var ucData = { detected: true };
        if (window.UC_UI.getServicesBaseInfo) {
          var services = window.UC_UI.getServicesBaseInfo();
          ucData.services = JSON.parse(JSON.stringify(services));
        }
        consent.usercentrics = ucData;
      } catch (e) {
        consent.usercentrics = { detected: true };
      }
    }

    // Quantcast / TCF — detection only (async TCF handled separately via postMessage)
    if (typeof window.__tcfapi !== 'undefined') {
      consent.quantcast = { detected: true };
    }

    return consent;
  }

  function collectGoogleConsentEvents() {
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      var consentEvents = window.dataLayer.filter(function (e) {
        return (Array.isArray(e) && e[0] === 'consent') ||
          (typeof e === 'object' && !Array.isArray(e) && e['0'] === 'consent') ||
          (e && e.event === 'consent_update') ||
          (e && e.event === 'gtm.init_consent');
      });
      if (consentEvents.length > 0) {
        return JSON.parse(JSON.stringify(consentEvents));
      }
    }
    return null;
  }

  function collectPageContext() {
    const context = {};

    // --- Shopify ---
    try {
      if (window.Shopify) {
        context.shopify = {
          shop: window.Shopify.shop || null,
          theme: window.Shopify.theme
            ? { name: window.Shopify.theme.name, id: window.Shopify.theme.id }
            : null,
          locale: window.Shopify.locale || null,
          currency: window.Shopify.currency?.active || null,
          checkout: null,
          routes: window.Shopify.routes || null,
        };
        try {
          if (window.Shopify.Checkout) {
            context.shopify.checkout = JSON.parse(
              JSON.stringify(window.Shopify.Checkout)
            );
          }
        } catch (e) {}
      }
    } catch (e) {}

    try {
      if (window.ShopifyAnalytics?.meta) {
        context.shopifyAnalytics = JSON.parse(
          JSON.stringify(window.ShopifyAnalytics.meta)
        );
      }
    } catch (e) {}

    try {
      if (window.meta?.product) {
        context.shopifyProduct = JSON.parse(
          JSON.stringify(window.meta.product)
        );
      }
    } catch (e) {}

    // Shopify checkout step
    try {
      if (window.Shopify?.Checkout?.step) {
        context.shopifyCheckoutStep = window.Shopify.Checkout.step;
      }
    } catch (e) {}

    // Shopify page type from analytics
    try {
      if (window.ShopifyAnalytics?.meta?.page?.pageType) {
        context.shopifyPageType = window.ShopifyAnalytics.meta.page.pageType;
      }
    } catch (e) {}

    // Shopify template
    try {
      if (window.ShopifyAnalytics?.meta?.page?.pageType) {
        context.shopifyTemplate = window.ShopifyAnalytics.meta.page.pageType;
      }
      // Also check meta.page.resourceType as fallback
      if (window.ShopifyAnalytics?.meta?.page?.resourceType) {
        context.shopifyResourceType =
          window.ShopifyAnalytics.meta.page.resourceType;
      }
    } catch (e) {}

    // Shopify checkout object (thank you page)
    try {
      if (window.Shopify?.checkout) {
        context.shopifyCheckoutData = JSON.parse(
          JSON.stringify(window.Shopify.checkout)
        );
      }
    } catch (e) {}

    // --- WooCommerce ---
    try {
      if (window.wc_add_to_cart_params) {
        context.wcAddToCart = JSON.parse(
          JSON.stringify(window.wc_add_to_cart_params)
        );
      }
    } catch (e) {}

    try {
      if (window.wc_cart_fragments_params) {
        context.wcCartFragments = JSON.parse(
          JSON.stringify(window.wc_cart_fragments_params)
        );
      }
    } catch (e) {}

    try {
      if (window.woocommerce_params) {
        context.wcParams = JSON.parse(
          JSON.stringify(window.woocommerce_params)
        );
      }
    } catch (e) {}

    try {
      if (window.wc_single_product_params) {
        context.wcSingleProduct = JSON.parse(
          JSON.stringify(window.wc_single_product_params)
        );
      }
    } catch (e) {}

    // --- PrestaShop ---
    try {
      if (window.prestashop) {
        context.prestashop = {};
        const keys = ['page', 'product', 'cart', 'currency', 'listing', 'customer'];
        for (const key of keys) {
          try {
            if (window.prestashop[key]) {
              context.prestashop[key] = JSON.parse(
                JSON.stringify(window.prestashop[key])
              );
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // --- Magento ---
    try {
      if (typeof window.require === 'function' && window.require.s?.contexts?._?.config) {
        context.magentoConfig = true;
      }
    } catch (e) {}

    // --- Webflow ---
    try {
      if (window.Webflow) {
        context.webflow = true;
      }
    } catch (e) {}

    // --- dataLayer ---
    try {
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        // Limit to first 200 entries to avoid huge payloads
        const limited = window.dataLayer.slice(0, 200);
        context.dataLayer = JSON.parse(JSON.stringify(limited));
      }
    } catch (e) {}

    // --- Pixel globals ---
    try {
      context.pixels = {
        fbq: typeof window.fbq === 'function',
        fbPixelId: null,
        gtag: typeof window.gtag === 'function',
        googleTagData: typeof window.google_tag_data === 'object' && window.google_tag_data !== null,
        ttq: typeof window.ttq === 'object' && window.ttq !== null,
        pintrk: typeof window.pintrk === 'function',
        snaptr: typeof window.snaptr === 'function',
        twq: typeof window.twq === 'function',
        lintrk: typeof window.lintrk === 'function',
      };
      // Try to get Facebook pixel ID
      try {
        if (window.fbq?.getState) {
          const state = window.fbq.getState();
          if (state?.pixels?.[0]?.id) {
            context.pixels.fbPixelId = state.pixels[0].id;
          }
        }
      } catch (e) {}
      // Try to get all FB pixel IDs from fbq.queue or instance
      try {
        if (window.fbq?.instance?.pixelsByID) {
          context.pixels.fbPixelIds = Object.keys(
            window.fbq.instance.pixelsByID
          );
        }
      } catch (e) {}
      // Try to get TikTok pixel IDs from ttq._t
      try {
        if (window.ttq && window.ttq._t) {
          context.pixels.ttqPixelIds = Object.keys(window.ttq._t);
        }
      } catch (e) {}
      // Try to get Pinterest pixel ID from pintrk queue
      try {
        if (window.pintrk?.queue) {
          for (const q of window.pintrk.queue) {
            if (q[0] === 'load' && q[1]) {
              context.pixels.pinterestPixelId = q[1];
              break;
            }
          }
        }
      } catch (e) {}
      // Try to get Snapchat pixel ID from snaptr queue or _pids
      try {
        if (window.snaptr?._pids && window.snaptr._pids.length > 0) {
          context.pixels.snapchatPixelId = window.snaptr._pids[0];
        } else if (window.snaptr?.queue) {
          for (const q of window.snaptr.queue) {
            if (q[0] === 'init' && q[1]) {
              context.pixels.snapchatPixelId = q[1];
              break;
            }
          }
        }
      } catch (e) {}
      // Try to get LinkedIn partner ID
      try {
        if (window._linkedin_partner_id) {
          context.pixels.linkedInPartnerId = String(window._linkedin_partner_id);
        }
      } catch (e) {}
    } catch (e) {}

    // --- Consent ---
    try {
      context.consent = collectConsentData();
    } catch (e) {}

    // --- Google Consent Mode ---
    try {
      var gce = collectGoogleConsentEvents();
      if (gce) context.googleConsentEvents = gce;
    } catch (e) {}

    // --- JS Globals existence (for CMS scoring) ---
    try {
      context.jsGlobals = {
        Shopify: typeof window.Shopify !== 'undefined',
        ShopifyAnalytics: typeof window.ShopifyAnalytics !== 'undefined',
        wc_add_to_cart_params:
          typeof window.wc_add_to_cart_params !== 'undefined',
        wc_cart_fragments_params:
          typeof window.wc_cart_fragments_params !== 'undefined',
        woocommerce_params: typeof window.woocommerce_params !== 'undefined',
        prestashop: typeof window.prestashop !== 'undefined',
        PrestaShop: typeof window.PrestaShop !== 'undefined',
        Mage: typeof window.Mage !== 'undefined',
        mageUrl: typeof window.mageUrl !== 'undefined',
        Webflow: typeof window.Webflow !== 'undefined',
      };
    } catch (e) {}

    return context;
  }

  // Send the collected context to the content script
  try {
    const context = collectPageContext();
    window.postMessage(
      {
        type: 'TRACKPULSE_PAGE_CONTEXT',
        payload: context,
      },
      '*'
    );
  } catch (e) {
    window.postMessage(
      {
        type: 'TRACKPULSE_PAGE_CONTEXT',
        payload: { error: e.message },
      },
      '*'
    );
  }

  // --- Set up dataLayer watcher (with guard to prevent double-wrapping on re-injection) ---
  try {
    function hookDataLayerPush() {
      if (window.__TRACKPULSE_DL_HOOKED__) return; // Already hooked
      if (!window.dataLayer || !Array.isArray(window.dataLayer)) return false;

      window.__TRACKPULSE_DL_HOOKED__ = true;
      const originalPush = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = function (...args) {
        const result = originalPush(...args);
        window.__TRACKPULSE_DL_LAST_LEN__ = window.dataLayer.length;
        try {
          window.postMessage(
            {
              type: 'TRACKPULSE_DATALAYER_PUSH',
              payload: JSON.parse(JSON.stringify(args)),
            },
            '*'
          );
        } catch (e) {}
        // Check if this push is a consent-related event and trigger update
        try {
          for (var ci = 0; ci < args.length; ci++) {
            var entry = args[ci];
            if (entry && (
              (Array.isArray(entry) && entry[0] === 'consent') ||
              (typeof entry === 'object' && !Array.isArray(entry) && entry['0'] === 'consent') ||
              (entry && entry.event === 'consent_update')
            )) {
              if (typeof window.__trackpulsePostConsentUpdate === 'function') window.__trackpulsePostConsentUpdate();
              break;
            }
          }
        } catch (e) {}
        return result;
      };

      // Replay existing entries so they appear in the live stream
      // (events pushed before the hook was installed, e.g. view_item on initial load)
      for (var i = 0; i < window.dataLayer.length; i++) {
        try {
          var replayEntry = JSON.parse(JSON.stringify(window.dataLayer[i]));
          replayEntry._replay = true;
          window.postMessage(
            {
              type: 'TRACKPULSE_DATALAYER_PUSH',
              payload: [replayEntry],
            },
            '*'
          );
        } catch (e) {}
      }

      // Track current length for polling safety net
      window.__TRACKPULSE_DL_LAST_LEN__ = window.dataLayer.length;

      // Polling safety net: check every 10s for entries that bypassed the hook
      if (!window.__TRACKPULSE_DL_POLL__) {
        window.__TRACKPULSE_DL_POLL__ = true;
        setInterval(function () {
          try {
            if (!window.dataLayer || !Array.isArray(window.dataLayer)) return;
            var lastLen = window.__TRACKPULSE_DL_LAST_LEN__ || 0;
            var curLen = window.dataLayer.length;
            if (curLen > lastLen) {
              for (var j = lastLen; j < curLen; j++) {
                try {
                  window.postMessage(
                    {
                      type: 'TRACKPULSE_DATALAYER_PUSH',
                      payload: JSON.parse(JSON.stringify([window.dataLayer[j]])),
                    },
                    '*'
                  );
                } catch (e) {}
              }
              window.__TRACKPULSE_DL_LAST_LEN__ = curLen;
            }
          } catch (e) {}
        }, 10000);
      }

      return true;
    }

    if (!hookDataLayerPush()) {
      // dataLayer doesn't exist yet — watch for it
      let dlCheckCount = 0;
      const dlChecker = setInterval(() => {
        dlCheckCount++;
        if (dlCheckCount > 50 || hookDataLayerPush()) {
          clearInterval(dlChecker);
        }
      }, 200);
    }
  } catch (e) {}

  // --- Set up network request monitoring (guard to prevent double-hooking on re-injection) ---
  try {
    if (!window.__TRACKPULSE_NET_HOOKED__) {
      window.__TRACKPULSE_NET_HOOKED__ = true;

      // Inline endpoint matching (can't import modules in MAIN world IIFE)
      var _TP_TRACKING_PATTERNS = [
        { platform: 'ga4',       re: /google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/ },
        { platform: 'meta',      re: /facebook\.com\/tr[\/?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/pixel|graph\.facebook\.com/ },
        { platform: 'tiktok',    re: /analytics\.tiktok\.com\/(?:api|i18n\/pixel)|mon\.tiktok\.com|business-api\.tiktok\.com/ },
        { platform: 'pinterest', re: /ct\.pinterest\.com|s\.pinimg\.com\/ct\/|trk\.pinterest\.com/ },
        { platform: 'snapchat',  re: /tr\.snapchat\.com\/|tr-shadow\.snapchat\.com/ },
        { platform: 'linkedin',  re: /px\.ads\.linkedin\.com|px4\.ads\.linkedin\.com|dc\.ads\.linkedin\.com|www\.linkedin\.com\/px\/|www\.linkedin\.com\/li\/track|p\.adsymptotic\.com|sjs\.bizographics\.com|linkedin\.oribi\.io/ },
      ];

      function _tpMatchUrl(url) {
        if (!url || typeof url !== 'string') return null;
        for (var i = 0; i < _TP_TRACKING_PATTERNS.length; i++) {
          if (_TP_TRACKING_PATTERNS[i].re.test(url)) return _TP_TRACKING_PATTERNS[i].platform;
        }
        return null;
      }

      function _tpPostNetworkHit(platform, url, method, body) {
        try {
          window.postMessage({
            type: 'TRACKPULSE_NETWORK_REQUEST',
            payload: {
              platform: platform,
              url: String(url).slice(0, 4000),
              method: method,
              body: body ? String(body).slice(0, 8000) : null,
              timestamp: Date.now(),
            },
          }, '*');
        } catch (e) {}
      }

      // Hook fetch
      var _origFetch = window.fetch;
      window.fetch = function (input, init) {
        try {
          var url = typeof input === 'string' ? input
                    : (input instanceof Request) ? input.url
                    : String(input);
          var platform = _tpMatchUrl(url);
          if (platform) {
            var method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
            var body = null;
            if (init && init.body) {
              if (typeof init.body === 'string') body = init.body;
              else if (init.body instanceof URLSearchParams) body = init.body.toString();
              else if (typeof Blob !== 'undefined' && init.body instanceof Blob && init.body.size < 16000) {
                // Async read Blob body (TikTok sometimes sends JSON as Blob)
                init.body.text().then(function (text) {
                  _tpPostNetworkHit(platform, url, method, text);
                }).catch(function () {});
                body = '__blob_pending__';
              }
            }
            if (body !== '__blob_pending__') _tpPostNetworkHit(platform, url, method, body);
          }
        } catch (e) {}
        return _origFetch.apply(this, arguments);
      };

      // Hook XMLHttpRequest
      var _origXHROpen = XMLHttpRequest.prototype.open;
      var _origXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url) {
        this.__tp_method = method;
        this.__tp_url = String(url);
        return _origXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function (body) {
        try {
          if (this.__tp_url) {
            var platform = _tpMatchUrl(this.__tp_url);
            if (platform) {
              _tpPostNetworkHit(
                platform,
                this.__tp_url,
                this.__tp_method || 'GET',
                body ? String(body) : null
              );
            }
          }
        } catch (e) {}
        return _origXHRSend.apply(this, arguments);
      };

      // Hook navigator.sendBeacon
      if (navigator.sendBeacon) {
        var _origBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url, data) {
          try {
            var platform = _tpMatchUrl(String(url));
            if (platform) {
              _tpPostNetworkHit(platform, String(url), 'BEACON', data ? String(data) : null);
            }
          } catch (e) {}
          return _origBeacon.apply(navigator, arguments);
        };
      }

      // Hook Image.src for pixel-based tracking (Meta, LinkedIn, Pinterest, etc.)
      // Many tracking platforms (especially Facebook/Meta) fire events via new Image().src
      // which bypasses fetch/XHR/sendBeacon hooks but is visible in browser Network tab.
      try {
        var _origImgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (_origImgSrcDesc && _origImgSrcDesc.set) {
          Object.defineProperty(HTMLImageElement.prototype, 'src', {
            set: function (val) {
              if (val && typeof val === 'string') {
                var p = _tpMatchUrl(val);
                if (p) _tpPostNetworkHit(p, val, 'IMG', null);
              }
              return _origImgSrcDesc.set.call(this, val);
            },
            get: _origImgSrcDesc.get,
            enumerable: true,
            configurable: true,
          });
        }
      } catch (e) {}

      // Also hook setAttribute('src', ...) on images (some SDKs use this)
      try {
        var _origImgSetAttr = HTMLImageElement.prototype.setAttribute;
        HTMLImageElement.prototype.setAttribute = function (name, value) {
          if (name === 'src' && value && typeof value === 'string') {
            var p = _tpMatchUrl(value);
            if (p) _tpPostNetworkHit(p, value, 'IMG', null);
          }
          return _origImgSetAttr.call(this, name, value);
        };
      } catch (e) {}
    }
  } catch (e) {}

  // --- Listen for code execution requests (guard to prevent duplicates on re-injection) ---
  if (!window.__TRACKPULSE_EXECUTE_LISTENER__) {
    window.__TRACKPULSE_EXECUTE_LISTENER__ = true;
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.type === 'TRACKPULSE_EXECUTE_IN_PAGE') {
        try {
          const fn = new Function(event.data.code);
          fn();
          window.postMessage(
            { type: 'TRACKPULSE_EXECUTE_RESULT', payload: { success: true } },
            '*'
          );
        } catch (err) {
          window.postMessage(
            { type: 'TRACKPULSE_EXECUTE_RESULT', payload: { success: false, error: err.message } },
            '*'
          );
        }
      }
    });
  }

  // --- TCF async data collection (Quantcast / IAB TCF) ---
  try {
    if (typeof window.__tcfapi !== 'undefined' && !window.__TRACKPULSE_TCF_QUERIED__) {
      window.__TRACKPULSE_TCF_QUERIED__ = true;
      window.__tcfapi('getTCData', 2, function(tcData, success) {
        try {
          if (success && tcData) {
            window.postMessage({
              type: 'TRACKPULSE_TCF_DATA',
              payload: {
                tcfPolicyVersion: tcData.tcfPolicyVersion || null,
                cmpId: tcData.cmpId || null,
                purpose: tcData.purpose || null,
                vendor: tcData.vendor ? { consents: tcData.vendor.consents } : null,
              },
            }, '*');
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
  // --- Consent change watchers (guard to prevent double-registration on re-injection) ---
  try {
    if (!window.__TRACKPULSE_CONSENT_WATCHER__) {
      window.__TRACKPULSE_CONSENT_WATCHER__ = true;

      var postConsentUpdate = function() {
        try {
          var consent = collectConsentData();
          var googleConsentEvents = collectGoogleConsentEvents();
          window.postMessage({
            type: 'TRACKPULSE_CONSENT_UPDATE',
            payload: { consent: consent, googleConsentEvents: googleConsentEvents }
          }, '*');
        } catch(e) {}
      };
      // Expose for dataLayer hook to call
      window.__trackpulsePostConsentUpdate = postConsentUpdate;

      // Didomi
      try { window.addEventListener('didomi:consent.changed', postConsentUpdate); } catch (e) {}

      // OneTrust
      try { window.addEventListener('consent.onetrust', postConsentUpdate); } catch (e) {}

      // Cookiebot
      try {
        window.addEventListener('CookiebotOnAccept', postConsentUpdate);
        window.addEventListener('CookiebotOnDecline', postConsentUpdate);
      } catch (e) {}

      // CookieYes
      try { window.addEventListener('cookieyes_consent_update', postConsentUpdate); } catch (e) {}

      // Axeptio
      try {
        if (window._axcb) {
          window._axcb.push(function() { postConsentUpdate(); });
        }
      } catch (e) {}

      // Tarteaucitron
      try { document.addEventListener('tarteaucitron_response', postConsentUpdate); } catch (e) {}

      // Complianz
      try { document.addEventListener('cmplz_status_change', postConsentUpdate); } catch (e) {}

      // Iubenda
      try {
        if (window._iub && window._iub.cs && window._iub.cs.api && window._iub.cs.api.onPreferenceExpressed) {
          window._iub.cs.api.onPreferenceExpressed(postConsentUpdate);
        }
      } catch (e) {}

      // Usercentrics
      try { window.addEventListener('UC_UI_CMP_EVENT', postConsentUpdate); } catch (e) {}

      // Quantcast / TCF
      try {
        if (window.__tcfapi) {
          window.__tcfapi('addEventListener', 2, function(tcData, success) {
            if (success && tcData.eventStatus === 'useractioncomplete') postConsentUpdate();
          });
        }
      } catch (e) {}
    }
  } catch (e) {}

  // --- Early CMP polling (detect async-loaded CMPs) ---
  try {
    if (!window.__TRACKPULSE_CMP_POLL__) {
      window.__TRACKPULSE_CMP_POLL__ = true;

      var hasAnyCMP = function() {
        return !!(window.CookieYes || window.ckyConsent || window.Cookiebot ||
                  window.OneTrust || window.Didomi || window._axcb ||
                  window.tarteaucitron || window.complianz || window.acceptioSdk ||
                  window.Acceptio || window._iub || window.UC_UI || window.__tcfapi);
      };

      // Only poll if no CMP was detected during initial collection
      if (!hasAnyCMP()) {
        var _cmpPollCount = 0;
        var _cmpPollMax = 20; // 20 * 500ms = 10s
        var _cmpPoller = setInterval(function () {
          try {
            _cmpPollCount++;
            if (hasAnyCMP()) {
              clearInterval(_cmpPoller);
              // CMP found — post updated consent data
              try {
                var consent = collectConsentData();
                var googleConsentEvents = collectGoogleConsentEvents();
                window.postMessage({
                  type: 'TRACKPULSE_CONSENT_UPDATE',
                  payload: { consent: consent, googleConsentEvents: googleConsentEvents }
                }, '*');
              } catch (e) {}
            } else if (_cmpPollCount >= _cmpPollMax) {
              clearInterval(_cmpPoller);
            }
          } catch (e) {
            clearInterval(_cmpPoller);
          }
        }, 500);
      }
    }
  } catch (e) {}
})();
