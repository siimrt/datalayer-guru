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

  // WooCommerce runs ON WordPress, so WordPress always out-scores it.
  // If WordPress won but WooCommerce has any signals, prefer WooCommerce.
  if (bestCms === CMS.WORDPRESS && scores[CMS.WOOCOMMERCE] > 0) {
    bestCms = CMS.WOOCOMMERCE;
    bestScore = scores[CMS.WOOCOMMERCE];
    matchedSignals[CMS.WOOCOMMERCE].push('override:wordpress+woocommerce');
  }

  // Check minimum threshold — fall back to tech stack detection
  if (bestScore < CMS_MIN_THRESHOLD) {
    const stackResult = detectTechStack(pageContext);
    if (stackResult) {
      return stackResult;
    }
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
 * Detect tech stack (framework) when no CMS is identified.
 * Returns a result object like detectCMS, or null if nothing found.
 */
function detectTechStack(pageContext) {
  const globals = pageContext.jsGlobals || {};
  const checks = [];

  // Next.js: __NEXT_DATA__ global OR <script id="__NEXT_DATA__"> OR /_next/ in scripts
  if (globals.__NEXT_DATA__ || safeQuerySelector('script#__NEXT_DATA__') || safeQuerySelector('script[src*="/_next/"]')) {
    checks.push({ cms: CMS.NEXTJS, confidence: 90, signals: ['stack:nextjs'] });
  }

  // Nuxt.js: __NUXT__ or __nuxt global OR <div id="__nuxt"> OR /_nuxt/ in scripts
  if (globals.__NUXT__ || globals.__nuxt || safeQuerySelector('#__nuxt') || safeQuerySelector('script[src*="/_nuxt/"]')) {
    checks.push({ cms: CMS.NUXTJS, confidence: 90, signals: ['stack:nuxtjs'] });
  }

  // Gatsby: ___gatsby global OR <div id="___gatsby">
  if (globals.___gatsby || safeQuerySelector('#___gatsby')) {
    checks.push({ cms: CMS.GATSBY, confidence: 90, signals: ['stack:gatsby'] });
  }

  // Remix: __remixContext global
  if (globals.__remixContext) {
    checks.push({ cms: CMS.REMIX, confidence: 85, signals: ['stack:remix'] });
  }

  // SvelteKit: [data-sveltekit] in DOM
  if (safeQuerySelector('[data-sveltekit-preload-data]') || safeQuerySelector('[data-sveltekit]')) {
    checks.push({ cms: CMS.SVELTEKIT, confidence: 85, signals: ['stack:sveltekit'] });
  }

  // Astro: <astro-island> custom elements
  if (safeQuerySelector('astro-island')) {
    checks.push({ cms: CMS.ASTRO, confidence: 85, signals: ['stack:astro'] });
  }

  // Angular: [ng-version] or [_nghost-] or [_ngcontent-]
  if (safeQuerySelector('[ng-version]') || safeQuerySelector('[_nghost-]') || document.querySelector('[class*="_ngcontent-"]')) {
    checks.push({ cms: CMS.ANGULAR, confidence: 80, signals: ['stack:angular'] });
  }

  // React: [data-reactroot] or [data-reactid]
  if (safeQuerySelector('[data-reactroot]') || safeQuerySelector('[data-reactid]')) {
    checks.push({ cms: CMS.REACT, confidence: 70, signals: ['stack:react'] });
  }

  // Vue.js: data-v- attributes in DOM (Vue scoped CSS adds data-v-xxxx attrs)
  const hasVueAttrs = (() => {
    try {
      const el = document.querySelector('[data-v-app]');
      if (el) return true;
      // Check for Vue scoped style attributes (data-v-xxxxxxxx)
      const allEls = document.querySelectorAll('*');
      for (let i = 0; i < Math.min(allEls.length, 100); i++) {
        for (const attr of allEls[i].attributes) {
          if (/^data-v-[a-f0-9]+$/.test(attr.name)) return true;
        }
      }
      return false;
    } catch (e) { return false; }
  })();
  if (hasVueAttrs) {
    checks.push({ cms: CMS.VUE, confidence: 70, signals: ['stack:vue'] });
  }

  // Laravel: <meta name="csrf-token"> (without WordPress)
  if (safeQuerySelector('meta[name="csrf-token"]') && !safeQuerySelector('script[src*="wp-includes"]')) {
    checks.push({ cms: CMS.LARAVEL, confidence: 65, signals: ['stack:laravel'] });
  }

  // PHP: .php in the URL, PHPSESSID cookie, or PHP clues in scripts/links
  const pageUrl = window.location.href;
  const phpSignals = [];
  if (/\.php(\?|$|#|\/)/i.test(pageUrl)) phpSignals.push('url:.php');
  if (safeQuerySelector('script[src*=".php"]') || safeQuerySelector('link[href*=".php"]')) phpSignals.push('dom:.php');
  if (cookieExists('PHPSESSID')) phpSignals.push('cookie:PHPSESSID');
  // Check for PHP-specific meta/headers hints in the DOM
  if (safeQuerySelector('input[name="csrf_token"]') || safeQuerySelector('input[name="_token"]')) phpSignals.push('dom:csrf_input');
  if (phpSignals.length > 0) {
    const phpConf = Math.min(80, 45 + phpSignals.length * 12);
    checks.push({ cms: CMS.PHP, confidence: phpConf, signals: phpSignals.map(s => `stack:php:${s}`) });
  }

  // Return the highest-confidence match
  if (checks.length > 0) {
    checks.sort((a, b) => b.confidence - a.confidence);
    const best = checks[0];
    return {
      cms: best.cms,
      confidence: best.confidence,
      signals: best.signals,
      version: null,
      allScores: {},
    };
  }

  return null;
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
