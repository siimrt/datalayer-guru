/**
 * Pixel Detector — Detects tracking pixels/tags installed on the page.
 *
 * Each platform uses a funnel/cascade approach:
 * 1. Script tags (fastest) — check <script src="..."> for known CDN URLs
 * 2. Inline scripts — scan <script> blocks for SDK init calls
 * 3. DataLayer / pageContext — check dataLayer entries and pageContext.pixels globals
 * 4. Noscript / img fallbacks — check <noscript> and <img> for tracking pixel URLs
 *
 * If a pixel is detected (script present, global exists) but no ID can be
 * extracted, id: null is returned with active: true.
 */

export class PixelDetector {
  /**
   * Detect all installed tracking pixels on the current page.
   *
   * @param {Object} pageContext - Data from the page-context-script
   * @returns {Array<{ platform: string, id: string|null, method: string, active: boolean }>}
   */
  detect(pageContext = {}) {
    const pixels = [];

    // Query DOM collections once for performance — reused by all sub-methods
    // instead of querying the DOM separately in each detector.
    const domCache = {
      inlineScripts: document.querySelectorAll('script:not([src])'),
      noscripts: document.querySelectorAll('noscript'),
      imgs: document.querySelectorAll('img'),
    };

    pixels.push(...this._detectGTM(domCache));
    pixels.push(...this._detectGA4(pageContext, domCache));
    pixels.push(...this._detectUA(domCache));
    pixels.push(...this._detectMeta(pageContext, domCache));
    pixels.push(...this._detectTikTok(pageContext, domCache));
    pixels.push(...this._detectPinterest(pageContext, domCache));
    pixels.push(...this._detectSnapchat(pageContext, domCache));
    pixels.push(...this._detectLinkedIn(pageContext, domCache));
    pixels.push(...this._detectTwitter(pageContext, domCache));

    return pixels;
  }

  /* ------------------------------------------------------------------ */
  /*  Google Tag Manager                                                 */
  /* ------------------------------------------------------------------ */

  _detectGTM(domCache) {
    const results = [];

    const scripts = document.querySelectorAll(
      'script[src*="googletagmanager.com/gtm.js"]',
    );
    for (const script of scripts) {
      const match = script.src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (match) {
        results.push({
          platform: 'gtm',
          id: match[1],
          method: 'script',
          active: true,
        });
      }
    }

    // Also check noscript iframes
    const iframes = document.querySelectorAll(
      'iframe[src*="googletagmanager.com/ns.html"]',
    );
    for (const iframe of iframes) {
      const match = iframe.src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (match && !results.some((r) => r.id === match[1])) {
        results.push({
          platform: 'gtm',
          id: match[1],
          method: 'iframe',
          active: true,
        });
      }
    }

    // Check inline scripts for GTM container IDs
    if (results.length === 0) {
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const matches = content.match(/GTM-[A-Z0-9]+/g);
        if (matches) {
          for (const id of new Set(matches)) {
            if (!results.some((r) => r.id === id)) {
              results.push({
                platform: 'gtm',
                id,
                method: 'script',
                active: true,
              });
            }
          }
        }
      }
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Google Analytics 4                                                 */
  /* ------------------------------------------------------------------ */

  _detectGA4(pageContext, domCache) {
    const results = [];
    const ids = new Set();

    // 1. Script tags — googletagmanager.com/gtag pattern
    const scripts = document.querySelectorAll(
      'script[src*="googletagmanager.com/gtag"]',
    );
    let hasGtagScript = scripts.length > 0;
    for (const script of scripts) {
      const match = script.src.match(/[?&]id=(G-[A-Z0-9]+)/);
      if (match) ids.add(match[1]);
    }

    // 1b. Shorter gtag/js pattern (some implementations use shortened URLs)
    if (!hasGtagScript) {
      const gtagJsScripts = document.querySelectorAll(
        'script[src*="gtag/js"]',
      );
      if (gtagJsScripts.length > 0) hasGtagScript = true;
      for (const script of gtagJsScripts) {
        const match = script.src.match(/[?&]id=(G-[A-Z0-9]+)/);
        if (match) ids.add(match[1]);
      }
    }

    // 1c. gtag/destination pattern that may contain measurement IDs
    const destScripts = document.querySelectorAll(
      'script[src*="gtag/destination"]',
    );
    for (const script of destScripts) {
      hasGtagScript = true;
      const match = script.src.match(/[?&]id=(G-[A-Z0-9]+)/);
      if (match) ids.add(match[1]);
    }

    // 2. Inline scripts — G- measurement IDs
    for (const script of domCache.inlineScripts) {
      const content = script.textContent || '';
      const matches = content.match(/G-[A-Z0-9]{8,12}/g);
      if (matches) {
        for (const id of matches) ids.add(id);
      }
    }

    // 3. dataLayer — gtag config events
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        // Array form: ['config', 'G-XXXX']
        if (Array.isArray(entry) && entry[0] === 'config') {
          const id = entry[1];
          if (typeof id === 'string' && id.startsWith('G-')) {
            ids.add(id);
          }
        }
        // Arguments-object form: {0: 'config', 1: 'G-XXXX'}
        if (
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          entry['0'] === 'config'
        ) {
          const id = entry['1'];
          if (typeof id === 'string' && id.startsWith('G-')) {
            ids.add(id);
          }
        }
      }
    }

