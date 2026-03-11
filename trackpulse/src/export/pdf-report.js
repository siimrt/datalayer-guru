/**
 * PDF REPORT GENERATOR
 *
 * Uses jsPDF (dynamically imported) to generate audit and funnel reports.
 *
 * V2.1 improvements:
 * - Network-enhanced audit data (teal indicators for network-confirmed events)
 * - Overall score section at top of audit report
 * - Better event rows with background rectangles
 * - Network Tracking Requests section in audit report
 * - Visual timeline with connected circles for funnel report
 * - Per-step detail with platform breakdown
 */

import { enhanceAuditWithNetworkData } from '../sidepanel/utils/network-audit-enhancer.js';
import { enhancePixelsWithNetworkData } from '../sidepanel/utils/network-pixel-enhancer.js';
import { PAGE_TYPE_LABELS, PLATFORM_LABELS } from '../shared/constants.js';

// PDF-specific colors (RGB tuples for jsPDF)
const COLORS = {
  primary: [0, 109, 119],
  text: [51, 51, 51],
  gray: [128, 128, 128],
  lightGray: [245, 245, 250],
  green: [0, 184, 148],
  red: [255, 107, 107],
  yellow: [253, 203, 110],
  teal: [0, 206, 201],
};

/**
 * Helper: add a new page if y exceeds threshold.
 */
function checkPageBreak(doc, y, margin, threshold = 270) {
  if (y > threshold) {
    doc.addPage();
    return margin;
  }
  return y;
}

/**
 * Helper: draw a rounded rect background for a row.
 */
function drawRowBg(doc, x, y, w, h) {
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(x, y - h + 1.5, w, h, 1.5, 1.5, 'F');
}

/**
 * Calculate overall audit score from diff results.
 */
function calculateAuditScore(diffs) {
  if (diffs.length === 0) return 0;
  const found = diffs.filter(
    (d) => d.status === 'match' || d.status === 'partial' || d.status === 'network_confirmed'
  ).length;
  return Math.round((found / diffs.length) * 100);
}

