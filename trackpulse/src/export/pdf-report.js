/**
 * PDF REPORT GENERATOR — V5 (html2pdf.js direct download)
 *
 * Generates HTML matching the Traacky extension UI, renders it
 * via html2pdf.js (html2canvas + jsPDF), and downloads the PDF
 * directly — no new tab, no print dialog.
 *
 * Uses the shared canonical audit resolver so the PDF matches
 * the sidepanel audit exactly.
 */

import { enhancePixelsWithNetworkData } from '../sidepanel/utils/network-pixel-enhancer.js';
import { PAGE_TYPE_LABELS, PLATFORM_LABELS, CMS_INFO, SITE_TYPE_INFO } from '../shared/constants.js';
import { platformIconHtml } from '../shared/platform-icons.js';
import { resolveCanonicalAudit } from '../shared/canonical-audit.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreColor(score) {
  if (score >= 80) return '#00B894';
  if (score >= 50) return '#E67E22';
  return '#E74C3C';
}

function fmtDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function dotHtml(color) {
  return `<span class="dot" style="background:${color};"></span>`;
}

function svgGauge(score) {
  const color = scoreColor(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return `<svg width="130" height="130" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#E5E5EA" stroke-width="8"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="8"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}"
      stroke-linecap="round" transform="rotate(-90 60 60)"/>
    <text x="60" y="53" text-anchor="middle" dominant-baseline="central" font-size="26" font-weight="700" fill="${color}" font-family="'Inter','Helvetica Neue',Arial,sans-serif">${score}%</text>
    <text x="60" y="73" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#9B9BB0" font-family="'Inter','Helvetica Neue',Arial,sans-serif">Audit Score</text>
  </svg>`;
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1A1A2E;
  background: #FAFAFA;
}

.page { max-width: 720px; margin: 0 auto; padding: 24px 0; }

/* ── Cards (mirrors .tp-card) ── */
.card {
  background: #FFFFFF;
  border: 1px solid #E5E5EA;
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
}
.card-body { padding: 14px 16px; }
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #1A1A2E;
  margin-bottom: 10px;
}

/* ── Badges (mirrors .tp-badge) ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.badge-cms { background: rgba(0,109,119,0.12); color: #006d77; }
.badge-page { background: #F1F5F9; color: #334155; }
.badge-ecom { background: #F0FDF4; color: #166534; }
.badge-leadgen { background: #EEF2FF; color: #3730A3; }
.badge-hybrid { background: #FAF5FF; color: #6B21A8; }
.badge-currency { background: #FFFFFF; color: #1A1A2E; border: 1px solid #E2E8F0; }
.badge-count { background: #F1F5F9; color: #6B6B80; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.badge-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

/* ── Dots (mirrors .tp-dot) ── */
.dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Status tags ── */
.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

