/**
 * Network Request Parser
 * Extracts event names and key parameters from tracking platform HTTP requests.
 *
 * All parsers merge URL query params with POST body params (URL-encoded or JSON)
 * so that events are detected regardless of whether data is in the URL or body.
 */

export function parseNetworkRequest(platform, url, body) {
  const parsers = {
    ga4: parseGA4Request,
    google_ads: parseGoogleAdsRequest,
    meta: parseMetaRequest,
    tiktok: parseTikTokRequest,
    pinterest: parsePinterestRequest,
    snapchat: parseSnapchatRequest,
    linkedin: parseLinkedInRequest,
  };

  const parser = parsers[platform] || parseGenericRequest;
  try {
    return parser(url, body);
  } catch (e) {
    return { eventName: null, params: {}, items: null };
  }
}

// ---- Shared Helpers ----

/**
 * Merge URL query params with POST body (URL-encoded).
 * Body params take precedence over URL params when keys overlap.
 */
function mergeUrlAndBodyParams(url, body) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  let bodyParams = {};
  if (body && typeof body === 'string') {
    try {
      bodyParams = Object.fromEntries(new URLSearchParams(body));
    } catch (e) {}
  }

  return { urlObj, params: { ...urlParams, ...bodyParams } };
}

/**
 * Try to parse body as JSON. Returns parsed object or null.
 */
function tryParseJsonBody(body) {
  if (!body) return null;
  try {
    return typeof body === 'string' ? JSON.parse(body) : body;
  } catch (e) {
    return null;
  }
}

// ---- Platform Parsers ----

/**
 * GA4 Measurement Protocol parser.
 * Decodes compact parameter format: en=event_name, ep.*=event_params,
 * epn.*=numeric params, pr{N}id/nm/pr/qt=items, tr=revenue, tt=transaction_id, cu=currency
 */
function parseGA4Request(url, body) {
  const { params: allParams } = mergeUrlAndBodyParams(url, body);

  const eventName = allParams.en || null;

  // Extract event parameters (ep.* = string, epn.* = numeric)
  const eventParams = {};
  for (const [key, value] of Object.entries(allParams)) {
    if (key.startsWith('ep.')) {
      eventParams[key.slice(3)] = value;
    } else if (key.startsWith('epn.')) {
      eventParams[key.slice(4)] = Number(value);
    }
  }

  // Extract items (pr1nm, pr1id, pr1pr, pr1qt, etc.)
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const prefix = `pr${i}`;
    if (allParams[`${prefix}id`] || allParams[`${prefix}nm`]) {
      items.push({
        item_id: allParams[`${prefix}id`] || null,
        item_name: allParams[`${prefix}nm`] || null,
        price: allParams[`${prefix}pr`] ? Number(allParams[`${prefix}pr`]) : null,
        quantity: allParams[`${prefix}qt`] ? Number(allParams[`${prefix}qt`]) : null,
        item_brand: allParams[`${prefix}br`] || null,
        item_category: allParams[`${prefix}ca`] || null,
      });
    }
  }

  // Compact tilde-delimited format: pr1=nmProductName~id123~pr49.99~brBrand~caCat
  if (items.length === 0) {
    for (let i = 1; i <= 20; i++) {
      const compact = allParams[`pr${i}`];
      if (!compact) continue;
      const item = {};
      for (const part of compact.split('~')) {
        const key = part.substring(0, 2);
        const val = part.substring(2);
        switch (key) {
          case 'nm': item.item_name = val; break;
          case 'id': item.item_id = val; break;
          case 'pr': item.price = Number(val); break;
          case 'qt': item.quantity = Number(val); break;
          case 'br': item.item_brand = val; break;
          case 'ca': item.item_category = val; break;
          case 'va': item.item_variant = val; break;
        }
      }
      if (item.item_name || item.item_id) items.push(item);
    }
  }

  // Key ecommerce values
  if (allParams.tr) eventParams.value = Number(allParams.tr);
  if (allParams.tt) eventParams.transaction_id = allParams.tt;
  if (allParams.cu) eventParams.currency = allParams.cu;

  return {
    eventName,
    params: eventParams,
    items: items.length > 0 ? items : null,
    measurementId: allParams.tid || null,
  };
}

/**
 * Meta/Facebook Pixel parser.
 * Handles two formats:
 *   1. Classic: ev=EventName, cd=JSON_custom_data, id=pixel_id
 *   2. Privacy Sandbox / bracket notation: ev=ViewContent, cd[content_type]=product, cd[currency]=EUR, ...
 * Also parses ap[key]=value (auto parameters) the same way.
 * Merges URL + POST body params.
 */
