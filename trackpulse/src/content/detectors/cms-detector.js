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
      const html = document.documentElement.outerHTML;
      for (const pattern of signals.urlPatterns) {
        if (
          pattern.test(window.location.href) ||
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
      const html = document.documentElement.innerHTML;
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
  switch (cms) {
    case CMS.SHOPIFY:
      // Shopify doesn't really expose version, but we can get theme info
      if (pageContext.shopify?.theme?.name) {
        return `Theme: ${pageContext.shopify.theme.name}`;
      }
      return null;

    case CMS.WOOCOMMERCE: {
      const gen = document.querySelector('meta[name="generator"]');
      if (gen?.content) {
        const match = gen.content.match(/WooCommerce\s+([\d.]+)/i);
        if (match) return match[1];
      }
      return null;
    }

    case CMS.PRESTASHOP: {
      const gen = document.querySelector('meta[name="generator"]');
      if (gen?.content) {
        const match = gen.content.match(/PrestaShop\s+([\d.]+)/i);
        if (match) return match[1];
      }
      return null;
    }

    case CMS.MAGENTO: {
      const gen = document.querySelector('meta[name="generator"]');
      if (gen?.content) {
        const match = gen.content.match(/Magento\s+([\d.]+)/i);
        if (match) return match[1];
      }
      return null;
    }

    case CMS.WEBFLOW: {
      const gen = document.querySelector('meta[name="generator"]');
      if (gen?.content) {
        return gen.content.replace('Webflow', '').trim() || null;
      }
      return null;
    }

    default:
      return null;
  }
}