    // 4. pageContext globals — gtag / google_tag_data
    const hasGtagGlobal = pageContext.pixels?.gtag || false;
    const hasGoogleTagData = pageContext.pixels?.googleTagData || false;
    const isActive = hasGtagGlobal || hasGoogleTagData || hasGtagScript;

    // Build results
    if (ids.size > 0) {
      for (const id of ids) {
        results.push({
          platform: 'ga4',
          id,
          method: hasGtagScript ? 'script' : 'dataLayer',
          active: isActive,
        });
      }
    } else if (isActive) {
      // gtag global or google_tag_data exists but no measurement ID found —
      // still report as detected so it shows in the UI
      results.push({
        platform: 'ga4',
        id: null,
        method: hasGtagScript ? 'script' : 'global',
        active: true,
      });
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Universal Analytics (legacy)                                       */
  /* ------------------------------------------------------------------ */

  _detectUA(domCache) {
    const results = [];
    const ids = new Set();

    const scripts = document.querySelectorAll(
      'script[src*="google-analytics.com/analytics.js"]',
    );
    if (scripts.length > 0) {
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const matches = content.match(/UA-\d+-\d+/g);
        if (matches) {
          for (const id of matches) ids.add(id);
        }
      }
    }

    for (const id of ids) {
      results.push({
        platform: 'ua',
        id,
        method: 'script',
        active: true,
      });
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Meta / Facebook Pixel                                              */
  /* ------------------------------------------------------------------ */

  _detectMeta(pageContext, domCache) {
    const results = [];
    const ids = new Set();

    // 1. Script tag — connect.facebook.net
    const scripts = document.querySelectorAll(
      'script[src*="connect.facebook.net"]',
    );
    const hasFbScript = scripts.length > 0;

    // 2. pageContext — fbq.getState / fbq.instance
    if (pageContext.pixels?.fbPixelId) {
      ids.add(pageContext.pixels.fbPixelId);
    }
    if (pageContext.pixels?.fbPixelIds) {
      for (const id of pageContext.pixels.fbPixelIds) ids.add(id);
    }

    // 3. Inline scripts — fbq('init', 'XXXX')
    for (const script of domCache.inlineScripts) {
      const content = script.textContent || '';
      const matches = content.match(
        /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/g,
      );
      if (matches) {
        for (const m of matches) {
          const idMatch = m.match(/['"](\d{15,16})['"]/);
          if (idMatch) ids.add(idMatch[1]);
        }
      }
    }

    // 4. <noscript> — facebook.com/tr?id= pattern
    for (const ns of domCache.noscripts) {
      const html = ns.innerHTML || '';
      const noscriptMatches = html.match(
        /facebook\.com\/tr\?id=(\d{15,16})/g,
      );
      if (noscriptMatches) {
        for (const m of noscriptMatches) {
          const idMatch = m.match(/id=(\d{15,16})/);
          if (idMatch) ids.add(idMatch[1]);
        }
      }
    }

    // 5. <img> — facebook.com/tr src
    for (const img of domCache.imgs) {
      const src = img.src || img.getAttribute('data-src') || '';
      if (src.includes('facebook.com/tr')) {
        const idMatch = src.match(/[?&]id=(\d{15,16})/);
        if (idMatch) ids.add(idMatch[1]);
      }
    }

    const isActive = pageContext.pixels?.fbq || hasFbScript;

    if (ids.size > 0 || hasFbScript || pageContext.pixels?.fbq) {
      if (ids.size === 0) {
        results.push({
          platform: 'meta',
          id: null,
          method: 'script',
          active: isActive,
        });
      } else {
        for (const id of ids) {
          results.push({
            platform: 'meta',
            id,
            method: 'script',
            active: isActive,
          });
        }
      }
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  TikTok Pixel                                                       */
  /* ------------------------------------------------------------------ */

  _detectTikTok(pageContext, domCache) {
    const results = [];
    const ids = new Set();

    // 1. Script tag — analytics.tiktok.com
    const scripts = document.querySelectorAll(
      'script[src*="analytics.tiktok.com"]',
    );
    const hasTtScript = scripts.length > 0;

    if (hasTtScript || pageContext.pixels?.ttq) {
      // 2. Inline scripts — ttq.load('XXXX')
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const match = content.match(
          /ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/,
        );
        if (match) {
          ids.add(match[1]);
        }
      }

      // 3. pageContext — ttq._t pixel map
      if (pageContext.pixels?.ttqPixelIds) {
        for (const id of pageContext.pixels.ttqPixelIds) ids.add(id);
      }

      // 4. Script src — sdkid parameter
      for (const script of scripts) {
        const srcMatch = script.src.match(/sdkid=([A-Z0-9]+)/);
        if (srcMatch) ids.add(srcMatch[1]);
      }

      if (ids.size === 0) {
        results.push({
          platform: 'tiktok',
          id: null,
          method: 'script',
          active: pageContext.pixels?.ttq || hasTtScript,
        });
      } else {
        for (const id of ids) {
          results.push({
            platform: 'tiktok',
            id,
            method: 'script',
            active: pageContext.pixels?.ttq || hasTtScript,
          });
        }
      }

      return results;
    }

    // 5. <img> fallback — analytics.tiktok.com
    for (const img of domCache.imgs) {
      const src = img.src || img.getAttribute('data-src') || '';
      if (src.includes('analytics.tiktok.com')) {
        results.push({
          platform: 'tiktok',
          id: null,
          method: 'img',
          active: true,
        });
        return results;
      }
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Pinterest Tag                                                      */
  /* ------------------------------------------------------------------ */

  _detectPinterest(pageContext, domCache) {
    const results = [];
    let pixelId = null;

    // 1. Script tags — s.pinimg.com/ct/core.js and pintrk pattern
    const scripts = document.querySelectorAll(
      'script[src*="s.pinimg.com/ct/core.js"], script[src*="pintrk"]',
    );
    const hasPinScript = scripts.length > 0;

    // 2. Inline scripts — pintrk('load', 'XXXX')
    if (hasPinScript || pageContext.pixels?.pintrk) {
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const match = content.match(
          /pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d+)['"]/,
        );
        if (match) {
          pixelId = match[1];
          break;
        }
      }
    }

    // 3. <noscript> / <img> — ct.pinterest.com
    if (!pixelId) {
      for (const ns of domCache.noscripts) {
        const html = ns.innerHTML || '';
        if (html.includes('ct.pinterest.com')) {
          const idMatch = html.match(/[?&]tid=(\d+)/);
          if (idMatch) pixelId = idMatch[1];
          if (!hasPinScript && !pageContext.pixels?.pintrk && !pixelId) {
            results.push({
              platform: 'pinterest',
              id: null,
              method: 'noscript',
              active: true,
            });
            return results;
          }
          break;
        }
      }
    }

    if (!pixelId) {
      for (const img of domCache.imgs) {
        const src = img.src || img.getAttribute('data-src') || '';
        if (src.includes('ct.pinterest.com')) {
          const idMatch = src.match(/[?&]tid=(\d+)/);
          if (idMatch) pixelId = idMatch[1];
          if (!hasPinScript && !pageContext.pixels?.pintrk && !pixelId) {
            results.push({
              platform: 'pinterest',
              id: null,
              method: 'img',
              active: true,
            });
            return results;
          }
          break;
        }
      }
    }

    if (hasPinScript || pageContext.pixels?.pintrk || pixelId) {
      results.push({
        platform: 'pinterest',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.pintrk || hasPinScript || !!pixelId,
      });
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Snapchat Pixel                                                     */
  /* ------------------------------------------------------------------ */

  _detectSnapchat(pageContext, domCache) {
    const results = [];

    // 1. Broader script src — sc-static.net (not just /scevent)
    const scripts = document.querySelectorAll(
      'script[src*="sc-static.net"]',
    );
    const hasSnapScript = scripts.length > 0;

    if (hasSnapScript || pageContext.pixels?.snaptr) {
      let pixelId = null;

      // 2. Inline scripts — snaptr('init', 'UUID')
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const match = content.match(
          /snaptr\s*\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]+)['"]/,
        );
        if (match) {
          pixelId = match[1];
          break;
        }
      }

      results.push({
        platform: 'snapchat',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.snaptr || hasSnapScript,
      });
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  LinkedIn Insight Tag                                               */
  /* ------------------------------------------------------------------ */

  _detectLinkedIn(pageContext, domCache) {
    const results = [];

    // 1. Broader script src — snap.licdn.com + linkedin.com/li/track
    const scripts = document.querySelectorAll(
      'script[src*="snap.licdn.com"], script[src*="linkedin.com/li/track"]',
    );
    const hasLiScript = scripts.length > 0;

    let pixelId = null;

    if (hasLiScript || pageContext.pixels?.lintrk) {
      // 2. Inline scripts — _linkedin_partner_id
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const match = content.match(
          /_linkedin_partner_id\s*=\s*['"]?(\d+)/,
        );
        if (match) {
          pixelId = match[1];
          break;
        }
      }

      results.push({
        platform: 'linkedin',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.lintrk || hasLiScript,
      });

      return results;
    }

    // 3. <img> fallback — px.ads.linkedin.com / dc.ads.linkedin.com
    for (const img of domCache.imgs) {
      const src = img.src || img.getAttribute('data-src') || '';
      if (
        src.includes('px.ads.linkedin.com') ||
        src.includes('dc.ads.linkedin.com')
      ) {
        const idMatch = src.match(/[?&]pid=(\d+)/);
        results.push({
          platform: 'linkedin',
          id: idMatch ? idMatch[1] : null,
          method: 'img',
          active: true,
        });
        return results;
      }
    }

    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Twitter / X Pixel                                                  */
  /* ------------------------------------------------------------------ */

  _detectTwitter(pageContext, domCache) {
    const results = [];

    // 1. Script src — static.ads-twitter.com
    const scripts = document.querySelectorAll(
      'script[src*="static.ads-twitter.com"]',
    );
    const hasTwScript = scripts.length > 0;

    let pixelId = null;

    if (hasTwScript || pageContext.pixels?.twq) {
      // 2. Inline scripts — twq('init', 'XXXX')
      for (const script of domCache.inlineScripts) {
        const content = script.textContent || '';
        const match = content.match(
          /twq\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/,
        );
        if (match) {
          pixelId = match[1];
          break;
        }
      }

      results.push({
        platform: 'twitter',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.twq || hasTwScript,
      });

      return results;
    }

    // 3. <img> fallback — Twitter tracking pixels
    for (const img of domCache.imgs) {
      const src = img.src || img.getAttribute('data-src') || '';
      if (
        src.includes('ads-twitter.com') ||
        src.includes('t.co/i/adsct') ||
        src.includes('analytics.twitter.com')
      ) {
        results.push({
          platform: 'twitter',
          id: null,
          method: 'img',
          active: true,
        });
        return results;
      }
    }

    return results;
  }
}
