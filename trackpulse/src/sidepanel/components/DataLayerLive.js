/**
 * DataLayerLive Component — Real-time dataLayer stream with rich detail view.
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
      const data = extractData(entry);
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
      <div class="flex items-center gap-2">
        <div class="text-[12px] font-medium">DataLayer Live</div>
        <span style="
          font-size: 10px; color: var(--tp-text-muted);
          background: var(--tp-surface); padding: 1px 6px;
          border-radius: 10px; border: 1px solid var(--tp-border);
        ">${filtered.length}${filtered.length !== stream.length ? '/' + stream.length : ''}</span>
      </div>
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
        Ecom
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
  bindEntryClicks(container);
}

/**
 * Append a new entry to the live stream without full re-render.
 */
export function appendDataLayerEntry(container, entry, number) {
  const entriesEl = container.querySelector('#dl-entries');
  if (!entriesEl) return;

  // Apply filter check before appending
  if (ecomOnly) {
    const data = extractData(entry);
    if (!data?.ecommerce) return;
  }
  if (filterText) {
    const str = JSON.stringify(entry.data).toLowerCase();
    if (!str.includes(filterText.toLowerCase())) return;
  }

  // Remove empty state if present
  const emptyEl = entriesEl.querySelector('.tp-empty');
  if (emptyEl) emptyEl.remove();

  // Update counter
  const counterEl = container.querySelector('.flex.items-center.gap-2 span[style]');
  if (counterEl) {
    counterEl.textContent = String(number);
  }

  // Add new entry at top
  const html = renderStreamEntry(entry, number);
  entriesEl.insertAdjacentHTML('afterbegin', html);

  // Bind click on new entry
  const newEntry = entriesEl.firstElementChild;
  if (newEntry) {
    newEntry.addEventListener('click', (e) => {
      // Don't toggle if clicking a copy button
      if (e.target.closest('.dl-copy-btn')) return;
      toggleEntry(newEntry);
    });
    const copyBtn = newEntry.querySelector('.dl-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const json = copyBtn.dataset.json;
        navigator.clipboard.writeText(json).catch(() => {});
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      });
    }
  }
}

/**
 * Append a new network request entry to the live stream without full re-render.
 */
export function appendNetworkEntry(container, entry, number) {
  const entriesEl = container.querySelector('#dl-entries');
  if (!entriesEl) return;

  // Apply filter check before appending
  if (filterText) {
    const str = JSON.stringify(entry).toLowerCase();
    if (!str.includes(filterText.toLowerCase())) return;
  }

  // Remove empty state if present
  const emptyEl = entriesEl.querySelector('.tp-empty');
  if (emptyEl) emptyEl.remove();

  // Add new entry at top
  const html = renderNetworkStreamEntry(entry, number);
  entriesEl.insertAdjacentHTML('afterbegin', html);

  // Bind click on new entry
  const newEntry = entriesEl.firstElementChild;
  if (newEntry) {
    newEntry.addEventListener('click', (e) => {
      if (e.target.closest('.dl-copy-btn')) return;
      toggleEntry(newEntry);
    });
    const copyBtn = newEntry.querySelector('.dl-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const json = copyBtn.dataset.json;
        navigator.clipboard.writeText(json).catch(() => {});
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      });
    }
  }
}

function bindEntryClicks(container) {
  container.querySelectorAll('.tp-dl-entry').forEach((entry) => {
    entry.addEventListener('click', (e) => {
      if (e.target.closest('.dl-copy-btn')) return;
      toggleEntry(entry);
    });
    const copyBtn = entry.querySelector('.dl-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const json = copyBtn.dataset.json;
        navigator.clipboard.writeText(json).catch(() => {});
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1000);
      });
    }
  });
}

function toggleEntry(entryEl) {
  const id = entryEl.dataset.entryId;
  const detail = entryEl.querySelector('.tp-dl-detail');
  const chevron = entryEl.querySelector('.tp-chevron');
  if (detail) {
    const isHidden = detail.style.display === 'none';
    detail.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.classList.toggle('open', isHidden);
    if (isHidden) {
      expandedEntries.add(id);
    } else {
      expandedEntries.delete(id);
    }
  }
}

// ---- Entry Rendering ----

