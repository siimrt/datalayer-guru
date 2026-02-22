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
    snapchat: parseGenericRequest,
    linkedin: parseGenericRequest,
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

  // Try classic JSON cd parameter first
  if (params.cd && !params.cd.startsWith('[') && !params.cd.startsWith('{') === false) {
    // Looks like a JSON blob
  }

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
 * JSON POST body with event/properties.
 */
function parseTikTokRequest(url, body) {
  let eventName = null;
  const eventParams = {};

  if (body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      eventName = data.event || data.type || null;
      if (data.properties) Object.assign(eventParams, data.properties);
    } catch (e) {}
  }

  // Fallback: URL params
  if (!eventName) {
    try {
      const urlObj = new URL(url);
      eventName = urlObj.searchParams.get('event') || null;
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
 * Generic fallback parser for Snapchat, LinkedIn, etc.
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