function parseMetaRequest(url, body) {
  const { urlObj, params } = mergeUrlAndBodyParams(url, body);

  const eventName = params.ev || null;
  const eventParams = {};

  // Check if cd is a single JSON value (classic format)
  let parsedCdJson = false;
  if (params.cd) {
    try {
      const customData = JSON.parse(decodeURIComponent(params.cd));
      if (typeof customData === 'object' && customData !== null) {
        Object.assign(eventParams, customData);
        parsedCdJson = true;
      }
    } catch (e) {}
  }

  // Parse bracket notation from both URL and body: cd[key]=value, ap[key]=value, pmd[key]=value
  const searchSources = [urlObj.search];
  if (body && typeof body === 'string') searchSources.push('&' + body);

  if (!parsedCdJson) {
    for (const searchStr of searchSources) {
      const bracketRegex = /(?:^|&)(cd|ap|pmd)\[([^\]]+)\]=([^&]*)/g;
      let match;
      while ((match = bracketRegex.exec(searchStr)) !== null) {
        const prefix = match[1]; // cd, ap, or pmd
        const key = decodeURIComponent(match[2]);
        let value = decodeURIComponent(match[3]);

        // Try to parse JSON values (e.g. cd[contents]=[{...}])
        if (value.startsWith('[') || value.startsWith('{')) {
          try { value = JSON.parse(value); } catch (e) {}
        }

        if (prefix === 'cd') {
          eventParams[key] = value;
        } else if (prefix === 'ap') {
          eventParams[`ap_${key}`] = value;
        }
        // Skip pmd (page metadata) — too verbose
      }
    }
  }

  return {
    eventName,
    params: eventParams,
    items: eventParams.contents || null,
    pixelId: params.id || null,
  };
}

/**
 * TikTok Pixel parser.
 * Handles:
 *   - JSON POST body with event/properties (analytics.tiktok.com)
 *   - URL-encoded POST body params
 *   - URL params: event, sdkid (mon.tiktok.com and analytics.tiktok.com)
 *   - Batch events array in POST body
 */
function parseTikTokRequest(url, body) {
  let eventName = null;
  const eventParams = {};

  // Helper: extract event from an object trying multiple field names
  function pickEvent(obj) {
    return obj.event || obj.type || obj.action || obj.event_name || obj.eventType || null;
  }
  function pickProps(obj) {
    if (obj.properties) Object.assign(eventParams, obj.properties);
    if (obj.params) Object.assign(eventParams, obj.params);
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) Object.assign(eventParams, obj.data);
  }

  // Try JSON body first (primary analytics.tiktok.com format)
  const jsonData = tryParseJsonBody(body);
  if (jsonData) {
    // Single event format
    eventName = pickEvent(jsonData);
    if (eventName) pickProps(jsonData);

    // Batch format: { batch: [{ type: 'track', event: 'ViewContent', ... }] }
    if (!eventName && Array.isArray(jsonData.batch) && jsonData.batch.length > 0) {
      const first = jsonData.batch[0];
      eventName = pickEvent(first);
      pickProps(first);
      if (jsonData.batch.length > 1) eventParams._batchCount = jsonData.batch.length;
    }

    // Data array format: { data: [{ event: '...', ... }] }
    if (!eventName && Array.isArray(jsonData.data) && jsonData.data.length > 0) {
      const first = jsonData.data[0];
      eventName = pickEvent(first);
      pickProps(first);
    }

    // Events array format: { events: [{ type: '...', ... }] }
    if (!eventName && Array.isArray(jsonData.events) && jsonData.events.length > 0) {
      const first = jsonData.events[0];
      eventName = pickEvent(first);
      pickProps(first);
    }

    // Context data (pixel ID, page info)
    if (jsonData.context?.pixel?.code) eventParams.pixelId = jsonData.context.pixel.code;
    if (!eventParams.pixelId && jsonData.pixel_code) eventParams.pixelId = jsonData.pixel_code;
  }

  // Fallback: merge URL params + URL-encoded body params
  if (!eventName) {
    const { params: allParams } = mergeUrlAndBodyParams(url, body);
    eventName = allParams.event || allParams.ev || allParams.type || allParams.action || null;
    const sdkid = allParams.sdkid || allParams.pixel_id;
    if (sdkid) eventParams.pixelId = sdkid;
  }

  // Return pixelId as top-level field (consistent with other parsers)
  const result = { eventName, params: eventParams, items: null };
  if (eventParams.pixelId) result.pixelId = eventParams.pixelId;
  return result;
}

/**
 * Pinterest Tag parser.
 * Merges URL + POST body params. Checks event param and ed JSON param.
 */