/* ── Score section ── */
.score-section { display: flex; align-items: center; gap: 24px; }
.score-details { flex: 1; }
.score-summary { font-size: 13px; color: #6B6B80; margin-bottom: 12px; }
.score-stats { display: flex; gap: 24px; }
.score-stat-value { font-size: 20px; font-weight: 700; }
.score-stat-label { font-size: 9px; color: #9B9BB0; text-transform: uppercase; letter-spacing: 0.5px; }

/* ── Consent ── */
.consent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-top: 8px; }
.consent-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.consent-key { color: #6B6B80; min-width: 110px; }
.consent-val { font-weight: 500; }

/* ── Event audit table ── */
.event-table { width: 100%; border-collapse: collapse; }
.event-table th {
  text-align: left; font-size: 10px; font-weight: 600;
  color: #9B9BB0; text-transform: uppercase; letter-spacing: 0.5px;
  padding: 0 0 6px 0; border-bottom: 1px solid #E5E5EA;
}
.event-table th:last-child { text-align: right; }
.event-row td { padding: 8px 0; border-bottom: 1px solid #F0F0F5; vertical-align: top; }
.event-row:last-child td { border-bottom: none; }
.event-row td:last-child { text-align: right; }
.event-name { font-size: 13px; font-weight: 600; }
.event-sub { font-size: 11px; color: #9B9BB0; margin-top: 2px; }
.event-platforms { display: flex; gap: 3px; align-items: center; }

/* ── Pixel rows (mirrors .tp-pixel-row) ── */
.pixel-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 0; border-bottom: 1px solid #F0F0F5;
  font-size: 12px;
}
.pixel-row:last-child { border-bottom: none; }
.pixel-name { flex: 1; font-weight: 500; }
.pixel-id { font-size: 11px; color: #6B6B80; font-family: Consolas, monospace; }
.pixel-status { font-size: 11px; font-weight: 600; white-space: nowrap; }

/* ── Network section ── */
.net-platform { padding: 8px 0; border-bottom: 1px solid #F0F0F5; }
.net-platform:last-child { border-bottom: none; }
.net-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.net-name { font-size: 13px; font-weight: 600; }
.net-count { font-size: 12px; color: #9B9BB0; }
.net-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.net-badge {
  display: inline-block; padding: 2px 8px; border-radius: 6px;
  font-size: 11px; background: #F1F5F9; color: #334155;
}

/* ── Code block ── */
.code-block {
  background: #1e1e1e; color: #d4d4d4;
  border-radius: 8px; padding: 14px 16px;
  font-family: Consolas, monospace;
  font-size: 11px; line-height: 1.6;
  white-space: pre-wrap; word-break: break-all;
  overflow: hidden;
}
.code-block .cm { color: #6a9955; }
.code-block .fn { color: #dcdcaa; }
.code-block .str { color: #ce9178; }
.code-block .num { color: #b5cea8; }
.code-block .key { color: #9cdcfe; }
.code-block .p { color: #808080; }

/* ── Header ── */
.header-top { display: flex; justify-content: space-between; align-items: flex-start; }
.header-title { font-size: 16px; font-weight: 700; color: #1A1A2E; }
.header-subtitle { font-size: 12px; color: #9B9BB0; margin-top: 2px; }
.header-date { font-size: 11px; color: #6B6B80; text-align: right; }

/* ── Footer ── */
.footer {
  display: flex; justify-content: space-between;
  padding-top: 12px; border-top: 1px solid #E5E5EA;
  font-size: 10px; color: #9B9BB0; margin-top: 4px;
}
`;

// ─── Section builders ───────────────────────────────────────────────────────

function buildHeader(state, options) {
  const cms = state.cms?.cms || 'unknown';
  const cmsInfo = CMS_INFO[cms] || CMS_INFO.unknown;
  const conf = state.cms?.confidence || 0;
  const pageType = state.pageType?.pageType || 'unknown';
  const pageLabel = PAGE_TYPE_LABELS[pageType] || 'Unknown';
  const st = state.siteTypeOverride || state.siteType?.siteType || 'unknown';
  const stInfo = SITE_TYPE_INFO[st] || SITE_TYPE_INFO.unknown;
  const currency = state.ecommerceData?.currency || '';
  let hostname = '';
  try { hostname = new URL(state.url || '').hostname; } catch (e) {}

  const stClass = st === 'ecommerce' ? 'badge-ecom' : st === 'leadgen' ? 'badge-leadgen' : st === 'hybrid' ? 'badge-hybrid' : 'badge-page';

  return `
    <div class="card">
      <div class="card-body">
        <div class="header-top">
          <div>
            <div class="header-title">${esc(options.agencyName || 'Traacky')} <span style="font-weight:400;font-size:13px;color:#9B9BB0;">Tracking Audit Report</span></div>
            <div class="header-subtitle">${esc(hostname)}</div>
          </div>
          <div class="header-date">${fmtDate()}</div>
        </div>
        <div class="badge-row">
          <span class="badge badge-cms">${esc(cmsInfo.name)} (${conf}%)</span>
          <span class="badge badge-page">${esc(pageLabel)} Page</span>
          <span class="badge ${stClass}">${esc(stInfo.name)}</span>
          ${currency ? `<span class="badge badge-currency">${esc(currency)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function buildScore(canonicalResults) {
  const total = canonicalResults.length;
  if (total === 0) return '';

  let detected = 0;
  for (const r of canonicalResults) {
    const hasDetection = r.platformResults.some(p => p.status !== 'missing');
    if (hasDetection) detected++;
  }

  const score = Math.round((detected / total) * 100);

  return `
    <div class="card">
      <div class="card-body">
        <div class="score-section">
          ${svgGauge(score)}
          <div class="score-details">
            <div class="card-title">Tracking Audit Score</div>
            <div class="score-summary">${detected} of ${total} expected events detected</div>
            <div class="score-stats">
              <div><div class="score-stat-value" style="color:#00B894">${detected}</div><div class="score-stat-label">Detected</div></div>
              <div><div class="score-stat-value" style="color:#E74C3C">${total - detected}</div><div class="score-stat-label">Missing</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildConsent(consent) {
  if (!consent) return '';
  const cmp = consent.cmpDetected || 'None';
  const gc = consent.googleConsent || {};
  const keys = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'];
  const hasData = keys.some(k => gc[k]);

  const rows = keys.map(key => {
    const val = gc[key] || 'not set';
    const granted = val === 'granted';
    const denied = val === 'denied';
    const color = granted ? '#00B894' : denied ? '#E74C3C' : '#9B9BB0';
    const dotC = granted ? '#00B894' : denied ? '#E74C3C' : '#9B9BB0';
    return `<div class="consent-row">${dotHtml(dotC)} <span class="consent-key">${esc(key)}</span> <span class="consent-val" style="color:${color}">${esc(val)}</span></div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title">Consent Status</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:12px;color:#6B6B80;">CMP</span>
          <span style="font-weight:600;">${esc(cmp)}</span>
        </div>
        ${hasData ? `<div class="consent-grid">${rows}</div>` : ''}
      </div>
    </div>`;
}

function buildEventAudit(canonicalResults) {
  if (canonicalResults.length === 0) return '';

  const allPlatformKeys = ['ga4', 'google_ads', 'meta', 'tiktok', 'pinterest', 'linkedin'];

  const rows = canonicalResults.map(result => {
    const detectedPlatforms = result.platformResults.filter(p => p.status !== 'missing');
    const allCount = result.platformResults.length;
    const detectedCount = detectedPlatforms.length;

    let dotColor, statusLabel, statusBg, statusTextColor;
    if (detectedCount === 0) {
      dotColor = '#E74C3C';
      statusLabel = 'Not detected';
      statusBg = 'rgba(231,76,60,0.12)';
      statusTextColor = '#E74C3C';
    } else if (detectedCount === allCount) {
      dotColor = '#00B894';
      statusLabel = `${detectedCount} platform${detectedCount > 1 ? 's' : ''}`;
      statusBg = 'rgba(0,184,148,0.12)';
      statusTextColor = '#00B894';
    } else {
      dotColor = '#E67E22';
      statusLabel = `${detectedCount}/${allCount} platforms`;
      statusBg = 'rgba(230,126,34,0.12)';
      statusTextColor = '#E67E22';
    }

    // Build platform result set for icon display
    const detectedPlatformSet = new Set(result.platformResults.filter(p => p.status !== 'missing').map(p => p.platform));
    const relevantPlatformSet = new Set(result.platformResults.map(p => p.platform));

    const iconsHtml = allPlatformKeys
      .filter(p => relevantPlatformSet.has(p))
      .map(p => {
        const active = detectedPlatformSet.has(p);
        return `<span style="opacity:${active ? '1' : '0.2'};">${platformIconHtml(p, 16)}</span>`;
      }).join('');

    return `
      <tr class="event-row">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            ${dotHtml(dotColor)}
            <div class="event-name">${esc(result.label)}</div>
          </div>
        </td>
        <td><div class="event-platforms">${iconsHtml}</div></td>
        <td><span class="status-tag" style="background:${statusBg};color:${statusTextColor};">${statusLabel}</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title">Event Audit</div>
        <table class="event-table">
          <thead><tr><th>Event</th><th>Platforms</th><th style="text-align:right">Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildPixels(pixels) {
  if (pixels.length === 0) return '';

  const rows = pixels.map(pixel => {
    const isNet = pixel.method === 'network';
    const color = pixel.active ? (isNet ? '#00CEC9' : '#00B894') : '#9B9BB0';
    const statusLabel = pixel.active ? (isNet ? 'Via Network' : 'Active') : 'Not detected';
    const icon = platformIconHtml(pixel.platform, 16);
    const name = PLATFORM_LABELS[pixel.platform] || pixel.platform.toUpperCase();

    return `
      <div class="pixel-row">
        ${dotHtml(color)}
        ${icon}
        <span class="pixel-name" style="${pixel.active ? '' : 'color:#9B9BB0;'}">${esc(name)}</span>
        <span class="pixel-id">${pixel.id ? esc(pixel.id) : ''}</span>
        <span class="pixel-status" style="color:${color};">${statusLabel}</span>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title">Installed Pixels</div>
        ${rows}
      </div>
    </div>`;
}

function buildNetworkRequests(reqs) {
  if (reqs.length === 0) return '';

  const byPlatform = {};
  for (const r of reqs) {
    if (!byPlatform[r.platform]) byPlatform[r.platform] = [];
    byPlatform[r.platform].push(r);
  }

  const sections = Object.entries(byPlatform).map(([platform, pReqs]) => {
    const events = [...new Set(pReqs.map(r => r.eventName).filter(Boolean))];
    const label = PLATFORM_LABELS[platform] || platform;
    const icon = platformIconHtml(platform, 16);
    const badges = events.map(e => `<span class="net-badge">${esc(e)}</span>`).join('');

    return `
      <div class="net-platform">
        <div class="net-header">
          ${dotHtml('#00B894')}
          ${icon}
          <span class="net-name">${esc(label)}</span>
          <span class="net-count">— ${pReqs.length} req</span>
        </div>
        <div class="net-badges" style="padding-left:22px;">${badges}</div>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          Network Tracking Requests
          <span class="badge-count">${reqs.length}</span>
        </div>
        ${sections}
      </div>
    </div>`;
}

function buildDataLayerSnapshot(state, diffs) {
  const primary = diffs.find(d => d.expected);
  if (!primary?.expected) return '';

  const eventName = primary.expected.eventName || 'view_item';
  const ecom = state.ecommerceData || {};
  const item = ecom.items?.[0] || {};

  const lines = [];
  lines.push(`<span class="cm">// Expected dataLayer push for ${esc(eventName)}</span>`);
  lines.push(`<span class="fn">dataLayer</span><span class="p">.</span><span class="fn">push</span><span class="p">({</span>`);
  lines.push(`  <span class="key">event</span><span class="p">:</span> <span class="str">"${esc(eventName)}"</span><span class="p">,</span>`);
  lines.push(`  <span class="key">ecommerce</span><span class="p">: {</span>`);
  lines.push(`    <span class="key">currency</span><span class="p">:</span> <span class="str">"${esc(ecom.currency || 'EUR')}"</span><span class="p">,</span>`);
  lines.push(`    <span class="key">value</span><span class="p">:</span> <span class="num">${esc(String(ecom.value || item.price || '49.90'))}</span><span class="p">,</span>`);
  lines.push(`    <span class="key">items</span><span class="p">: [{</span>`);
  lines.push(`      <span class="key">item_id</span><span class="p">:</span> <span class="str">"${esc(String(item.item_id || 'SKU-12345'))}"</span><span class="p">,</span>`);
  lines.push(`      <span class="key">item_name</span><span class="p">:</span> <span class="str">"${esc(String(item.item_name || 'Product Name').slice(0, 35))}"</span><span class="p">,</span>`);
  if (item.item_brand) lines.push(`      <span class="key">item_brand</span><span class="p">:</span> <span class="str">"${esc(item.item_brand)}"</span><span class="p">,</span>`);
  if (item.item_category) lines.push(`      <span class="key">item_category</span><span class="p">:</span> <span class="str">"${esc(item.item_category)}"</span><span class="p">,</span>`);
  lines.push(`      <span class="key">price</span><span class="p">:</span> <span class="num">${esc(String(item.price || '49.90'))}</span><span class="p">,</span>`);
  lines.push(`      <span class="key">quantity</span><span class="p">:</span> <span class="num">${esc(String(item.quantity || 1))}</span>`);
  lines.push(`    <span class="p">}]</span>`);
  lines.push(`  <span class="p">}</span>`);
  lines.push(`<span class="p">});</span>`);

  return `
    <div class="card">
      <div class="card-body">
        <div class="card-title">DataLayer Snapshot</div>
        <div class="code-block">${lines.join('\n')}</div>
      </div>
    </div>`;
}

function buildFooter(state, options) {
  let hostname = '';
  try { hostname = new URL(state.url || '').hostname; } catch (e) {}
  return `<div class="footer">
    <span>${esc(options.whiteLabelFooter || 'Generated by Traacky')}</span>
    <span>${esc(hostname)} — ${fmtDate()}</span>
  </div>`;
}

// ─── PDF generation via dedicated extension tab ─────────────────────────────
//
// The sidepanel viewport is ~400px with overflow:hidden, which causes
// html2pdf/html2canvas to produce blank pages. Instead, we pass the HTML
// to a full-width extension tab (src/report/) that renders the PDF there.

async function requestPDFGeneration(htmlContent, cssText, filename) {
  await chrome.storage.session.set({
    tp_pdf_report: { htmlContent, cssText, filename },
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('PDF generation timed out'));
    }, 30000);

    function listener(msg) {
      if (msg.type === 'TRACKPULSE_PDF_DONE') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(filename);
      }
      if (msg.type === 'TRACKPULSE_PDF_ERROR') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error(msg.payload?.error || 'PDF generation failed'));
      }
    }

    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.create({
      url: chrome.runtime.getURL('src/report/index.html'),
      active: false,
    });
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function generateAuditReport(state, options = {}) {
  const networkRequests = state.networkRequests || [];
  const enhancedPixels = enhancePixelsWithNetworkData(state.pixels || [], networkRequests);

  // Use shared canonical audit resolver (same logic as the sidepanel UI)
  const { results: canonicalResults, diffs } = resolveCanonicalAudit(state);

  let hostname = 'site';
  try { hostname = new URL(state.url).hostname; } catch (e) {}

  const htmlContent = `
<div class="page">
  ${buildHeader(state, options)}
  ${buildScore(canonicalResults)}
  ${buildConsent(state.consent)}
  ${buildEventAudit(canonicalResults)}
  ${buildPixels(enhancedPixels)}
  ${buildNetworkRequests(networkRequests)}
  ${buildDataLayerSnapshot(state, diffs)}
  ${buildFooter(state, options)}
</div>`;

  const filename = `traacky-audit-${hostname}-${new Date().toISOString().split('T')[0]}.pdf`;
  await requestPDFGeneration(htmlContent, CSS, filename);
  return filename;
}

/**
 * Generate funnel report — direct PDF download via html2pdf.js.
 */
export async function generateFunnelPDFReport(report, options = {}) {
  const detected = report.detectedEvents || {};
  const expectedEvents = report.expectedEvents || [];
  const missingEvents = report.missingEvents || [];
  const detCount = Object.keys(detected).length;
  const dur = report.duration || 0;
  const durStr = dur < 60000 ? `${Math.round(dur / 1000)}s` : `${Math.floor(dur / 60000)}m ${Math.round((dur % 60000) / 1000)}s`;

  // Timeline
  const timelineHtml = expectedEvents.map((fe, i) => {
    const det = detected[fe.key];
    const detections = det?.detections || [];
    const expPlats = Object.keys(fe.events || {});
    const detPlats = new Set(detections.map(d => d.platform).filter(p => p !== 'unknown'));
    const waiting = expPlats.filter(p => !detPlats.has(p)).length;
    const complete = det && waiting === 0;
    const isPartial = det && waiting > 0;
    const isLast = i === expectedEvents.length - 1;
    const color = complete ? '#00B894' : isPartial ? '#E67E22' : '#E74C3C';
    const icon = complete ? '✓' : isPartial ? '!' : '✕';
    const pCount = detPlats.size;
    const statusText = !det ? 'Missing' : waiting > 0 ? `${pCount}/${expPlats.length} platforms` : `${pCount} platform${pCount !== 1 ? 's' : ''}`;

    const detailHtml = detections.length > 0
      ? `<div style="font-size:11px;color:#9B9BB0;margin-top:4px;">${detections.length} detection${detections.length > 1 ? 's' : ''} — ${[...new Set(detections.map(d => d.platform).filter(p => p !== 'unknown'))].map(p => PLATFORM_LABELS[p] || p).join(', ')}</div>`
      : '';

    return `
      <div style="display:flex;gap:14px;">
        <div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0;">
          <div style="width:24px;height:24px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;z-index:1;">${icon}</div>
          ${!isLast ? `<div style="width:2px;flex:1;background:${color};opacity:0.3;margin:2px 0;"></div>` : ''}
        </div>
        <div style="flex:1;padding-bottom:${isLast ? '0' : '12px'};">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:600;">${esc(fe.label)}</span>
            <span style="font-size:11px;font-weight:600;color:${color};">${statusText}</span>
          </div>
          ${detailHtml}
        </div>
      </div>`;
  }).join('');

  // Pages visited
  const pagesHtml = (report.steps || []).map(step => {
    const sColor = step.overallScore >= 80 ? '#00B894' : step.overallScore >= 50 ? '#E67E22' : '#E74C3C';
    const label = PAGE_TYPE_LABELS[step.pageType] || step.pageType;
    let pathname = '';
    try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#F8F8FC;border-radius:8px;margin-bottom:6px;">
        ${dotHtml(sColor)}
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;">${step.stepNumber}. ${esc(label)}</div>
          <div style="font-size:10px;color:#9B9BB0;font-family:Consolas,monospace;">${esc(pathname)}</div>
        </div>
        <span style="font-size:13px;font-weight:700;color:${sColor};">${step.overallScore}%</span>
      </div>`;
  }).join('');

  const missingHtml = missingEvents.length > 0 ? `
    <div class="card" style="border-color:#E74C3C30;">
      <div class="card-body" style="background:#FEF2F2;">
        <div class="card-title" style="color:#E74C3C;">Missing Funnel Events</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${missingEvents.map(e => `<span class="status-tag" style="background:rgba(231,76,60,0.12);color:#E74C3C;">${esc(e.label)}</span>`).join('')}
        </div>
      </div>
    </div>` : '';

  const htmlContent = `
<div class="page">
  <div class="card"><div class="card-body">
    <div class="header-top">
      <div>
        <div class="header-title">${esc(options.agencyName || 'Traacky')} <span style="font-weight:400;font-size:13px;color:#9B9BB0;">Funnel Audit Report</span></div>
      </div>
      <div class="header-date">${fmtDate()}</div>
    </div>
  </div></div>

  <div class="card"><div class="card-body">
    <div class="score-section">
      ${svgGauge(report.overallScore || 0)}
      <div class="score-details">
        <div class="card-title">Funnel Completion Score</div>
        <div class="score-summary">${detCount}/${expectedEvents.length} events · ${report.totalSteps || 0} pages · ${durStr}</div>
      </div>
    </div>
  </div></div>

  <div class="card"><div class="card-body">
    <div class="card-title">Funnel Events</div>
    ${timelineHtml}
  </div></div>

  ${pagesHtml ? `<div class="card"><div class="card-body"><div class="card-title">Pages Visited</div>${pagesHtml}</div></div>` : ''}
  ${missingHtml}

  <div class="footer">
    <span>${esc(options.whiteLabelFooter || 'Generated by Traacky')}</span>
    <span>${fmtDate()}</span>
  </div>
</div>`;

  const filename = `traacky-funnel-${new Date().toISOString().split('T')[0]}.pdf`;
  await requestPDFGeneration(htmlContent, CSS, filename);
  return filename;
}
