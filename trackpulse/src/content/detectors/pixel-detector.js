/**
 * Pixel Detector — Detects tracking pixels/tags installed on the page.
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

    // --- Google Tag Manager ---
    const gtmPixels = this._detectGTM();
    pixels.push(...gtmPixels);

    // --- Google Analytics 4 ---
    const ga4Pixels = this._detectGA4(pageContext);
    pixels.push(...ga4Pixels);

    // --- Universal Analytics (legacy) ---
    const uaPixels = this._detectUA();
    pixels.push(...uaPixels);

    // --- Meta/Facebook Pixel ---
    const metaPixels = this._detectMeta(pageContext);
    pixels.push(...metaPixels);

    // --- TikTok Pixel ---
    const tiktokPixels = this._detectTikTok(pageContext);
    pixels.push(...tiktokPixels);

    // --- Pinterest Tag ---
    const pinterestPixels = this._detectPinterest(pageContext);
    pixels.push(...pinterestPixels);

    // --- Snapchat Pixel ---
    const snapchatPixels = this._detectSnapchat(pageContext);
    pixels.push(...snapchatPixels);

    // --- LinkedIn Insight Tag ---
    const linkedinPixels = this._detectLinkedIn(pageContext);
    pixels.push(...linkedinPixels);

    // --- Twitter/X Pixel ---
    const twitterPixels = this._detectTwitter(pageContext);
    pixels.push(...twitterPixels);

    return pixels;
  }

  _detectGTM() {
    const results = [];
    const scripts = document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');
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
    const iframes = document.querySelectorAll('iframe[src*="googletagmanager.com/ns.html"]');
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
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
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

  _detectGA4(pageContext) {
    const results = [];
    const ids = new Set();

    // Check script tags
    const scripts = document.querySelectorAll('script[src*="googletagmanager.com/gtag"]');
    for (const script of scripts) {
      const match = script.src.match(/[?&]id=(G-[A-Z0-9]+)/);
      if (match) ids.add(match[1]);
    }

    // Check inline scripts for G- measurement IDs
    const allScripts = document.querySelectorAll('script:not([src])');
    for (const script of allScripts) {
      const content = script.textContent || '';
      const matches = content.match(/G-[A-Z0-9]{8,12}/g);
      if (matches) {
        for (const id of matches) ids.add(id);
      }
    }

    // Check dataLayer for gtag config events
    if (pageContext.dataLayer) {
      for (const entry of pageContext.dataLayer) {
        if (Array.isArray(entry) && entry[0] === 'config') {
          const id = entry[1];
          if (typeof id === 'string' && id.startsWith('G-')) {
            ids.add(id);
          }
        }
      }
    }

    for (const id of ids) {
      results.push({
        platform: 'ga4',
        id,
        method: pageContext.pixels?.gtag ? 'script' : 'script',
        active: pageContext.pixels?.gtag || scripts.length > 0,
      });
    }

    return results;
  }

  _detectUA() {
    const results = [];
    const ids = new Set();

    const scripts = document.querySelectorAll('script[src*="google-analytics.com/analytics.js"]');
    if (scripts.length > 0) {
      // Try to find UA IDs in inline scripts
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
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

  _detectMeta(pageContext) {
    const results = [];
    const ids = new Set();

    // Check for fbevents.js script
    const scripts = document.querySelectorAll('script[src*="connect.facebook.net"]');
    const hasFbScript = scripts.length > 0;

    // Try to get pixel ID from pageContext
    if (pageContext.pixels?.fbPixelId) {
      ids.add(pageContext.pixels.fbPixelId);
    }
    if (pageContext.pixels?.fbPixelIds) {
      for (const id of pageContext.pixels.fbPixelIds) ids.add(id);
    }

    // Search inline scripts for fbq('init', 'XXXX')
    const allScripts = document.querySelectorAll('script:not([src])');
    for (const script of allScripts) {
      const content = script.textContent || '';
      const matches = content.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{15,16})['"]/g);
      if (matches) {
        for (const m of matches) {
          const idMatch = m.match(/['"](\d{15,16})['"]/);
          if (idMatch) ids.add(idMatch[1]);
        }
      }
    }

    if (ids.size > 0 || hasFbScript || pageContext.pixels?.fbq) {
      if (ids.size === 0) {
        results.push({
          platform: 'meta',
          id: null,
          method: 'script',
          active: pageContext.pixels?.fbq || hasFbScript,
        });
      } else {
        for (const id of ids) {
          results.push({
            platform: 'meta',
            id,
            method: 'script',
            active: pageContext.pixels?.fbq || hasFbScript,
          });
        }
      }
    }

    return results;
  }

  _detectTikTok(pageContext) {
    const results = [];

    const scripts = document.querySelectorAll('script[src*="analytics.tiktok.com"]');
    const hasTtScript = scripts.length > 0;

    if (hasTtScript || pageContext.pixels?.ttq) {
      // Try to find pixel ID
      let pixelId = null;
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
        const content = script.textContent || '';
        const match = content.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]+)['"]/);
        if (match) {
          pixelId = match[1];
          break;
        }
      }

      results.push({
        platform: 'tiktok',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.ttq || hasTtScript,
      });
    }

    return results;
  }

  _detectPinterest(pageContext) {
    const results = [];

    const scripts = document.querySelectorAll('script[src*="s.pinimg.com/ct/core.js"]');
    const hasPinScript = scripts.length > 0;

    if (hasPinScript || pageContext.pixels?.pintrk) {
      let pixelId = null;
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
        const content = script.textContent || '';
        const match = content.match(/pintrk\s*\(\s*['"]load['"]\s*,\s*['"](\d+)['"]/);
        if (match) {
          pixelId = match[1];
          break;
        }
      }

      results.push({
        platform: 'pinterest',
        id: pixelId,
        method: 'script',
        active: pageContext.pixels?.pintrk || hasPinScript,
      });
    }

    return results;
  }

  _detectSnapchat(pageContext) {
    const results = [];

    const scripts = document.querySelectorAll('script[src*="sc-static.net/scevent"]');
    const hasSnapScript = scripts.length > 0;

    if (hasSnapScript || pageContext.pixels?.snaptr) {
      let pixelId = null;
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
        const content = script.textContent || '';
        const match = content.match(/snaptr\s*\(\s*['"]init['"]\s*,\s*['"]([a-f0-9-]+)['"]/);
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

  _detectLinkedIn(pageContext) {
    const results = [];

    const scripts = document.querySelectorAll('script[src*="snap.licdn.com"]');
    const hasLiScript = scripts.length > 0;

    if (hasLiScript || pageContext.pixels?.lintrk) {
      let pixelId = null;
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
        const content = script.textContent || '';
        const match = content.match(/_linkedin_partner_id\s*=\s*['"]?(\d+)/);
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
    }

    return results;
  }

  _detectTwitter(pageContext) {
    const results = [];

    const scripts = document.querySelectorAll('script[src*="static.ads-twitter.com"]');
    const hasTwScript = scripts.length > 0;

    if (hasTwScript || pageContext.pixels?.twq) {
      let pixelId = null;
      const allScripts = document.querySelectorAll('script:not([src])');
      for (const script of allScripts) {
        const content = script.textContent || '';
        const match = content.match(/twq\s*\(\s*['"]init['"]\s*,\s*['"]([a-z0-9]+)['"]/);
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
    }

    return results;
  }
}