function parsePinterestRequest(url, body) {
  const { params } = mergeUrlAndBodyParams(url, body);
  const eventParams = {};

  let eventName = params.event || null;

  // Also try JSON body (Pinterest CAPI can POST JSON)
  if (!eventName) {
    const jsonData = tryParseJsonBody(body);
    if (jsonData) {
      eventName = jsonData.event || jsonData.event_name || null;
      if (jsonData.custom_data) Object.assign(eventParams, jsonData.custom_data);
    }
  }

  if (params.ed) {
    try {
      const ed = JSON.parse(decodeURIComponent(params.ed));
      Object.assign(eventParams, ed);
      if (!eventName && ed.event) eventName = ed.event;
    } catch (e) {}
  }

  const pixelId = params.tid || null;
  return { eventName, params: eventParams, items: null, pixelId };
}

/**
 * Snapchat Pixel parser.
 * Handles:
 *   - tr.snapchat.com/p?id=PIXEL_ID&ev=EVENT_NAME&...
 *   - tr.snapchat.com/v3/PIXEL_ID/events (Conversions API)
 *   - tr.snapchat.com/cm/i (cookie matching — detected but minimal data)
 * Merges URL + POST body params.
 */
function parseSnapchatRequest(url, body) {
  let eventName = null;
  const eventParams = {};
  let pixelId = null;

  try {
    const { urlObj, params: allParams } = mergeUrlAndBodyParams(url, body);

    // Cookie matching endpoint — flag it
    if (urlObj.pathname.includes('/cm/')) {
      return { eventName: 'cookie_match', params: {}, items: null };
    }

    eventName = allParams.ev || allParams.event || allParams.type || null;
    pixelId = allParams.id || allParams.pid || null;

    // Extract pixel ID from Conversions API URL path: /v3/{pixelId}/events
    if (!pixelId) {
      const pathMatch = urlObj.pathname.match(/\/v\d+\/([a-f0-9-]+)\/events/);
      if (pathMatch) pixelId = pathMatch[1];
    }

    // Copy relevant params
    for (const [key, value] of Object.entries(allParams)) {
      if (!['id', 'pid', 'ev', 'event', 'type', 'v', 'if', 'ts'].includes(key)) {
        eventParams[key] = value;
      }
    }
  } catch (e) {}

  // Try JSON body (Conversions API v3)
  if (!eventName) {
    const jsonData = tryParseJsonBody(body);
    if (jsonData) {
      eventName = jsonData.event_type || jsonData.event_name || jsonData.event || null;
      if (jsonData.event_conversion_type) eventParams.conversion_type = jsonData.event_conversion_type;
      if (jsonData.price) eventParams.price = jsonData.price;
      if (jsonData.currency) eventParams.currency = jsonData.currency;
    }
  }

  const result = { eventName, params: eventParams, items: null };
  if (pixelId) result.pixelId = pixelId;
  return result;
}

/**
 * LinkedIn Insight Tag / Conversion Tracking parser.
 * Handles:
 *   - px.ads.linkedin.com/collect?pid=PARTNER_ID&conversionId=ID&fmt=js&url=...
 *   - px4.ads.linkedin.com (same format, load-balanced)
 *   - dc.ads.linkedin.com/collect (legacy)
 *   - www.linkedin.com/li/track (beacon endpoint)
 *   - www.linkedin.com/px/li_sync (cookie sync — detected but minimal data)
 *   - sjs.bizographics.com (firmographic enrichment)
 *   - p.adsymptotic.com (redirect in cookie sync chain)
 * Merges URL + POST body params.
 */
function parseLinkedInRequest(url, body) {
  let eventName = null;
  const eventParams = {};

  try {
    const { urlObj, params: allParams } = mergeUrlAndBodyParams(url, body);
    const host = urlObj.hostname;

    // Cookie sync endpoints
    if (host === 'p.adsymptotic.com' || urlObj.pathname.includes('/px/li_sync')) {
      return { eventName: 'cookie_sync', params: {}, items: null };
    }

    // Firmographic enrichment
    if (host === 'sjs.bizographics.com') {
      return { eventName: 'firmographic_enrichment', params: { pid: allParams.pid || null }, items: null };
    }

    // Main tracking endpoints (px.ads.linkedin.com, px4, dc)
    const partnerId = allParams.pid || allParams.partner_id || null;
    const conversionId = allParams.conversionId || allParams.conversion_id || null;

    if (conversionId) {
      eventName = 'conversion';
      eventParams.conversionId = conversionId;
    } else {
      eventName = 'pageview';
    }

    if (partnerId) eventParams.partnerId = partnerId;
    if (allParams.url) eventParams.pageUrl = decodeURIComponent(allParams.url);
    if (allParams.fmt) eventParams.format = allParams.fmt;
  } catch (e) {}

  // Try JSON body (www.linkedin.com/li/track may POST JSON)
  if (body && (!eventName || eventName === 'pageview')) {
    const jsonData = tryParseJsonBody(body);
    if (jsonData) {
      const jsonEvent = jsonData.eventType || jsonData.event || null;
      if (jsonEvent) eventName = jsonEvent;
      if (jsonData.partnerId) eventParams.partnerId = jsonData.partnerId;
      if (jsonData.conversionId) {
        eventParams.conversionId = jsonData.conversionId;
        if (!eventName || eventName === 'pageview') eventName = 'conversion';
      }
    }
  }

  const result = { eventName, params: eventParams, items: null };
  if (eventParams.partnerId) result.pixelId = eventParams.partnerId;
  return result;
}

