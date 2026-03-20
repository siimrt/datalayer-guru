/**
 * Tracks usage metrics per billing period (calendar month).
 * Stored in chrome.storage.local with HMAC signature to prevent tampering.
 */

import { computeUsageSignature } from '../shared/crypto.js';

const STORAGE_KEY = 'tp_usage';
const SIG_KEY = 'tp_usage_sig';

// Max limits used when signature is invalid (anti-tamper: reset to MAX, not 0)
const TAMPERED_USAGE = {
  domains: Array.from({ length: 50 }, (_, i) => `blocked-${i}.invalid`),
  pdfReportsCount: 9999,
  funnelAuditsCount: 9999,
};

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getUsage() {
  const data = await chrome.storage.local.get([STORAGE_KEY, SIG_KEY]);
  const usage = data[STORAGE_KEY] || {};
  const period = getCurrentPeriod();

  // Reset if new month
  if (usage.period !== period) {
    return {
      period,
      domains: [],
      pdfReportsCount: 0,
      funnelAuditsCount: 0,
    };
  }

  // Verify signature — if tampered, return maxed-out usage
  if (usage.period) {
    try {
      const expectedSig = await computeUsageSignature(usage);
      if (data[SIG_KEY] !== expectedSig) {
        return { period, ...TAMPERED_USAGE };
      }
    } catch (e) {
      // Crypto failure — allow usage to avoid blocking legit users
    }
  }

  return usage;
}

async function saveUsage(usage) {
  try {
    const sig = await computeUsageSignature(usage);
    await chrome.storage.local.set({ [STORAGE_KEY]: usage, [SIG_KEY]: sig });
  } catch (e) {
    // Fallback: save without signature (crypto may be unavailable in some contexts)
    await chrome.storage.local.set({ [STORAGE_KEY]: usage });
  }
}

/**
 * Record a domain visit (for Starter plan 5-domain limit).
 * Returns { allowed: boolean, domainsUsed: number, domainLimit: number|null }
 */
export async function trackDomain(hostname, domainLimit) {
  const usage = await getUsage();

  // Clean hostname (remove www, port, etc.)
  const cleanDomain = hostname.replace(/^www\./, '').split(':')[0];

  if (!usage.domains.includes(cleanDomain)) {
    // Check limit
    if (domainLimit !== null && usage.domains.length >= domainLimit) {
      return {
        allowed: false,
        domainsUsed: usage.domains.length,
        domainLimit,
        domains: usage.domains,
      };
    }

    usage.domains.push(cleanDomain);
    await saveUsage(usage);
  }

  return {
    allowed: true,
    domainsUsed: usage.domains.length,
    domainLimit,
    domains: usage.domains,
  };
}

/**
 * Record a PDF export. Returns { allowed, count, limit }
 */
export async function trackPDFExport(pdfLimit) {
  const usage = await getUsage();

  if (pdfLimit !== null && usage.pdfReportsCount >= pdfLimit) {
    return { allowed: false, count: usage.pdfReportsCount, limit: pdfLimit };
  }

  usage.pdfReportsCount++;
  await saveUsage(usage);

  return { allowed: true, count: usage.pdfReportsCount, limit: pdfLimit };
}

/**
 * Record a funnel audit. Returns { allowed, count, limit }
 */
export async function trackFunnelAudit(funnelLimit) {
  const usage = await getUsage();

  if (funnelLimit !== null && usage.funnelAuditsCount >= funnelLimit) {
    return { allowed: false, count: usage.funnelAuditsCount, limit: funnelLimit };
  }

  usage.funnelAuditsCount++;
  await saveUsage(usage);

  return { allowed: true, count: usage.funnelAuditsCount, limit: funnelLimit };
}

/**
 * Get current usage stats (for display in UI).
 */
export async function getUsageStats() {
  return await getUsage();
}

/**
 * Reset usage (for testing).
 */
export async function resetUsage() {
  await chrome.storage.local.remove([STORAGE_KEY, SIG_KEY]);
}
