/**
 * Tracks usage metrics per billing period (calendar month).
 * Stored in chrome.storage.local.
 */

const STORAGE_KEY = 'tp_usage';

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getUsage() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
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

  return usage;
}

async function saveUsage(usage) {
  await chrome.storage.local.set({ [STORAGE_KEY]: usage });
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
  await chrome.storage.local.remove(STORAGE_KEY);
}
