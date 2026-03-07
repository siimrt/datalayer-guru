/**
 * Network Pixel Enhancer
 *
 * Creates synthetic pixel entries from network request data when DOM
 * detection fails (e.g., Shopify checkout sandboxes).
 * Also fills in missing pixel IDs for DOM-detected pixels.
 */

// URL-based pixel ID extraction helpers

function extractPinterestIdFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/[?&]tid=(\d+)/);
    return match ? match[1] : null;
  } catch (e) { return null; }
}

function extractTikTokIdFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/[?&]sdkid=([A-Z0-9]+)/i);
    return match ? match[1] : null;
  } catch (e) { return null; }
}

function extractSnapchatIdFromUrl(url) {
  if (!url) return null;
  try {
    // Check query param: ?id=UUID
    const paramMatch = url.match(/[?&]id=([a-f0-9-]+)/i);
    if (paramMatch) return paramMatch[1];
    // Check path: /v3/UUID/events
    const pathMatch = url.match(/\/v\d+\/([a-f0-9-]+)\/events/i);
    if (pathMatch) return pathMatch[1];
    return null;
  } catch (e) { return null; }
}

function extractLinkedInIdFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/[?&]pid=(\d+)/);
    return match ? match[1] : null;
  } catch (e) { return null; }
}

// Platform-specific pixel ID extractors from network request data
const PIXEL_ID_EXTRACTORS = {
  ga4: (req) => req.measurementId || null,
  meta: (req) => req.pixelId || null,
  tiktok: (req) => req.pixelId || req.params?.pixelId || extractTikTokIdFromUrl(req.url) || null,
  snapchat: (req) => req.pixelId || extractSnapchatIdFromUrl(req.url) || null,
  linkedin: (req) => req.pixelId || req.params?.partnerId || extractLinkedInIdFromUrl(req.url) || null,
  pinterest: (req) => req.pixelId || extractPinterestIdFromUrl(req.url) || null,
};

/**
 * Enhance pixel detection results with network request data.
 *
 * 1. For platforms with network requests but no DOM-detected pixel,
 *    create a synthetic pixel entry with method: 'network'.
 * 2. For DOM-detected pixels missing an ID, fill it in from network data.
 *
 * @param {Array} pixels - state.pixels array
 * @param {Array} networkRequests - state.networkRequests array
 * @returns {Array} Enhanced pixels array (new array, original not mutated)
 */
export function enhancePixelsWithNetworkData(pixels, networkRequests) {
  if (!networkRequests || networkRequests.length === 0) return pixels;

  const enhanced = pixels.map((p) => ({ ...p }));
  const detectedPlatforms = new Set(enhanced.map((p) => p.platform));

  // Group network requests by platform
  const byPlatform = {};
  for (const req of networkRequests) {
    if (!byPlatform[req.platform]) byPlatform[req.platform] = [];
    byPlatform[req.platform].push(req);
  }

  for (const [platform, reqs] of Object.entries(byPlatform)) {
    const extractor = PIXEL_ID_EXTRACTORS[platform];
    // Try to find a pixel ID from network data
    let pixelId = null;
    if (extractor) {
      for (const req of reqs) {
        pixelId = extractor(req);
        if (pixelId) break;
      }
    }

    if (!detectedPlatforms.has(platform)) {
      // Create synthetic pixel entry only if not already present
      if (!enhanced.some((p) => p.platform === platform)) {
        enhanced.push({
          platform,
          id: pixelId,
          active: true,
          method: 'network',
          source: reqs[0]?.source || 'top',
        });
      }
    } else {
      // Merge network data into existing DOM-detected pixel
      const existing = enhanced.find((p) => p.platform === platform);
      if (existing && !existing.id && pixelId) {
        existing.id = pixelId;
      }
    }
  }

  return enhanced;
}
