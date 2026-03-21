/**
 * TabNav Component — Tab navigation.
 * V2.1: Audit tab is now free (no lock). Only Funnel is gated.
 */

const TABS = [
  { id: 'events', label: 'Events' },
  { id: 'audit', label: 'Audit' },
  { id: 'datalayer', label: 'DataLayer' },
  { id: 'pixels', label: 'Pixels' },
  { id: 'funnel', label: 'Funnel' },
];

export function renderTabNav(container, activeTab, onTabChange, capabilities) {
  container.innerHTML = `
    <div class="tp-tabs">
      ${TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const isLocked = tab.id === 'funnel' && capabilities && !capabilities.canFunnelMode;
        return `
        <button
          class="tp-tab ${isActive ? 'active' : ''}"
          data-tab="${tab.id}"
          title="${isLocked ? 'Pro feature' : tab.label}"
        >
          ${tab.label}${isLocked ? ' <span style="font-size: 10px;">&#128274;</span>' : ''}
        </button>
      `;
      }).join('')}
      <button
        class="tp-tab tp-tab-settings ${activeTab === 'settings' ? 'active' : ''}"
        data-tab="settings"
        title="Settings & Account"
        style="flex: 0; padding: 10px 10px; font-size: 14px;"
      >
        &#9881;
      </button>
    </div>
  `;

  // Bind tab clicks
  container.querySelectorAll('.tp-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      onTabChange(btn.dataset.tab);
    });
  });
}
