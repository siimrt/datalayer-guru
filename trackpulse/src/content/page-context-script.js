(function () {
  'use strict';

  /**
   * Page Context Script — Runs in the MAIN world (page context).
   * Collects all relevant window objects and relays them to the content script
   * via window.postMessage.
   */

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
    } catch (e) {}

    // --- Consent ---
    try {
      context.consent = {
        cookiebot: null,
        oneTrust: null,
        axeptio: false,
        didomi: false,
        tarteaucitron: false,
        complianz: false,
      };

      if (window.Cookiebot) {
        try {
          context.consent.cookiebot = {
            consent: window.Cookiebot.consent
              ? JSON.parse(JSON.stringify(window.Cookiebot.consent))
              : null,
            consentID: window.Cookiebot.consentID || null,
          };
        } catch (e) {}
      }

      if (window.OneTrust) {
        context.consent.oneTrust = {
          activeGroups: window.OptanonActiveGroups || null,
        };
      }

      context.consent.axeptio = typeof window._axcb !== 'undefined';
      context.consent.didomi = typeof window.Didomi !== 'undefined';
      context.consent.tarteaucitron =
        typeof window.tarteaucitron !== 'undefined';
      context.consent.complianz = typeof window.complianz !== 'undefined';
    } catch (e) {}

    // --- Google Consent Mode ---
    try {
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        const consentEvents = window.dataLayer.filter(
          (e) =>
            (Array.isArray(e) && e[0] === 'consent') ||
            e?.event === 'consent_update' ||
            e?.event === 'gtm.init_consent'
        );
        if (consentEvents.length > 0) {
          context.googleConsentEvents = JSON.parse(
            JSON.stringify(consentEvents)
          );
        }
      }
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
        try {
          window.postMessage(
            {
              type: 'TRACKPULSE_DATALAYER_PUSH',
              payload: JSON.parse(JSON.stringify(args)),
            },
            '*'
          );
        } catch (e) {}
        return result;
      };
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
        { platform: 'meta',      re: /facebook\.com\/tr[\/?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/pixel/ },
        { platform: 'tiktok',    re: /analytics\.tiktok\.com|mon\.tiktok\.com/ },
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
            }
            _tpPostNetworkHit(platform, url, method, body);
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
})();
