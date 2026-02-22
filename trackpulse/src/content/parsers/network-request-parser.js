/**
 * Network Request Parser
 * Extracts event names and key parameters from tracking platform HTTP requests.
 */

export function parseNetworkRequest(platform, url, body) {
  const parsers = {
    ga4: parseGA4Request,
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

/**
 * GA4 Measurement Protocol parser.
 * Decodes compact parameter format: en=event_name, ep.*=event_params,
 * epn.*=numeric params, pr{N}id/nm/pr/qt=items, tr=revenue, tt=transaction_id, cu=currency
 */
function parseGA4Request(url, body) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  // POST body may contain URL-encoded params (same format as query string)
  let bodyParams = {};
  if (body && typeof body === 'string') {
    try {
      bodyParams = Object.fromEntries(new URLSearchParams(body));
    } catch (e) {}
  }

  const allParams = { ...urlParams, ...bodyParams };

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
 */
function parseMetaRequest(url, body) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

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

  // Parse bracket notation: cd[key]=value, ap[key]=value, pmd[key]=value
  if (!parsedCdJson) {
    const searchStr = urlObj.search;
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
 *   - URL params: event, sdkid (mon.tiktok.com and analytics.tiktok.com)
 *   - Batch events array in POST body
 */
function parseTikTokRequest(url, body) {
  let eventName = null;
  const eventParams = {};

  // Try JSON body first (primary analytics.tiktok.com format)
  if (body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;

      // Single event format
      if (data.event || data.type) {
        eventName = data.event || data.type;
        if (data.properties) Object.assign(eventParams, data.properties);
      }

      // Batch format: { batch: [{ type: 'track', event: 'ViewContent', ... }] }
      if (!eventName && Array.isArray(data.batch) && data.batch.length > 0) {
        const first = data.batch[0];
        eventName = first.event || first.type || null;
        if (first.properties) Object.assign(eventParams, first.properties);
        if (data.batch.length > 1) {
          eventParams._batchCount = data.batch.length;
        }
      }

      // Context data (pixel ID, page info)
      if (data.context?.pixel?.code) {
        eventParams.pixelId = data.context.pixel.code;
      }
    } catch (e) {}
  }

  // Fallback: URL params (mon.tiktok.com and pixel events.js calls)
  if (!eventName) {
    try {
      const urlObj = new URL(url);
      eventName = urlObj.searchParams.get('event') || urlObj.searchParams.get('ev') || null;
      const sdkid = urlObj.searchParams.get('sdkid');
      if (sdkid) eventParams.pixelId = sdkid;
    } catch (e) {}
  }

  return { eventName, params: eventParams, items: null };
}

/**
 * Pinterest Tag parser.
 * event param or ed JSON param.
 */
function parsePinterestRequest(url, body) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);
  const eventParams = {};

  let eventName = params.event || null;
  if (params.ed) {
    try {
      const ed = JSON.parse(decodeURIComponent(params.ed));
      Object.assign(eventParams, ed);
      if (!eventName && ed.event) eventName = ed.event;
    } catch (e) {}
  }

  return { eventName, params: eventParams, items: null };
}

/**
 * Snapchat Pixel parser.
 * Handles:
 *   - tr.snapchat.com/p?id=PIXEL_ID&ev=EVENT_NAME&...
 *   - tr.snapchat.com/v3/PIXEL_ID/events (Conversions API)
 *   - tr.snapchat.com/cm/i (cookie matching — detected but minimal data)
 */
function parseSnapchatRequest(url, body) {
  let eventName = null;
  const eventParams = {};
  let pixelId = null;

  try {
    const urlObj = new URL(url);
    const qp = Object.fromEntries(urlObj.searchParams);

    // Cookie matching endpoint — flag it
    if (urlObj.pathname.includes('/cm/')) {
      return { eventName: 'cookie_match', params: {}, items: null };
    }

    eventName = qp.ev || qp.event || qp.type || null;
    pixelId = qp.id || qp.pid || null;

    // Extract pixel ID from Conversions API URL path: /v3/{pixelId}/events
    if (!pixelId) {
      const pathMatch = urlObj.pathname.match(/\/v\d+\/([a-f0-9-]+)\/events/);
      if (pathMatch) pixelId = pathMatch[1];
    }

    // Copy relevant params
    for (const [key, value] of Object.entries(qp)) {
      if (!['id', 'pid', 'ev', 'event', 'type', 'v', 'if', 'ts'].includes(key)) {
        eventParams[key] = value;
      }
    }
  } catch (e) {}

  // Try JSON body (Conversions API v3)
  if (body && !eventName) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      eventName = data.event_type || data.event_name || null;
      if (data.event_conversion_type) eventParams.conversion_type = data.event_conversion_type;
      if (data.price) eventParams.price = data.price;
      if (data.currency) eventParams.currency = data.currency;
    } catch (e) {}
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
 */
function parseLinkedInRequest(url, body) {
  let eventName = null;
  const eventParams = {};

  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const qp = Object.fromEntries(urlObj.searchParams);

    // Cookie sync endpoints
    if (host === 'p.adsymptotic.com' || urlObj.pathname.includes('/px/li_sync')) {
      return { eventName: 'cookie_sync', params: {}, items: null };
    }

    // Firmographic enrichment
    if (host === 'sjs.bizographics.com') {
      return { eventName: 'firmographic_enrichment', params: { pid: qp.pid || null }, items: null };
    }

    // Main tracking endpoints (px.ads.linkedin.com, px4, dc)
    const partnerId = qp.pid || qp.partner_id || null;
    const conversionId = qp.conversionId || qp.conversion_id || null;

    if (conversionId) {
      eventName = 'conversion';
      eventParams.conversionId = conversionId;
    } else {
      eventName = 'pageview';
    }

    if (partnerId) eventParams.partnerId = partnerId;
    if (qp.url) eventParams.pageUrl = decodeURIComponent(qp.url);
    if (qp.fmt) eventParams.format = qp.fmt;
  } catch (e) {}

  // Try JSON body (www.linkedin.com/li/track may POST JSON)
  if (body && !eventName) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      eventName = data.eventType || data.event || 'track';
      if (data.partnerId) eventParams.partnerId = data.partnerId;
      if (data.conversionId) eventParams.conversionId = data.conversionId;
    } catch (e) {}
  }

  return { eventName, params: eventParams, items: null };
}

/**
 * Generic fallback parser for unknown platforms.
 */
function parseGenericRequest(url, body) {
  let eventName = null;
  const params = {};

  try {
    const urlObj = new URL(url);
    const qp = Object.fromEntries(urlObj.searchParams);
    eventName = qp.event || qp.ev || qp.type || null;
    Object.assign(params, qp);
  } catch (e) {}

  return { eventName, params, items: null };
}
