/**
 * Report page script — runs in a dedicated extension tab (full-width viewport).
 *
 * Reads the report payload from chrome.storage.session, injects the HTML + CSS,
 * renders via html2pdf.js, then closes the tab.
 */

import html2pdf from 'html2pdf.js';

(async function generatePDF() {
  try {
    const data = await chrome.storage.session.get('tp_pdf_report');
    const payload = data?.tp_pdf_report;

    if (!payload) {
      throw new Error('No report payload found in session storage');
    }

    const { htmlContent, cssText, filename } = payload;

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    document.head.appendChild(styleEl);

    // Inject HTML content
    const root = document.getElementById('report-root');
    root.innerHTML = htmlContent;

    // Wait for all images to load
    const imgs = root.querySelectorAll('img');
    await Promise.all(
      [...imgs].map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(r => { img.onload = r; img.onerror = r; })
      )
    );

    // Render PDF and trigger download
    await html2pdf().from(root).set({
      margin: [10, 8, 10, 8],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).save();

    // Signal success
    chrome.runtime.sendMessage({ type: 'TRACKPULSE_PDF_DONE' });

    // Clean up
    await chrome.storage.session.remove('tp_pdf_report');

    // Close this tab
    window.close();
  } catch (err) {
    console.error('[Traacky Report] PDF generation failed:', err);
    chrome.runtime.sendMessage({
      type: 'TRACKPULSE_PDF_ERROR',
      payload: { error: err.message },
    });
    await chrome.storage.session.remove('tp_pdf_report');
    window.close();
  }
})();
