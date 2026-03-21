/**
 * PlanBadge Component — Shows current plan in the header area.
 * Free = gray, Pro = teal (primary)
 */

import { PLAN_CONFIG } from '../../shared/plans.js';

export function renderPlanBadge(container, plan, onUpgrade) {
  const c = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const isFree = plan === 'free';

  const badge = document.createElement('div');
  badge.className = 'plan-badge';
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: ${c.bg};
    border: 1px solid ${c.border};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: ${c.text};
    cursor: ${isFree ? 'pointer' : 'default'};
    transition: all 0.2s;
  `;
  badge.title = isFree ? 'Click to upgrade' : `${c.label} plan`;
  badge.innerHTML = isFree ? c.label : c.label;

  if (isFree && onUpgrade) {
    badge.addEventListener('click', onUpgrade);
    badge.addEventListener('mouseenter', () => {
      badge.style.borderColor = 'var(--tp-primary)';
      badge.style.background = 'rgba(0, 109, 119, 0.2)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.borderColor = c.border;
      badge.style.background = c.bg;
    });
  }

  container.innerHTML = '';
  container.appendChild(badge);
}
