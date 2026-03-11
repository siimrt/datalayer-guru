/**
 * Early Network Hooks — MAIN world script.
 * Injected natively via manifest "world": "MAIN" to bypass CSP restrictions.
 * Hooks fetch, XHR, sendBeacon, and Image.src before any tracking pixels load.
 */
(function () {
  'use strict';

  if (window.__TRACKPULSE_NET_HOOKED__) return;
  window.__TRACKPULSE_NET_HOOKED__ = true;

  var _TP_TRACKING_PATTERNS = [
    { platform: 'ga4',       re: /google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/ },
    { platform: 'ga4',       re: /\/g\/collect\?.*tid=G-/ },  // Server-side GTM proxy (Stape, etc.)
    { platform: 'google_ads', re: /googleads\.g\.doubleclick\.net\/pagead\/(?:conversion|viewthroughconversion)|googleadservices\.com\/pagead\/conversion/ },
    { platform: 'meta',      re: /facebook\.com\/tr[\/\?]|facebook\.com\/tr$|facebook\.com\/privacy_sandbox\/pixel|graph\.facebook\.com/ },
    { platform: 'tiktok',    re: /analytics\.tiktok\.com\/api\/|analytics\.tiktok\.com\/i18n\/pixel|mon\.tiktok\.com/ },
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
  window.fetch = function(input, init) {
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

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__tp_method = method;
    this.__tp_url = String(url);
    return _origXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    try {
      if (this.__tp_url) {
        var platform = _tpMatchUrl(this.__tp_url);
        if (platform) {
          _tpPostNetworkHit(platform, this.__tp_url, this.__tp_method || 'GET', body ? String(body) : null);
        }
      }
    } catch (e) {}
    return _origXHRSend.apply(this, arguments);
  };

  // Hook navigator.sendBeacon
  if (navigator.sendBeacon) {
    var _origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      try {
        var platform = _tpMatchUrl(String(url));
        if (platform) {
          _tpPostNetworkHit(platform, String(url), 'BEACON', data ? String(data) : null);
        }
      } catch (e) {}
      return _origBeacon.apply(navigator, arguments);
    };
  }

  // Hook Image.src
  try {
    var _origImgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (_origImgSrcDesc && _origImgSrcDesc.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set: function(val) {
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

  // Hook setAttribute('src', ...) on images
  try {
    var _origImgSetAttr = HTMLImageElement.prototype.setAttribute;
    HTMLImageElement.prototype.setAttribute = function(name, value) {
      if (name === 'src' && value && typeof value === 'string') {
        var p = _tpMatchUrl(value);
        if (p) _tpPostNetworkHit(p, value, 'IMG', null);
      }
      return _origImgSetAttr.call(this, name, value);
    };
  } catch (e) {}
})();
