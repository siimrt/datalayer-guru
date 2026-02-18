/**
 * Safely parse a JSON string, returning null on failure.
 */
export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Deep clone an object safely (handles circular refs by dropping them).
 */
export function safeClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

/**
 * Format a price with currency.
 */
export function formatPrice(price, currency = 'USD') {
  if (price == null || isNaN(price)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

/**
 * Clean and normalize a price string to a number.
 */
export function parsePrice(priceStr) {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  // Remove currency symbols and thousand separators, normalize decimal
  const cleaned = String(priceStr)
    .replace(/[^\d.,\-]/g, '')
    .replace(/\.(?=.*\.)/g, '') // Remove all dots except the last
    .replace(/,(?=\d{3}(?:[.,]|$))/g, '') // Remove comma thousands
    .replace(/,/g, '.'); // Treat remaining comma as decimal
  return parseFloat(cleaned) || 0;
}

/**
 * Truncate a string to a max length.
 */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

/**
 * Get a nested property from an object by dot-path string.
 */
export function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    // Handle array index notation like items[0]
    const match = key.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      return acc[match[1]]?.[parseInt(match[2])];
    }
    return acc[key];
  }, obj);
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Format a timestamp to HH:MM:SS.
 */
export function formatTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Generate a simple unique ID.
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Check if a cookie exists (prefix match).
 */
export function cookieExists(name) {
  return document.cookie.split(';').some((c) => c.trim().startsWith(name));
}

/**
 * Get all cookies as an object.
 */
export function getCookies() {
  const cookies = {};
  document.cookie.split(';').forEach((c) => {
    const [key, ...val] = c.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

/**
 * Safely query the DOM, returning null instead of throwing.
 */
export function safeQuerySelector(selector) {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Safely query all matching DOM elements.
 */
export function safeQuerySelectorAll(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * Escape HTML for safe rendering.
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Basic syntax highlighting for JSON/JS code blocks.
 * Returns HTML string with span classes for coloring.
 */
export function syntaxHighlight(code) {
  if (!code) return '';
  let html = escapeHtml(code);
  // Strings (double-quoted)
  html = html.replace(
    /(&quot;|")(.*?)(\1)/g,
    '<span class="syn-string">$1$2$3</span>'
  );
  // Strings (single-quoted)
  html = html.replace(
    /('(?:[^'\\]|\\.)*')/g,
    '<span class="syn-string">$1</span>'
  );
  // Numbers
  html = html.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="syn-number">$1</span>'
  );
  // Booleans and null
  html = html.replace(
    /\b(true|false|null|undefined)\b/g,
    '<span class="syn-keyword">$1</span>'
  );
  // Known function calls
  html = html.replace(
    /\b(dataLayer\.push|fbq|ttq\.track|pintrk)\b/g,
    '<span class="syn-function">$1</span>'
  );
  // Known keys before colons (e.g., event:, ecommerce:)
  html = html.replace(
    /^(\s*)(\w+)(\s*:)/gm,
    '$1<span class="syn-key">$2</span>$3'
  );
  return html;
}
