/**
 * TabNav Component — Tab navigation with four tabs.
 */

const TABS = [
  { id: 'events', label: 'Events' },
  { id: 'audit', label: 'Audit' },
  { id: 'datalayer', label: 'DataLayer' },
  { id: 'pixels', label: 'Pixels' },
];

export function renderTabNav(container, activeTab, onTabChange) {
  container.innerHTML = `
    <div class="tp-tabs">
      ${TABS.map(
        (tab) => `
        <button
          class="tp-tab ${tab.id === activeTab ? 'active' : ''}"
          data-tab="${tab.id}"
        >
          ${tab.label}
        </button>
      `
      ).join('')}
    </div>
  `;

  // Bind tab clicks
  container.querySelectorAll('.tp-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      onTabChange(btn.dataset.tab);
    });
  });
}