/**
 * Google Ads Conversion parser.
 * Handles:
 *   - googleads.g.doubleclick.net/pagead/conversion/AW_ID/?label=LABEL&...
 *   - googleadservices.com/pagead/conversion/AW_ID/?label=LABEL&...
 * Extracts conversion ID, label, value, currency from URL params.
 */
function parseGoogleAdsRequest(url, body) {
  const eventParams = {};
  let eventName = 'conversion';
  let pixelId = null;

  try {
    const { urlObj, params: allParams } = mergeUrlAndBodyParams(url, body);

    // Extract AW-ID from path: /pagead/conversion/XXXXXXXXX/
    const pathMatch = urlObj.pathname.match(/\/conversion\/(\d+)\//);
    if (pathMatch) pixelId = `AW-${pathMatch[1]}`;

    // Conversion label
    const label = allParams.label || allParams.gtm_label || null;
    if (label) {
      eventParams.label = label;
      eventName = `conversion/${label}`;
    }

    // Conversion value & currency
    if (allParams.value) eventParams.value = Number(allParams.value);
    if (allParams.currency_code) eventParams.currency = allParams.currency_code;

    // Order ID
    if (allParams.oid) eventParams.order_id = allParams.oid;

    // Remarketing vs conversion
    if (allParams.aw_remarketing_only === '1' || allParams.aw_remarketing_only === 'true') {
      eventName = 'remarketing';
    }

    // View-through conversion
    if (urlObj.pathname.includes('viewthroughconversion')) {
      eventName = label ? `view_through/${label}` : 'view_through_conversion';
    }
  } catch (e) {}

  const result = { eventName, params: eventParams, items: null };
  if (pixelId) result.pixelId = pixelId;
  return result;
}

/**
 * Generic fallback parser for unknown platforms.
 * Merges URL + POST body params, also tries JSON body.
 */
function parseGenericRequest(url, body) {
  const { params: allParams } = mergeUrlAndBodyParams(url, body);
  let eventName = allParams.event || allParams.ev || allParams.type || null;

  // Try JSON body as fallback
  if (!eventName) {
    const jsonData = tryParseJsonBody(body);
    if (jsonData) {
      eventName = jsonData.event || jsonData.event_name || jsonData.eventType || jsonData.type || null;
    }
  }

  return { eventName, params: allParams, items: null };
}

// ---- Server-Side Detection ----

const GOOGLE_OWNED_SUFFIXES = [
  'google.com', 'google-analytics.com', 'googleapis.com',
  'googleadservices.com', 'doubleclick.net', 'googlesyndication.com',
];

export function isServerSideRequest(url) {
  try {
    const host = new URL(url).hostname;
    return !GOOGLE_OWNED_SUFFIXES.some(s => host === s || host.endsWith('.' + s));
  } catch { return false; }
}

// ---- Network → GeneratedEvent Converter ----

export function networkRequestToGeneratedEvent(netEntry) {
  if (!netEntry.eventName) return null;
  const { platform, eventName } = netEntry;
  const params = netEntry.params || {};
  const items = netEntry.items;
  const serverSide = isServerSideRequest(netEntry.url);

  let data, code;
  if (platform === 'ga4') {
    const eventObj = { event: eventName };
    const ecomKeys = ['currency', 'value', 'transaction_id'];
    const hasEcom = items || ecomKeys.some(k => params[k] != null);
    if (hasEcom) {
      eventObj.ecommerce = {};
      for (const k of ecomKeys) { if (params[k] != null) eventObj.ecommerce[k] = params[k]; }
      if (items) eventObj.ecommerce.items = items;
      for (const [k, v] of Object.entries(params)) { if (!ecomKeys.includes(k)) eventObj[k] = v; }
    } else {
      Object.assign(eventObj, params);
    }
    data = eventObj;
    const label = serverSide ? 'Server-Side' : 'Client-Side';
    code = `// Detected via network \u2014 ${label}\ndataLayer.push({ ecommerce: null });\ndataLayer.push(${JSON.stringify(eventObj, null, 2)});`;
  } else {
    data = { event: eventName, ...params };
    code = `// Detected via network request\n${JSON.stringify(data, null, 2)}`;
  }

  return {
    platform, eventName, code, data,
    pageType: null,
    source: serverSide ? 'server-side' : 'client-side',
    measurementId: netEntry.measurementId || null,
    pixelId: netEntry.pixelId || null,
  };
}
