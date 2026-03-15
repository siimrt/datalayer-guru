/**
 * Onboarding — Full-page immersive welcome flow with savings calculator.
 * 3 steps: Welcome → Time slider → Savings reveal with animated counters & sparkles.
 */

import { trackEvent } from '../../shared/analytics.js';

const SAVINGS_RATE = 0.65;
const HOURLY_RATE = 35;
const HOUR_VALUES = [1, 2, 4, 8, 16];
const HOUR_LABELS = ['1h', '2h', '4h', '8h', '16h+'];

export function shouldShowOnboarding() {
  return new Promise((resolve) => {
    chrome.storage.local.get('tp_onboarding_completed', (data) => {
      resolve(!data.tp_onboarding_completed);
    });
  });
}

export function showOnboarding(container, onComplete) {
  let step = 0;
  let sliderIndex = 2;

  const overlay = document.createElement('div');
  overlay.className = 'tp-ob';
  overlay.innerHTML = `
    <canvas class="tp-ob-particles"></canvas>
    <div class="tp-ob-content"></div>
    <div class="tp-ob-dots">
      <span class="tp-ob-dot active"></span>
      <span class="tp-ob-dot"></span>
      <span class="tp-ob-dot"></span>
    </div>
  `;

  const canvas = overlay.querySelector('.tp-ob-particles');
  const content = overlay.querySelector('.tp-ob-content');
  const dots = overlay.querySelectorAll('.tp-ob-dot');
  let particlesRAF = null;

  // ---- Floating particles background ----
  function initParticles() {
    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];

    function resize() {
      w = canvas.width = overlay.offsetWidth;
      h = canvas.height = overlay.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.15 + 0.05,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const style = getComputedStyle(document.documentElement);
      const color = style.getPropertyValue('--tp-primary').trim() || '#006d77';
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      particlesRAF = requestAnimationFrame(draw);
    }
    draw();
  }

  // ---- Sparkles (for savings reveal) ----
  function spawnSparkles(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 12; i++) {
      const spark = document.createElement('div');
      spark.className = 'tp-ob-sparkle';
      const angle = (Math.PI * 2 * i) / 12;
      const dist = 30 + Math.random() * 40;
      spark.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
      spark.style.setProperty('--sy', `${Math.sin(angle) * dist}px`);
      spark.style.left = cx + 'px';
      spark.style.top = cy + 'px';
      overlay.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove());
    }
  }

  // ---- Step transitions ----
  function transitionTo(buildFn) {
    content.classList.add('tp-ob-exit');
    setTimeout(() => {
      content.classList.remove('tp-ob-exit');
      content.innerHTML = '';
      buildFn();
      content.classList.add('tp-ob-enter');
      setTimeout(() => content.classList.remove('tp-ob-enter'), 400);
    }, 250);
  }

  function updateDots() {
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === step);
      d.classList.toggle('done', i < step);
    });
  }

  function finish(skipped) {
    const storage = { tp_onboarding_completed: true };
    if (skipped) {
      storage.tp_onboarding_skipped = true;
      trackEvent('onboarding_skipped', { step });
    } else {
      storage.tp_weekly_audit_hours = HOUR_VALUES[sliderIndex];
      const yearlySavingsEur = Math.round(HOUR_VALUES[sliderIndex] * SAVINGS_RATE * 52 * HOURLY_RATE);
      trackEvent('onboarding_completed', {
        weekly_hours: HOUR_VALUES[sliderIndex],
        yearly_savings_eur: yearlySavingsEur,
      });
    }
    chrome.storage.local.set(storage);
    if (particlesRAF) cancelAnimationFrame(particlesRAF);
    overlay.classList.add('tp-ob-fadeout');
    setTimeout(() => { overlay.remove(); onComplete(); }, 350);
  }

  // ---- Step 0: Welcome ----
  function buildWelcome() {
    trackEvent('onboarding_started', {});
    content.innerHTML = `
      <div class="tp-ob-welcome">
        <img src="../assets/icons/icon-128.png" alt="Traacky" class="tp-ob-logo">
        <h1 class="tp-ob-title tp-ob-stagger-1">Welcome to Traacky</h1>
        <p class="tp-ob-subtitle tp-ob-stagger-2">Your tracking audit co-pilot</p>
        <button class="tp-ob-btn-primary tp-ob-stagger-3">Get Started</button>
        <button class="tp-ob-btn-skip tp-ob-stagger-3">Skip</button>
      </div>
    `;
    content.querySelector('.tp-ob-btn-primary').addEventListener('click', () => {
      step = 1;
      updateDots();
      transitionTo(buildSlider);
    });
    content.querySelector('.tp-ob-btn-skip').addEventListener('click', () => finish(true));
  }

  // ---- Step 1: Slider ----
  function buildSlider() {
    content.innerHTML = `
      <div class="tp-ob-slider-page">
        <h1 class="tp-ob-question tp-ob-stagger-1">How much time do you spend on tracking audits each week?</h1>
        <p class="tp-ob-hint tp-ob-stagger-2">Move the slider to estimate</p>
        <div class="tp-ob-slider-value tp-ob-stagger-2">${HOUR_LABELS[sliderIndex]}</div>
        <div class="tp-ob-slider-wrap tp-ob-stagger-3">
          <input type="range" min="0" max="4" step="1" value="${sliderIndex}" class="tp-ob-range">
          <div class="tp-ob-range-labels">
            ${HOUR_LABELS.map((l, i) => `<span class="${i === sliderIndex ? 'active' : ''}">${l}</span>`).join('')}
          </div>
        </div>
        <button class="tp-ob-btn-primary tp-ob-stagger-4">See my savings</button>
        <button class="tp-ob-btn-skip tp-ob-stagger-4">Skip</button>
      </div>
    `;

    const range = content.querySelector('.tp-ob-range');
    const valDisplay = content.querySelector('.tp-ob-slider-value');
    const labels = content.querySelectorAll('.tp-ob-range-labels span');

    range.addEventListener('input', (e) => {
      sliderIndex = parseInt(e.target.value, 10);
      // Bounce animation on value change
      valDisplay.textContent = HOUR_LABELS[sliderIndex];
      valDisplay.classList.remove('tp-ob-bounce');
      void valDisplay.offsetWidth; // reflow
      valDisplay.classList.add('tp-ob-bounce');
      // Highlight active label
      labels.forEach((l, i) => l.classList.toggle('active', i === sliderIndex));
    });

    content.querySelector('.tp-ob-btn-primary').addEventListener('click', () => {
      trackEvent('onboarding_hours_selected', { weekly_hours: HOUR_VALUES[sliderIndex] });
      step = 2;
      updateDots();
      transitionTo(buildSavings);
    });
    content.querySelector('.tp-ob-btn-skip').addEventListener('click', () => finish(true));
  }

  // ---- Confetti rain ----
  function spawnConfetti() {
    const COLORS = ['#006d77', '#83c5be', '#ffddd2', '#00B894', '#e0f4f1', '#b8e0d9'];
    const count = 55;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'tp-ob-confetti';
      el.style.left = Math.random() * 100 + '%';
      el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.style.setProperty('--drift', (Math.random() - 0.5) * 150 + 'px');
      el.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      el.style.animationDelay = Math.random() * 0.5 + 's';
      el.style.animationDuration = 1.4 + Math.random() * 1 + 's';
      el.style.width = Math.random() * 6 + 6 + 'px';
      el.style.height = Math.random() * 8 + 8 + 'px';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      overlay.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  // ---- Step 2: Savings reveal ----
  function buildSavings() {
    const hours = HOUR_VALUES[sliderIndex];
    const weeklyH = hours * SAVINGS_RATE;
    const monthlyH = weeklyH * 4;
    const yearlyH = weeklyH * 52;
    const weeklyEur = Math.round(weeklyH * HOURLY_RATE);
    const monthlyEur = Math.round(monthlyH * HOURLY_RATE);
    const yearlyEur = Math.round(yearlyH * HOURLY_RATE);
    const socialProofH = Math.round(hours * 0.7 * 4.33);

    content.innerHTML = `
      <div class="tp-ob-savings-page">
        <h1 class="tp-ob-typewriter"></h1>
        <div class="tp-ob-hero">
          <span class="tp-ob-hero-number">0</span>
          <span class="tp-ob-hero-suffix">h / year</span>
        </div>
        <p class="tp-ob-hero-eur">≈ <span class="tp-ob-hero-eur-num">0</span> €/year <span class="tp-ob-hero-eur-note">(based on €35/h)</span></p>
        <p class="tp-ob-social-proof">Tracking devs save an average of ${socialProofH}h/month with Traacky</p>
        <div class="tp-ob-cards-row">
          <div class="tp-ob-card-sm tp-ob-card-0">
            <span class="tp-ob-card-label">Weekly</span>
            <div class="tp-ob-card-row">
              <span class="tp-ob-num" data-t="${weeklyH}" data-s="h">0h</span>
              <span class="tp-ob-num tp-ob-num-eur" data-t="${weeklyEur}" data-s=" €">0 €</span>
            </div>
          </div>
          <div class="tp-ob-card-sm tp-ob-card-1">
            <span class="tp-ob-card-label">Monthly</span>
            <div class="tp-ob-card-row">
              <span class="tp-ob-num" data-t="${monthlyH}" data-s="h">0h</span>
              <span class="tp-ob-num tp-ob-num-eur" data-t="${monthlyEur}" data-s=" €">0 €</span>
            </div>
          </div>
        </div>
        <button class="tp-ob-btn-primary tp-ob-btn-final">Run my first audit →</button>
      </div>
    `;

    const titleEl = content.querySelector('.tp-ob-typewriter');
    const heroNum = content.querySelector('.tp-ob-hero-number');
    const heroWrap = content.querySelector('.tp-ob-hero');
    const heroEurNum = content.querySelector('.tp-ob-hero-eur-num');
    const heroEurLine = content.querySelector('.tp-ob-hero-eur');
    const finalBtn = content.querySelector('.tp-ob-btn-final');

    // Phase 1: typewriter (0–600ms)
    const titleText = 'Traacky saves you...';
    let charIdx = 0;
    const typeInterval = setInterval(() => {
      charIdx++;
      titleEl.textContent = titleText.slice(0, charIdx);
      if (charIdx >= titleText.length) clearInterval(typeInterval);
    }, 25);

    // Phase 2: hero yearly hours counter (600ms)
    setTimeout(() => {
      heroWrap.classList.add('tp-ob-hero-visible');
      animateCounter(heroNum, yearlyH, '', 1600);
    }, 600);

    // Phase 2b: euro line appears + animates (1400ms)
    setTimeout(() => {
      heroEurLine.classList.add('visible');
      animateCounter(heroEurNum, yearlyEur, '', 1200);
    }, 1400);

    // Phase 3: sparkles + confetti when hero lands (2200ms)
    setTimeout(() => {
      spawnSparkles(heroNum);
      spawnConfetti();
      heroWrap.classList.add('tp-ob-hero-settle');
    }, 2300);

    // Phase 4: weekly & monthly cards side by side (2600ms)
    [0, 1].forEach((i) => {
      setTimeout(() => {
        const card = content.querySelector(`.tp-ob-card-${i}`);
        if (card) card.classList.add('visible');
        card?.querySelectorAll('.tp-ob-num').forEach((el, j) => {
          setTimeout(() => {
            animateCounter(el, parseFloat(el.dataset.t), el.dataset.s, 1000);
          }, j * 250);
        });
      }, 2600 + i * 150);
    });

    // Phase 5: final button (3500ms — after confetti)
    setTimeout(() => {
      finalBtn.classList.add('visible');
    }, 3500);

    finalBtn.addEventListener('click', () => finish(false));
  }

  // ---- Init ----
  container.appendChild(overlay);
  initParticles();
  updateDots();
  buildWelcome();
}

function animateCounter(el, target, suffix, duration = 1500) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = (target >= 100
      ? Math.round(val).toLocaleString('fr-FR')
      : val.toFixed(1)) + suffix;
    if (p < 1) {
      el.style.filter = `blur(${(1 - p) * 1.5}px)`;
      requestAnimationFrame(tick);
    } else {
      el.style.filter = 'none';
    }
  }
  requestAnimationFrame(tick);
}