export async function generateAuditReport(state, options = {}) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const networkRequests = state.networkRequests || [];

  // Enhance audit data with network requests
  const rawDiffs = state.audit?.diff || [];
  const auditDiffs = enhanceAuditWithNetworkData(rawDiffs, networkRequests);

  // Enhance pixel data with network requests
  const enhancedPixels = enhancePixelsWithNetworkData(state.pixels || [], networkRequests);

  // === HEADER ===
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');

  if (options.whiteLabelLogo && options.agencyName) {
    doc.text(options.agencyName + ' — Tracking Audit', margin, 22);
  } else {
    doc.text('Traacky — Tracking Audit Report', margin, 22);
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    margin,
    30
  );

  y = 45;

  // === OVERALL SCORE ===
  const overallScore = calculateAuditScore(auditDiffs);
  const scoreColor = overallScore >= 80 ? COLORS.green : overallScore >= 50 ? COLORS.yellow : COLORS.red;

  doc.setTextColor(...scoreColor);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`${overallScore}%`, margin, y + 8);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Tracking Audit Score', margin + 30, y + 3);

  // Score breakdown
  const matched = auditDiffs.filter((d) => d.status === 'match').length;
  const partial = auditDiffs.filter((d) => d.status === 'partial').length;
  const networkConfirmed = auditDiffs.filter((d) => d.status === 'network_confirmed').length;
  const missing = auditDiffs.filter((d) => d.status === 'missing').length;

  doc.setFontSize(9);
  doc.text(
    `${matched} found · ${partial} partial · ${networkConfirmed} via network · ${missing} missing`,
    margin + 30,
    y + 9
  );

  y += 20;

  // === SITE INFO ===
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Site Information', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const siteInfo = [
    ['URL', state.url || 'N/A'],
    ['CMS', `${state.cms?.cms || 'Unknown'} (${state.cms?.confidence || 0}% confidence)`],
    ['Page Type', state.pageType?.pageType || 'Unknown'],
    ['Currency', state.ecommerceData?.currency || 'N/A'],
  ];

  siteInfo.forEach(([label, value]) => {
    doc.setTextColor(...COLORS.gray);
    doc.text(`${label}:`, margin, y);
    doc.setTextColor(...COLORS.text);
    doc.text(value, margin + 35, y);
    y += 6;
  });

  y += 8;

  // === EVENT AUDIT ===
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Event Audit', margin, y);
  y += 8;

  auditDiffs.forEach((diff) => {
    y = checkPageBreak(doc, y, margin);

    const status = diff.status || 'missing';
    const score = diff.matchPercentage || 0;
    const name = diff.expected?.eventName || 'unknown';
    const platform = diff.expected?.platform || '';

    const statusColor = status === 'match' ? COLORS.green
      : status === 'partial' ? COLORS.yellow
      : status === 'network_confirmed' ? COLORS.teal
      : COLORS.red;
    const statusText = status === 'match' ? 'Found'
      : status === 'partial' ? `Partial (${score}%)`
      : status === 'network_confirmed' ? 'Via Network'
      : 'Missing';

    // Row background
    drawRowBg(doc, margin, y, contentWidth, 6);

    doc.setFillColor(...statusColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${platform.toUpperCase()}: ${name}`, margin + 6, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...statusColor);
    doc.text(statusText, margin + contentWidth - doc.getTextWidth(statusText), y);

    y += 5;

    // Show field diffs if partial
    if (status === 'partial' && diff.fields) {
      diff.fields
        .filter((f) => f.status !== 'match' && f.status !== 'extra')
        .slice(0, 5)
        .forEach((field) => {
          doc.setTextColor(...COLORS.gray);
          doc.setFontSize(8);
          const fieldStatus =
            field.status === 'missing'
              ? '— missing'
              : `— expected "${field.expected}", got "${field.actual}"`;
          doc.text(`    ${field.path} ${fieldStatus}`, margin + 6, y);
          y += 4;
        });
    }

    // Show network source note for network-confirmed events
    if (status === 'network_confirmed' && diff.networkMatch) {
      doc.setTextColor(...COLORS.teal);
      doc.setFontSize(8);
      const sourceNote = diff.networkMatch.source === 'custom_pixel' ? 'Detected via Custom Pixel network request' : 'Detected via network request';
      doc.text(`    ${sourceNote}`, margin + 6, y);
      y += 4;
    }

    y += 3;
  });

  y += 8;

  // === NETWORK TRACKING REQUESTS ===
  if (networkRequests.length > 0) {
    y = checkPageBreak(doc, y, margin, 250);

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Network Tracking Requests', margin, y);
    y += 8;

    // Group by platform
    const byPlatform = {};
    for (const req of networkRequests) {
      if (!byPlatform[req.platform]) byPlatform[req.platform] = [];
      byPlatform[req.platform].push(req);
    }

    for (const [platform, reqs] of Object.entries(byPlatform)) {
      y = checkPageBreak(doc, y, margin);

      const events = [...new Set(reqs.map((r) => r.eventName).filter(Boolean))];
      const label = PLATFORM_LABELS[platform] || platform;

      drawRowBg(doc, margin, y, contentWidth, 6);

      doc.setFillColor(...COLORS.green);
      doc.circle(margin + 2, y - 1.5, 1.5, 'F');

      doc.setTextColor(...COLORS.text);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin + 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text(`${reqs.length} request${reqs.length > 1 ? 's' : ''}`, margin + 40, y);

      y += 5;

      if (events.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gray);
        doc.text(`Events: ${events.join(', ')}`, margin + 6, y);
        y += 4;
      }

      y += 3;
    }

    y += 5;
  }

  // === PIXELS ===
  y = checkPageBreak(doc, y, margin, 250);

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Installed Pixels', margin, y);
  y += 8;

  enhancedPixels.forEach((pixel) => {
    y = checkPageBreak(doc, y, margin);

    const isNetwork = pixel.method === 'network';
    const color = pixel.active ? (isNetwork ? COLORS.teal : COLORS.green) : COLORS.gray;

    drawRowBg(doc, margin, y, contentWidth, 6);

    doc.setFillColor(...color);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${pixel.platform.toUpperCase()}${pixel.id ? ': ' + pixel.id : ''}`, margin + 6, y);

    doc.setTextColor(...color);
    const statusLabel = pixel.active ? (isNetwork ? 'Via Network' : 'Active') : 'Not detected';
    doc.text(statusLabel, margin + contentWidth - doc.getTextWidth(statusLabel) - 2, y);
    y += 6;
  });

  y += 8;

  // === CONSENT ===
  if (state.consent) {
    y = checkPageBreak(doc, y, margin, 250);

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Consent Status', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CMP: ${state.consent.cmpDetected || 'None'}`, margin, y);
    y += 6;

    if (state.consent.googleConsent) {
      Object.entries(state.consent.googleConsent).forEach(([key, value]) => {
        const color = value === 'granted' ? COLORS.green : COLORS.red;
        doc.setTextColor(...color);
        doc.text(`${key}: ${value}`, margin + 4, y);
        y += 5;
      });
    }
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(8);
    doc.text(options.whiteLabelFooter || 'Generated by Traacky', margin, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, 290);
  }

  // Save
  let hostname = 'site';
  try {
    hostname = new URL(state.url).hostname;
  } catch (e) {}
  const filename = `traacky-audit-${hostname}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return filename;
}

/**
 * Generate PDF report from funnel data.
 * V2.2: Event-based funnel with visual timeline, per-event detection status,
 *        pages visited section, network-enhanced scoring.
 */
export async function generateFunnelPDFReport(report, options = {}) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // PAGE_TYPE_LABELS imported from shared/constants.js

  const detected = report.detectedEvents || {};
  const expectedEvents = report.expectedEvents || [];
  const missingEvents = report.missingEvents || [];

  // === HEADER ===
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(options.agencyName || 'Traacky — Funnel Audit Report', margin, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    margin,
    30
  );

  y = 45;

  // === SUMMARY HEADER ===
  const scoreColor = report.overallScore >= 80 ? COLORS.green : report.overallScore >= 50 ? COLORS.yellow : COLORS.red;

  doc.setTextColor(...scoreColor);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.overallScore}%`, margin, y + 10);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Funnel Completion Score', margin + 35, y + 5);

  // Summary stats
  doc.setFontSize(9);
  const durationMs = report.duration || 0;
  const durationStr = durationMs < 60000
    ? `${Math.round(durationMs / 1000)}s`
    : `${Math.floor(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`;

  const detectedCount = Object.keys(detected).length;
  doc.text(`${detectedCount}/${expectedEvents.length} events · ${report.totalSteps} pages · ${durationStr}`, margin + 35, y + 11);

  y += 25;

  // === FUNNEL EVENTS TIMELINE ===
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Funnel Events', margin, y);
  y += 10;

  const circleX = margin + 5;
  const circleR = 4;
  const textX = margin + 16;

  expectedEvents.forEach((fe, i) => {
    y = checkPageBreak(doc, y, margin);

    const det = detected[fe.key];
    const detections = det?.detections || [];
    const expectedPlatforms = Object.keys(fe.events || {});
    const detectedPlatformSet = new Set(detections.map((d) => d.platform).filter((p) => p !== 'unknown'));
    const waitingCount = expectedPlatforms.filter((p) => !detectedPlatformSet.has(p)).length;
    const isPartial = det && waitingCount > 0;
    const isComplete = det && waitingCount === 0;

    const eventColor = isComplete ? COLORS.green : isPartial ? COLORS.yellow : COLORS.red;
    const isLast = i === expectedEvents.length - 1;

    // Connector line
    if (!isLast) {
      doc.setDrawColor(...(det ? eventColor : COLORS.gray));
      doc.setLineWidth(0.3);
      doc.line(circleX, y + circleR, circleX, y + 16);
    }

    // Circle
    doc.setFillColor(...eventColor);
    doc.circle(circleX, y, circleR, 'F');

    // Circle icon
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const icon = isComplete ? '✓' : isPartial ? '!' : '✗';
    doc.text(icon, circleX - doc.getTextWidth(icon) / 2, y + 1.5);

    // Event label
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(fe.label, textX, y);

    // Status with platform count
    doc.setTextColor(...eventColor);
    doc.setFontSize(10);
    const pCount = detectedPlatformSet.size;
    const statusText = !det ? 'Missing'
      : waitingCount > 0 ? `${pCount} platform${pCount !== 1 ? 's' : ''} · ${waitingCount} waiting`
      : `${pCount} platform${pCount !== 1 ? 's' : ''}`;
    doc.text(statusText, margin + contentWidth - doc.getTextWidth(statusText), y);

    y += 5;

    // Detection detail — multi-platform
    if (det) {
      const detections = det.detections || [];
      if (detections.length > 0) {
        doc.setTextColor(...COLORS.gray);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        const platformNames = [...new Set(detections.map((d) => d.platform).filter((p) => p !== 'unknown'))];
        const platformStr = platformNames.map((p) => PLATFORM_LABELS[p] || p).join(', ');
        doc.text(`${detections.length} detection${detections.length > 1 ? 's' : ''} — ${platformStr}`, textX, y);
        y += 4;

        // Show each detection
        for (const d of detections) {
          y = checkPageBreak(doc, y, margin);
          const srcLabel = d.source === 'datalayer_push' ? 'dataLayer push'
            : d.source === 'network' ? 'network request'
            : 'dataLayer audit';
          doc.setTextColor(...COLORS.gray);
          doc.text(`  ${PLATFORM_LABELS[d.platform] || d.platform}: ${d.eventName} (${srcLabel})`, textX, y);
          y += 4;
        }
      } else {
        // Legacy single-detection format fallback
        doc.setTextColor(...COLORS.gray);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const srcLabel = det.source === 'datalayer_push' ? 'dataLayer push'
          : det.source === 'network' ? 'network request'
          : 'dataLayer audit';
        doc.text(`via ${srcLabel} · ${det.eventName || ''}${det.platform && det.platform !== 'unknown' ? ` (${det.platform.toUpperCase()})` : ''}`, textX, y);
        y += 4;
      }
    }

    y += isLast ? 4 : 3;
  });

  y += 6;

  // === PAGES VISITED ===
  if (report.steps.length > 0) {
    y = checkPageBreak(doc, y, margin, 250);

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Pages Visited', margin, y);
    y += 8;

    report.steps.forEach((step) => {
      y = checkPageBreak(doc, y, margin);

      const stepColor = step.overallScore >= 80 ? COLORS.green : step.overallScore >= 50 ? COLORS.yellow : COLORS.red;

      drawRowBg(doc, margin, y, contentWidth, 6);

      doc.setFillColor(...stepColor);
      doc.circle(margin + 2, y - 1.5, 1.5, 'F');

      const label = PAGE_TYPE_LABELS[step.pageType] || step.pageType;
      doc.setTextColor(...COLORS.text);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${step.stepNumber}. ${label}`, margin + 6, y);

      doc.setTextColor(...stepColor);
      doc.text(`${step.overallScore}%`, margin + contentWidth - 10, y);

      y += 5;

      let pathname = '';
      try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
      doc.setTextColor(...COLORS.gray);
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      doc.text(pathname, margin + 6, y);

      y += 4;

      // Platform breakdown
      doc.setFont('helvetica', 'normal');
      const platforms = report.relevantPlatforms || ['ga4', 'meta', 'tiktok', 'pinterest'];
      const parts = platforms
        .filter((p) => (step.eventsFound?.[p] || 0) + (step.eventsMissing?.[p] || 0) > 0)
        .map((p) => `${PLATFORM_LABELS[p]}: ${step.eventsFound?.[p] || 0}/${(step.eventsFound?.[p] || 0) + (step.eventsMissing?.[p] || 0)}`);

      if (parts.length > 0) {
        doc.setTextColor(...COLORS.gray);
        doc.text(parts.join(' · '), margin + 6, y);
        y += 4;
      }

      y += 3;
    });
  }

  // === MISSING EVENTS ===
  if (missingEvents.length > 0) {
    y = checkPageBreak(doc, y, margin, 260);
    y += 3;

    doc.setFillColor(255, 240, 240);
    doc.roundedRect(margin, y - 4, contentWidth, 14, 2, 2, 'F');

    doc.setTextColor(...COLORS.red);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Missing Funnel Events', margin + 4, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const missingLabels = missingEvents.map((e) => e.label).join(', ');
    doc.text(missingLabels, margin + 4, y);

    y += 8;
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(8);
    doc.text(options.whiteLabelFooter || 'Generated by Traacky', margin, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, 290);
  }

  const filename = `traacky-funnel-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return filename;
}