function renderStreamEntry(entry, number) {
  const data = extractData(entry);
  const info = classifyEvent(data);
  const time = formatTime(entry.timestamp);
  const isExpanded = expandedEntries.has(String(entry.id));

  let jsonStr;
  try {
    jsonStr = JSON.stringify(data, null, 2);
  } catch (e) {
    jsonStr = String(data);
  }

  // Build preview line (key properties shown collapsed)
  const preview = buildPreview(data, info);

  return `
    <div class="tp-dl-entry animate-slide-in" data-entry-id="${entry.id}">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
          <span style="
            font-size: 9px; color: var(--tp-text-muted);
            min-width: 22px; text-align: right;
          ">#${number}</span>
          <span style="font-size: 10px; color: var(--tp-text-muted); min-width: 52px;">${time}</span>
          <span style="
            display: inline-block; width: 6px; height: 6px; border-radius: 50;
            background: ${info.color}; flex-shrink: 0;
          "></span>
          <span style="
            font-size: 12px; font-weight: 600; color: ${info.color};
            white-space: nowrap;
          ">${escapeHtml(info.label)}</span>
          ${info.badge ? `<span style="
            font-size: 9px; padding: 1px 5px; border-radius: 3px;
            background: ${info.badgeBg}; color: ${info.badgeColor};
            white-space: nowrap;
          ">${info.badge}</span>` : ''}
        </div>
        <svg class="tp-chevron ${isExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      ${preview ? `<div style="
        font-size: 10px; color: var(--tp-text-muted);
        margin: 3px 0 0 84px; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      ">${escapeHtml(preview)}</div>` : ''}
      <div class="tp-dl-detail" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 8px;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
          <button class="dl-copy-btn" data-json="${escapeHtml(jsonStr)}" style="
            font-size: 10px; color: var(--tp-text-muted); background: var(--tp-surface);
            border: 1px solid var(--tp-border); border-radius: 4px;
            padding: 2px 8px; cursor: pointer;
          ">Copy</button>
        </div>
        <div class="code-block text-[10.5px]">${syntaxHighlight(jsonStr)}</div>
      </div>
    </div>
  `;
}

// ---- Event Classification ----

/**
 * Extract the actual data object from the entry (unwrap the args array).
 */
function extractData(entry) {
  const raw = entry.data;
  if (Array.isArray(raw) && raw.length === 1) return raw[0];
  if (Array.isArray(raw) && raw.length > 1) return raw;
  return raw;
}

/**
 * Classify an event and return label, color, and badge info.
 */
function classifyEvent(data) {
  if (!data) return { label: 'empty', color: 'var(--tp-text-muted)', category: 'unknown' };

  // String push (rare)
  if (typeof data === 'string') {
    return { label: data, color: 'var(--tp-text-secondary)', category: 'string' };
  }

  // gtag command-style push: {0: "consent", 1: "update", 2: {...}}
  // or {0: "set", 1: "developer_id.xxx", 2: true}
  if (data['0'] && typeof data['0'] === 'string') {
    const cmd = data['0'];
    const arg = data['1'] || '';
    if (cmd === 'consent') {
      return {
        label: `consent ${arg}`,
        color: '#E17055',
        category: 'consent',
        badge: 'gtag',
        badgeBg: 'rgba(225, 112, 85, 0.15)',
        badgeColor: '#E17055',
      };
    }
    if (cmd === 'set') {
      return {
        label: `set`,
        color: 'var(--tp-text-secondary)',
        category: 'config',
        badge: String(arg).length > 30 ? String(arg).slice(0, 30) + '...' : String(arg),
        badgeBg: 'rgba(155, 155, 174, 0.12)',
        badgeColor: 'var(--tp-text-muted)',
      };
    }
    if (cmd === 'config') {
      return {
        label: `config`,
        color: '#5B9BD5',
        category: 'config',
        badge: String(arg),
        badgeBg: 'rgba(91, 155, 213, 0.12)',
        badgeColor: '#5B9BD5',
      };
    }
    return {
      label: `${cmd}`,
      color: 'var(--tp-text-secondary)',
      category: 'command',
      badge: String(arg).length > 20 ? String(arg).slice(0, 20) + '...' : (arg || null),
      badgeBg: 'rgba(155, 155, 174, 0.12)',
      badgeColor: 'var(--tp-text-muted)',
    };
  }

  // Has event property — standard dataLayer push
  if (data.event) {
    const evt = data.event;

    // Ecommerce events
    const ecomEvents = [
      'view_item', 'view_item_list', 'add_to_cart', 'remove_from_cart',
      'begin_checkout', 'add_payment_info', 'add_shipping_info', 'purchase',
      'view_cart', 'select_item', 'select_promotion', 'view_promotion',
    ];
    if (ecomEvents.includes(evt) || data.ecommerce) {
      const itemCount = data.ecommerce?.items?.length;
      const value = data.ecommerce?.value;
      const currency = data.ecommerce?.currency;
      let badge = null;
      let badgeBg = 'rgba(0, 184, 148, 0.12)';
      let badgeColor = '#00B894';
      if (value != null && currency) {
        badge = `${currency} ${value}`;
      } else if (itemCount != null) {
        badge = `${itemCount} item${itemCount > 1 ? 's' : ''}`;
      }
      return {
        label: evt,
        color: '#00B894',
        category: 'ecommerce',
        badge,
        badgeBg,
        badgeColor,
      };
    }

    // Consent events
    if (evt.includes('consent') || evt === 'gtm.init_consent') {
      return {
        label: evt,
        color: '#E17055',
        category: 'consent',
        badge: 'consent',
        badgeBg: 'rgba(225, 112, 85, 0.15)',
        badgeColor: '#E17055',
      };
    }

    // GTM internal events
    if (evt.startsWith('gtm.')) {
      return {
        label: evt,
        color: 'var(--tp-text-muted)',
        category: 'gtm',
      };
    }

    // Page-level events
    if (evt === 'page_view' || evt === 'virtual_pageview' || evt === 'pageview') {
      return {
        label: evt,
        color: '#5B9BD5',
        category: 'page',
        badge: 'page',
        badgeBg: 'rgba(91, 155, 213, 0.12)',
        badgeColor: '#5B9BD5',
      };
    }

    // Custom/user events
    return {
      label: evt,
      color: 'var(--tp-text-secondary)',
      category: 'custom',
    };
  }

  // No event property — data-only push
  // Try to describe what's in it
  if (data.ecommerce === null) {
    return {
      label: 'ecommerce: null',
      color: 'var(--tp-text-muted)',
      category: 'reset',
      badge: 'reset',
      badgeBg: 'rgba(155, 155, 174, 0.12)',
      badgeColor: 'var(--tp-text-muted)',
    };
  }

  if (data.ecommerce) {
    return {
      label: 'ecommerce',
      color: '#00B894',
      category: 'ecommerce',
      badge: 'data',
      badgeBg: 'rgba(0, 184, 148, 0.12)',
      badgeColor: '#00B894',
    };
  }

  // Describe by top-level keys
  const keys = Object.keys(data).filter((k) => !k.startsWith('gtm.'));
  if (keys.length > 0) {
    const mainKey = keys[0];
    const extraCount = keys.length - 1;
    let label = mainKey;
    if (extraCount > 0) label += ` (+${extraCount})`;

    // Special cases
    if (keys.includes('user_data')) {
      return {
        label: 'user_data',
        color: '#A29BFE',
        category: 'user',
        badge: keys.length > 1 ? `+${keys.length - 1} keys` : null,
        badgeBg: 'rgba(162, 155, 254, 0.12)',
        badgeColor: '#A29BFE',
      };
    }

    return {
      label: label,
      color: 'var(--tp-text-secondary)',
      category: 'data',
    };
  }

  return { label: 'push', color: 'var(--tp-text-muted)', category: 'unknown' };
}

/**
 * Build a short preview string for collapsed entries.
 */
function buildPreview(data, info) {
  if (!data || typeof data !== 'object') return '';

  // Ecommerce events: show item name/value
  if (info.category === 'ecommerce' && data.ecommerce?.items?.[0]) {
    const item = data.ecommerce.items[0];
    const name = item.item_name || item.name || '';
    const price = item.price != null ? ` · ${item.price}` : '';
    return name + price;
  }

  // Context events
  if (data.context) {
    const ctx = data.context;
    const parts = [];
    if (ctx.page_type) parts.push(ctx.page_type);
    if (ctx.page_currency) parts.push(ctx.page_currency);
    if (ctx.page_country_code) parts.push(ctx.page_country_code);
    return parts.join(' · ');
  }

  // User data
  if (data.user_data) {
    const parts = [];
    if (data.page_type) parts.push(`page: ${data.page_type}`);
    if (data.user_data.new_customer != null) parts.push(`new: ${data.user_data.new_customer}`);
    return parts.join(' · ');
  }

  // Consent update
  if (info.category === 'consent' && data['2'] && typeof data['2'] === 'object') {
    const consent = data['2'];
    const granted = Object.values(consent).filter((v) => v === 'granted').length;
    const total = Object.keys(consent).length;
    return `${granted}/${total} granted`;
  }

  // Timer event
  if (data.event === 'gtm.timer') {
    const elapsed = data['gtm.timerElapsedTime'];
    if (elapsed) return `${Math.round(elapsed / 1000)}s elapsed`;
  }

  return '';
}

// ---- Network Request Entry Rendering ----

const PLATFORM_COLORS = {
  ga4: '#5B9BD5', meta: '#1877F2', tiktok: '#69C9D0',
  pinterest: '#E60023', snapchat: '#FFFC00', linkedin: '#0A66C2',
};
const PLATFORM_LABELS = {
  ga4: 'GA4', meta: 'Meta', tiktok: 'TikTok',
  pinterest: 'Pinterest', snapchat: 'Snap', linkedin: 'LinkedIn',
};

function renderNetworkStreamEntry(entry, number) {
  const time = formatTime(entry.timestamp);
  const isExpanded = expandedEntries.has(String(entry.id));

  const color = PLATFORM_COLORS[entry.platform] || '#F0932B';
  const platformLabel = PLATFORM_LABELS[entry.platform] || entry.platform;
  const eventLabel = entry.eventName || 'request';

  let detailObj = {
    platform: entry.platform,
    eventName: entry.eventName,
    method: entry.method,
    params: entry.params,
    items: entry.items,
    url: entry.url,
  };
  if (entry.measurementId) detailObj.measurementId = entry.measurementId;
  if (entry.pixelId) detailObj.pixelId = entry.pixelId;

  let jsonStr;
  try {
    jsonStr = JSON.stringify(detailObj, null, 2);
  } catch (e) {
    jsonStr = String(entry.url);
  }

  let urlPath = '';
  try { urlPath = new URL(entry.url).pathname.slice(0, 60); } catch (e) {}

  return `
    <div class="tp-dl-entry animate-slide-in" data-entry-id="${entry.id}" data-type="network" style="border-left: 2px solid #F0932B;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
          <span style="font-size: 9px; color: var(--tp-text-muted); min-width: 22px; text-align: right;">#${number}</span>
          <span style="font-size: 10px; color: var(--tp-text-muted); min-width: 52px;">${time}</span>
          <span style="
            display: inline-block; font-size: 8px; padding: 1px 4px; border-radius: 3px;
            background: rgba(240, 147, 43, 0.2); color: #F0932B; font-weight: 700;
            letter-spacing: 0.5px;
          ">NET</span>
          <span style="font-size: 12px; font-weight: 600; color: ${color}; white-space: nowrap;">
            ${escapeHtml(eventLabel)}
          </span>
          <span style="
            font-size: 9px; padding: 1px 5px; border-radius: 3px;
            background: rgba(91, 155, 213, 0.12);
            color: ${color}; white-space: nowrap;
          ">${platformLabel}</span>
        </div>
        <svg class="tp-chevron ${isExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div style="
        font-size: 10px; color: var(--tp-text-muted);
        margin: 3px 0 0 84px; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      ">${entry.method} ${escapeHtml(urlPath)}</div>
      <div class="tp-dl-detail" style="display: ${isExpanded ? 'block' : 'none'}; margin-top: 8px;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
          <button class="dl-copy-btn" data-json="${escapeHtml(jsonStr)}" style="
            font-size: 10px; color: var(--tp-text-muted); background: var(--tp-surface);
            border: 1px solid var(--tp-border); border-radius: 4px;
            padding: 2px 8px; cursor: pointer;
          ">Copy</button>
        </div>
        <div class="code-block text-[10.5px]">${syntaxHighlight(jsonStr)}</div>
      </div>
    </div>
  `;
}
