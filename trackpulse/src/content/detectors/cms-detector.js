/**
 * CMS Detector — Multi-signal scoring approach to detect the CMS/ecommerce platform.
 */

import {
  CMS,
  CMS_SIGNALS,
  SIGNAL_WEIGHTS,
  CMS_MIN_THRESHOLD,
} from '../../shared/constants.js';
import { cookieExists, safeQuerySelector } from '../../shared/utils.js';

/**
 * Detect which CMS the current page runs on.
 *
 * @param {Object} pageContext - Data collected from the page-context-script (main world)
 * @returns {{ cms: string, confidence: number, signals: string[], version: string|null }}
 */
export function detectCMS(pageContext = {}) {
  const scores = {};
  const matchedSignals = {};

  // Cache expensive DOM serializations outside the CMS loop.
  // These are only computed on first access (lazy) because not every page
  // needs them — but they must NOT be re-computed per CMS.
  let _outerHTML = null;
  let _innerHTML = null;
  const getOuterHTML = () => (_outerHTML ??= document.documentElement.outerHTML);
  const getInnerHTML = () => (_innerHTML ??= document.documentElement.innerHTML);

  const pageUrl = window.location.href;

  for (const [cmsKey, signals] of Object.entries(CMS_SIGNALS)) {
    scores[cmsKey] = 0;
    matchedSignals[cmsKey] = [];

    // 1. JS Globals — check via pageContext.jsGlobals
    if (signals.jsGlobals && pageContext.jsGlobals) {
      for (const globalName of signals.jsGlobals) {
        if (pageContext.jsGlobals[globalName]) {
          scores[cmsKey] += SIGNAL_WEIGHTS.jsGlobals;
          matchedSignals[cmsKey].push(`jsGlobal:${globalName}`);
        }
      }
    }

    // 2. Meta Tags — can read from DOM directly
    if (signals.metaTags) {
      for (const meta of signals.metaTags) {
        if (meta.exists) {
          // Check if the meta tag exists at all
          const el = safeQuerySelector(`meta[name="${meta.name}"]`);
          if (el) {
            scores[cmsKey] += SIGNAL_WEIGHTS.metaTags;
            matchedSignals[cmsKey].push(`meta:${meta.name}`);
          }
        } else if (meta.contentIncludes) {
          // Check meta tag content
          let el = null;
          if (meta.name) {
            el = safeQuerySelector(`meta[name="${meta.name}"]`);
          }
          if (!el && meta.property) {
            el = safeQuerySelector(`meta[property="${meta.property}"]`);
          }
          if (
            el &&
            el.content &&
            el.content.toLowerCase().includes(meta.contentIncludes.toLowerCase())
          ) {
            scores[cmsKey] += SIGNAL_WEIGHTS.metaTags;
            matchedSignals[cmsKey].push(
              `meta:${meta.name || meta.property}=${meta.contentIncludes}`
            );
          }
        }
      }
    }

    // 3. DOM Elements
    if (signals.domElements) {
      for (const selector of signals.domElements) {
        const el = safeQuerySelector(selector);
        if (el) {
          scores[cmsKey] += SIGNAL_WEIGHTS.domElements;
          matchedSignals[cmsKey].push(`dom:${selector}`);
        }
      }
    }

    // 4. URL Patterns — check against all script/link sources and the page URL
    if (signals.urlPatterns) {
      const html = getOuterHTML();
      for (const pattern of signals.urlPatterns) {
        if (
          pattern.test(pageUrl) ||
          pattern.test(html)
        ) {
          scores[cmsKey] += SIGNAL_WEIGHTS.urlPatterns;
          matchedSignals[cmsKey].push(`url:${pattern.source}`);
        }
      }
    }

    // 5. Cookies
    if (signals.cookies) {
      for (const cookieName of signals.cookies) {
        if (cookieExists(cookieName)) {
          scores[cmsKey] += SIGNAL_WEIGHTS.cookies;
          matchedSignals[cmsKey].push(`cookie:${cookieName}`);
        }
      }
    }

    // 6. HTML Patterns — search the full HTML
    if (signals.htmlPatterns) {
      const html = getInnerHTML();
      for (const pattern of signals.htmlPatterns) {
        if (pattern.test(html)) {
          scores[cmsKey] += SIGNAL_WEIGHTS.htmlPatterns;
          matchedSignals[cmsKey].push(`html:${pattern.source}`);
        }
      }
    }
  }

  // Find the CMS with the highest score
  let bestCms = CMS.UNKNOWN;
  let bestScore = 0;

  for (const [cmsKey, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCms = cmsKey;
    }
  }

  // Check minimum threshold
  if (bestScore < CMS_MIN_THRESHOLD) {
    bestCms = CMS.UNKNOWN;
  }

  // Calculate confidence (0–100)
  // Max realistic score is about 200 (all signals match)
  const confidence = Math.min(100, Math.round((bestScore / 150) * 100));

  // Try to detect CMS version
  const version = detectVersion(bestCms, pageContext);

  return {
    cms: bestCms,
    confidence,
    signals: matchedSignals[bestCms] || [],
    version,
    allScores: scores,
  };
}

/**
 * Try to detect the CMS version from available data.
 */
function detectVersion(cms, pageContext) {
  if (cms === CMS.SHOPIFY) {
    // Shopify doesn't really expose version, but we can get theme info
    if (pageContext.shopify?.theme?.name) {
      return `Theme: ${pageContext.shopify.theme.name}`;
    }
    return null;
  }

  // For WooCommerce, PrestaShop, Magento, and Webflow, version lives in
  // meta[name="generator"]. Query it once instead of per-CMS.
  const genContent = document.querySelector('meta[name="generator"]')?.content;
  if (!genContent) return null;

  switch (cms) {
    case CMS.WOOCOMMERCE: {
      const match = genContent.match(/WooCommerce\s+([\d.]+)/i);
      return match ? match[1] : null;
    }
    case CMS.PRESTASHOP: {
      const match = genContent.match(/PrestaShop\s+([\d.]+)/i);
      return match ? match[1] : null;
    }
    case CMS.MAGENTO: {
      const match = genContent.match(/Magento\s+([\d.]+)/i);
      return match ? match[1] : null;
    }
    case CMS.WEBFLOW:
      return genContent.replace('Webflow', '').trim() || null;
    default:
      return null;
  }
}
