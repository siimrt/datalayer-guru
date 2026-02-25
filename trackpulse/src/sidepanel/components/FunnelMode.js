/**
 * FunnelMode Component — Multi-page funnel audit (Pro+).
 *
 * How it works:
 * 1. User clicks "Start Funnel" -> enters recording mode
 * 2. User navigates through pages normally
 * 3. On each page, Traacky captures: page type, detected events, diff
 * 4. User clicks "Stop Funnel" -> shows funnel summary
 * 5. Can export as PDF report
 *
 * Stored in chrome.storage.session (cleared when browser closes).
 */

import { renderSectionPaywall } from './Paywall.js';

const FUNNEL_STORAGE_KEY = 'tp_funnel_session';

export class FunnelSession {
  constructor() {
    this.isRecording = false;
    this.steps = [];
    this.startTime = null;
  }

  async start() {
    this.isRecording = true;
    this.steps = [];
    this.startTime = Date.now();

    await chrome.storage.session.set({
      [FUNNEL_STORAGE_KEY]: {
        isRecording: true,
        steps: [],
        startTime: this.startTime,
      },
    });
  }

  async addStep(detectionResult) {
    if (!this.isRecording) return;

    const step = {
      url: detectionResult.url || '',
      pageType: detectionResult.pageType?.pageType || 'unknown',
      cms: detectionResult.cms?.cms || 'unknown',
      timestamp: Date.now(),
      generatedEvents: detectionResult.generatedEvents,
      audit: detectionResult.audit,
      ecommerceData: detectionResult.ecommerceData,
      pixels: detectionResult.pixels,
      consent: detectionResult.consent,
    };

    this.steps.push(step);

    await chrome.storage.session.set({
      [FUNNEL_STORAGE_KEY]: {
        isRecording: this.isRecording,
        steps: this.steps,
        startTime: this.startTime,
      },
    });
  }

  async stop() {
    this.isRecording = false;

    await chrome.storage.session.set({
      [FUNNEL_STORAGE_KEY]: {
        isRecording: false,
        steps: this.steps,
        startTime: this.startTime,
        endTime: Date.now(),
      },
    });

    return this.generateFunnelReport();
  }

  generateFunnelReport() {
    const expectedFlow = ['product', 'cart', 'checkout', 'thank_you'];
    const actualFlow = this.steps.map((s) => s.pageType);

    const funnelAnalysis = {
      totalSteps: this.steps.length,
      duration:
        this.steps.length > 0
          ? this.steps[this.steps.length - 1].timestamp - this.steps[0].timestamp
          : 0,
      pageTypes: actualFlow,
      missingSteps: expectedFlow.filter((step) => !actualFlow.includes(step)),
      steps: this.steps.map((step, index) => ({
        ...step,
        stepNumber: index + 1,
        eventsFound: {
          ga4: (step.audit?.diff || []).filter((d) => d.platform === 'ga4' && d.status !== 'missing').length,
          meta: (step.audit?.diff || []).filter((d) => d.platform === 'meta' && d.status !== 'missing').length,
        },
        eventsMissing: {
          ga4: (step.audit?.diff || []).filter((d) => d.platform === 'ga4' && d.status === 'missing').length,
          meta: (step.audit?.diff || []).filter((d) => d.platform === 'meta' && d.status === 'missing').length,
        },
        overallScore: calculateStepScore(step),
      })),
      overallScore: 0,
    };

    if (funnelAnalysis.steps.length > 0) {
      funnelAnalysis.overallScore = Math.round(
        funnelAnalysis.steps.reduce((sum, s) => sum + s.overallScore, 0) / funnelAnalysis.steps.length
      );
    }

    return funnelAnalysis;
  }

  async loadSession() {
    try {
      const data = await chrome.storage.session.get(FUNNEL_STORAGE_KEY);
      const session = data[FUNNEL_STORAGE_KEY];
      if (session) {
        this.isRecording = session.isRecording || false;
        this.steps = session.steps || [];
        this.startTime = session.startTime;
      }
    } catch (e) {
      // chrome.storage.session may not be available in all contexts
    }
  }
}

function calculateStepScore(step) {
  const diffs = step.audit?.diff || [];
  if (diffs.length === 0) return 0;
  const matchCount = diffs.filter((d) => d.status === 'match' || d.status === 'partial').length;
  return Math.round((matchCount / diffs.length) * 100);
}

/**
 * Render the Funnel Mode tab.
 */
export function renderFunnelMode(container, funnelSession, capabilities, lastReport) {
  if (!capabilities.canFunnelMode) {
    renderSectionPaywall(container, 'funnelMode', 'pro');
    return;
  }

  // If we have a report to show, render it
  if (lastReport) {
    renderFunnelReport(container, lastReport, funnelSession, capabilities);
    return;
  }

  if (funnelSession.isRecording) {
    renderRecordingState(container, funnelSession, capabilities);
  } else {
    renderIdleState(container, funnelSession, capabilities);
  }
}

function renderIdleState(container, funnelSession, capabilities) {
  container.innerHTML = `
    <div style="padding: 16px; text-align: center;">
      <div style="font-size: 32px; margin-bottom: 12px;">&#128279;</div>
      <div style="color: var(--tp-text); font-size: 14px; font-weight: 600; margin-bottom: 8px;">
        Funnel Mode
      </div>
      <div style="color: var(--tp-text-secondary); font-size: 12px; margin-bottom: 16px; line-height: 1.5;">
        Record your navigation through a purchase funnel.<br>
        Traacky will audit tracking on each step.
      </div>
      <button id="funnel-start-btn" style="
        background: var(--tp-primary); color: white; border: none;
        padding: 10px 24px; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: all 0.2s;
      ">&#9654; Start Funnel Recording</button>
    </div>
  `;

  const startBtn = container.querySelector('#funnel-start-btn');
  startBtn.addEventListener('click', async () => {
    await funnelSession.start();
    renderRecordingState(container, funnelSession, capabilities);
  });
  startBtn.addEventListener('mouseenter', () => { startBtn.style.background = '#7d6ef0'; });
  startBtn.addEventListener('mouseleave', () => { startBtn.style.background = 'var(--tp-primary)'; });
}

