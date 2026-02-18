/**
 * DataLayerLive Component — Real-time dataLayer stream, newest at top.
 */

import { formatTime, escapeHtml, syntaxHighlight } from '../../shared/utils.js';

let filterText = '';
let ecomOnly = false;
let expandedEntries = new Set();

export function renderDataLayerLive(container, state, actions) {
  const stream = state.dataLayerStream || [];

  // Filter entries
  const filtered = stream.filter((entry) => {
    if (ecomOnly) {
      const data = entry.data?.[0] || entry.data;
      if (!data?.ecommerce) return false;
    }
    if (filterText) {
      const str = JSON.stringify(entry.data).toLowerCase();
      if (!str.includes(filterText.toLowerCase())) return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="flex items-center justify-between p-3 border-b border-tp-border">
      <div class="text-[12px] font-medium">DataLayer Live Stream</div>
      <div class="flex items-center gap-2">
        <span class="tp-live">
          <span class="tp-live-dot"></span>
          LIVE
        </span>
        <button class="tp-btn tp-btn-sm" id="dl-clear">Clear</button>
      </div>
    </div>
    <div class="tp-filter">
      <input type="text" placeholder="Filter events..." id="dl-filter" value="${escapeHtml(filterText)}" />
      <label>
        <input type="checkbox" id="dl-ecom-only" ${ecomOnly ? 'checked' : ''} />
        Ecom only
      </label>
    </div>
    <div id="dl-entries">
      ${filtered.length === 0
        ? `<div class="tp-empty">
            <div class="tp-empty-icon">&#128225;</div>
            <p>${stream.length === 0 ? 'Waiting for dataLayer events...' : 'No matching events'}</p>
            <p class="text-[11px] mt-1">${stream.length === 0 ? 'Events will appear here as they fire' : `${stream.length} total events captured`}</p>
          </div>`
        : filtered.map((entry, i) => renderStreamEntry(entry, filtered.length - i)).join('')
      }
    </div>
  `;

  // Bind filter
  const filterInput = container.querySelector('#dl-filter');
  filterInput?.addEventListener('input', (e) => {
    filterText = e.target.value;
    renderDataLayerLive(container, state, actions);
  });

  // Bind ecom only toggle
  const ecomCheckbox = container.querySelector('#dl-ecom-only');
  ecomCheckbox?.addEventListener('change', (e) => {
    ecomOnly = e.target.checked;
    renderDataLayerLive(container, state, actions);
  });

  // Bind clear
  container.querySelector('#dl-clear')?.addEventListener('click', () => {
    actions.clearDataLayerStream();
  });

  // Bind entry expand/collapse
  container.querySelectorAll('.tp-dl-entry').forEach((entry) => {
    entry.addEventListener('click', () => {
      const id = entry.dataset.entryId;
      const detail = entry.querySelector('.tp-dl-detail');
      if (detail) {
        const isHidden = detail.style.display === 'none';
        detail.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          expandedEntries.add(id);
        } else {
          expandedEntries.delete(id);
        }
      }
    });
  });
}

/**
 * Append a new entry to the live stream without full re-render.
 */
export function appendDataLayerEntry(container, entry, number) {
  const entriesEl = container.querySelector('#dl-entries');
  if (!entriesEl) return;

  // Remove empty state if present
  const emptyEl = entriesEl.querySelector('.tp-empty');
  if (emptyEl) emptyEl.remove();

  // Add new entry at top
  const html = renderStreamEntry(entry, number);
  entriesEl.insertAdjacentHTML('afterbegin', html);

  // Bind click
  const newEntry = entriesEl.firstElementChild;
  newEntry?.addEventListener('click', () => {
    const detail = newEntry.querySelector('.tp-dl-detail');
    if (detail) {
      const isHidden = detail.style.display === 'none';
      detail.style.display = isHidden ? 'block' : 'none';
    }
  });
}

function renderStreamEntry(entry, number) {
  const data = entry.data?.[0] || entry.data;
  const eventName = getEventName(data);
  const time = formatTime(entry.timestamp);
  const isExpanded = expandedEntries.has(String(entry.id));
  const hasEcommerce = data?.ecommerce != null;

  let jsonStr;
  try {
    jsonStr = JSON.stringify(data, null, 2);
  } catch (e) {
    jsonStr = String(data);
  }

  return `
    <div class="tp-dl-entry animate-slide-in" data-entry-id="${entry.id}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-tp-text-muted">#${number}</span>
          <span class="text-[11px] text-tp-text-secondary">${time}</span>
          <span class="text-[12px] font-medium ${hasEcommerce ? 'text-tp-primary' : 'text-tp-text'}">${escapeHtml(eventName)}</span>
          ${hasEcommerce ? '<span class="text-[9px] text-tp-primary bg-tp-primary/10 px-1 rounded">ecom</span>' : ''}
        </div>
        <svg class="tp-chevron ${isExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="tp-dl-detail mt-2" style="display: ${isExpanded ? 'block' : 'none'};">
        <div class="code-block text-[10.5px]">${syntaxHighlight(jsonStr)}</div>
      </div>
    </div>
  `;
}

function getEventName(data) {
  if (!data) return 'unknown';
  if (typeof data === 'string') return data;
  if (data.event) return data.event;
  if (Array.isArray(data) && data[0]) return String(data[0]);
  return 'data';
}
