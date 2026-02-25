/**
 * PDF REPORT GENERATOR
 *
 * Uses jsPDF (dynamically imported) to generate audit reports.
 *
 * Report includes:
 * - Header with Traacky branding (or custom logo for Agency white-label)
 * - Site info: URL, CMS, page type
 * - Event audit results (expected vs actual)
 * - Pixel inventory
 * - Consent status
 */

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

  // Colors
  const purple = [108, 92, 231];
  const textColor = [51, 51, 51];
  const grayText = [128, 128, 128];
  const green = [0, 184, 148];
  const red = [255, 107, 107];
  const yellow = [253, 203, 110];

  // === HEADER ===
  doc.setFillColor(...purple);
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

  // === SITE INFO ===
  doc.setTextColor(...textColor);
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
    doc.setTextColor(...grayText);
    doc.text(`${label}:`, margin, y);
    doc.setTextColor(...textColor);
    doc.text(value, margin + 35, y);
    y += 6;
  });

  y += 8;

  // === EVENT AUDIT ===
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Event Audit', margin, y);
  y += 8;

  const auditDiffs = state.audit?.diff || [];

  auditDiffs.forEach((diff) => {
    const status = diff.status || 'missing';
    const score = diff.matchPercentage || 0;
    const name = diff.expected?.eventName || 'unknown';
    const platform = diff.expected?.platform || '';

    const statusColor = status === 'match' ? green : status === 'partial' ? yellow : red;
    const statusText = status === 'match' ? 'Found' : status === 'partial' ? `Partial (${score}%)` : 'Missing';

    doc.setFillColor(...statusColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');

    doc.setTextColor(...textColor);
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
          doc.setTextColor(...grayText);
          doc.setFontSize(8);
          const fieldStatus =
            field.status === 'missing'
              ? '— missing'
              : `— expected "${field.expected}", got "${field.actual}"`;
          doc.text(`    ${field.path} ${fieldStatus}`, margin + 6, y);
          y += 4;
        });
    }

    y += 3;

    // Page break if needed
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
  });

  y += 8;

  // === PIXELS ===
  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Installed Pixels', margin, y);
  y += 8;

  (state.pixels || []).forEach((pixel) => {
    const color = pixel.active ? green : grayText;
    doc.setFillColor(...color);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');

    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${pixel.platform.toUpperCase()}${pixel.id ? ': ' + pixel.id : ''}`, margin + 6, y);

    doc.setTextColor(...color);
    doc.text(pixel.active ? 'Active' : 'Not detected', margin + contentWidth - 20, y);
    y += 6;
  });

  y += 8;

  // === CONSENT ===
  if (state.consent && y < 250) {
    doc.setTextColor(...textColor);
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
        const color = value === 'granted' ? green : red;
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
    doc.setTextColor(...grayText);
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
  let y = margin;

  // Colors
  const purple = [108, 92, 231];
  const textColor = [51, 51, 51];
  const grayText = [128, 128, 128];
  const green = [0, 184, 148];
  const red = [255, 107, 107];
  const yellow = [253, 203, 110];

  // === HEADER ===
  doc.setFillColor(...purple);
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

  // === OVERALL SCORE ===
  const scoreColor = report.overallScore >= 80 ? green : report.overallScore >= 50 ? yellow : red;
  doc.setTextColor(...scoreColor);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.overallScore}%`, margin, y + 10);

  doc.setTextColor(...grayText);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Overall Funnel Score', margin + 35, y + 5);
  doc.text(`${report.totalSteps} pages analyzed`, margin + 35, y + 11);

  y += 25;

  // === FUNNEL STEPS ===
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Funnel Steps', margin, y);
  y += 8;

  report.steps.forEach((step) => {
    const stepColor = step.overallScore >= 80 ? green : step.overallScore >= 50 ? yellow : red;

    doc.setFillColor(...stepColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');

    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${step.stepNumber}. ${step.pageType}`, margin + 6, y);

    doc.setTextColor(...stepColor);
    doc.text(`${step.overallScore}%`, margin + 150, y);

    y += 5;

    let pathname = '';
    try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
    doc.setTextColor(...grayText);
    doc.setFontSize(8);
    doc.text(pathname, margin + 6, y);
    y += 4;

    doc.text(
      `GA4: ${step.eventsFound.ga4} found, ${step.eventsMissing.ga4} missing | Meta: ${step.eventsFound.meta} found, ${step.eventsMissing.meta} missing`,
      margin + 6,
      y
    );
    y += 7;

    if (y > 270) {
      doc.addPage();
      y = margin;
    }
  });

  // Missing steps
  if (report.missingSteps.length > 0) {
    y += 5;
    doc.setTextColor(...red);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Missing funnel steps:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(report.missingSteps.join(', '), margin, y);
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...grayText);
    doc.setFontSize(8);
    doc.text(options.whiteLabelFooter || 'Generated by Traacky', margin, 290);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, 290);
  }

  const filename = `traacky-funnel-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return filename;
}