function renderRecordingState(container, funnelSession, capabilities) {
  const steps = funnelSession.steps || [];

  container.innerHTML = `
    <div style="padding: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <div style="width: 8px; height: 8px; background: var(--tp-error); border-radius: 50%; animation: pulse-custom 1s infinite;"></div>
        <span style="color: var(--tp-error); font-size: 13px; font-weight: 600;">Recording Funnel...</span>
      </div>
      <div style="color: var(--tp-text-secondary); font-size: 12px; margin-bottom: 12px;">
        ${steps.length} page${steps.length !== 1 ? 's' : ''} captured.
        Navigate to the next page in the funnel.
      </div>
      ${steps.map((step, i) => {
        let pathname = '';
        try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
        return `
        <div style="
          background: var(--tp-surface); border-radius: 6px; padding: 8px 12px;
          margin-bottom: 4px; border-left: 3px solid var(--tp-primary);
          display: flex; justify-content: space-between; align-items: center;
          border: 1px solid var(--tp-border);
        ">
          <span style="color: var(--tp-text); font-size: 12px;">${i + 1}. ${step.pageType}</span>
          <span style="color: var(--tp-text-muted); font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pathname}</span>
        </div>`;
      }).join('')}
      <button id="funnel-stop-btn" style="
        background: var(--tp-error); color: white; border: none;
        padding: 10px 0; border-radius: 8px; width: 100%;
        font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 12px;
        transition: all 0.2s;
      ">&#9209; Stop & Analyze Funnel</button>
    </div>
  `;

  container.querySelector('#funnel-stop-btn').addEventListener('click', async () => {
    const report = await funnelSession.stop();
    renderFunnelReport(container, report, funnelSession, capabilities);
  });
}

function renderFunnelReport(container, report, funnelSession, capabilities) {
  const scoreColor = report.overallScore >= 80 ? 'var(--tp-success)' : report.overallScore >= 50 ? 'var(--tp-warning)' : 'var(--tp-error)';

  container.innerHTML = `
    <div style="padding: 16px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 36px; font-weight: 700; color: ${scoreColor};">${report.overallScore}%</div>
        <div style="color: var(--tp-text-secondary); font-size: 12px;">Overall Funnel Score</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="color: var(--tp-text); font-size: 13px; font-weight: 600; margin-bottom: 8px;">Funnel Steps</div>
        ${report.steps.map((step) => {
          const stepColor = step.overallScore >= 80 ? 'var(--tp-success)' : step.overallScore >= 50 ? 'var(--tp-warning)' : 'var(--tp-error)';
          let pathname = '';
          try { pathname = new URL(step.url).pathname; } catch (e) { pathname = step.url; }
          return `
          <div style="
            background: var(--tp-surface); border-radius: 6px; padding: 10px 12px;
            margin-bottom: 4px; border-left: 3px solid ${stepColor};
            border: 1px solid var(--tp-border);
          ">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--tp-text); font-size: 12px; font-weight: 600;">${step.stepNumber}. ${step.pageType}</span>
              <span style="color: ${stepColor}; font-size: 12px;">${step.overallScore}%</span>
            </div>
            <div style="color: var(--tp-text-muted); font-size: 11px;">${pathname}</div>
            <div style="color: var(--tp-text-secondary); font-size: 11px; margin-top: 4px;">
              GA4: ${step.eventsFound.ga4} found, ${step.eventsMissing.ga4} missing &middot;
              Meta: ${step.eventsFound.meta} found, ${step.eventsMissing.meta} missing
            </div>
          </div>`;
        }).join('')}
      </div>

      ${report.missingSteps.length > 0 ? `
      <div style="
        background: rgba(231, 76, 60, 0.08); border: 1px solid rgba(231, 76, 60, 0.2);
        border-radius: 6px; padding: 10px 12px; margin-bottom: 16px;
      ">
        <div style="color: var(--tp-error); font-size: 12px; font-weight: 600; margin-bottom: 4px;">Missing funnel steps:</div>
        <div style="color: var(--tp-text-secondary); font-size: 12px;">${report.missingSteps.join(', ')}</div>
      </div>
      ` : ''}

      <div style="display: flex; gap: 8px;">
        ${capabilities.canExportPDF ? `
        <button id="funnel-export-btn" style="
          background: var(--tp-surface); color: var(--tp-text); border: 1px solid var(--tp-border);
          padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; flex: 1;
          transition: all 0.2s;
        ">&#128196; Export PDF</button>
        ` : ''}
        <button id="funnel-new-btn" style="
          background: var(--tp-primary); color: white; border: none;
          padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; flex: 1;
          transition: all 0.2s;
        ">&#128279; New Funnel</button>
      </div>
    </div>
  `;

  container.querySelector('#funnel-new-btn')?.addEventListener('click', () => {
    renderIdleState(container, funnelSession, capabilities);
  });

  container.querySelector('#funnel-export-btn')?.addEventListener('click', async () => {
    // Dynamically import PDF generator
    const { generateFunnelPDFReport } = await import('../../export/pdf-report.js');
    await generateFunnelPDFReport(report);
  });
}
