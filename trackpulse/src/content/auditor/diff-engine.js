/**
 * Diff Engine — Compares expected events (from generators) with actual events (from dataLayer).
 * Performs deep field-by-field comparison.
 */

// GA4 ecommerce events that should have items[] and standard structure
const ECOMMERCE_EVENTS = new Set([
  'view_item', 'view_item_list', 'select_item',
  'add_to_cart', 'remove_from_cart', 'view_cart',
  'begin_checkout', 'add_shipping_info', 'add_payment_info',
  'purchase', 'refund',
]);

// Lead gen events (simpler structure, no items[] required)
const LEADGEN_EVENTS = new Set([
  'generate_lead', 'sign_up', 'contact', 'form_submit', 'form_start',
  'schedule', 'book_appointment', 'request_quote', 'qualify_lead',
]);

// Required ecommerce fields per event type
const EVENT_REQUIRED_FIELDS = {
  view_item: ['items'],
  view_item_list: ['items'],
  select_item: ['items'],
  add_to_cart: ['items'],
  remove_from_cart: ['items'],
  view_cart: ['items'],
  begin_checkout: ['items'],
  add_shipping_info: ['items'],
  add_payment_info: ['items'],
  purchase: ['transaction_id', 'items'],
  refund: ['transaction_id'],
};

export class DiffEngine {
  /**
   * Compare all generated events against actual dataLayer events.
   * Also auto-audit ecommerce events found in the dataLayer that have no
   * matching expected event (e.g. add_to_cart found on a Product page).
   *
   * @param {Array} expectedEvents - Generated events from generators
   * @param {Array} actualEvents - Events extracted from dataLayer
   * @returns {Array<DiffResult>}
   */
  compareAll(expectedEvents, actualEvents) {
    const results = expectedEvents.map((expected) => {
      const actual = this._findBestMatch(expected, actualEvents);
      if (!actual) {
        return {
          expected,
          actual: null,
          status: 'missing',
          fields: [],
          matchPercentage: 0,
        };
      }
      return this.compare(expected, actual);
    });

    // Auto-audit additional ecommerce events not covered by expected events
    const coveredEventNames = new Set(expectedEvents.map((e) => e.eventName || e.data?.event));
    for (const actual of actualEvents) {
      const eventName = actual.event || actual.data?.event;
      if (!eventName || coveredEventNames.has(eventName)) continue;
      if (!ECOMMERCE_EVENTS.has(eventName)) continue;
      if (!actual.hasEcommerce && !actual.data?.ecommerce) continue;

      // Self-audit: validate ecommerce structure
      const auditResult = this._selfAudit(eventName, actual);
      if (auditResult) results.push(auditResult);
    }

    return results;
  }

  /**
   * Self-audit an ecommerce event against GA4 standard structure.
   * No "expected" template needed — validates based on GA4 spec.
   */
  _selfAudit(eventName, actual) {
    const data = actual.data || actual;
    const ecom = data.ecommerce || {};
    const fields = [];

    // Check required fields
    const required = EVENT_REQUIRED_FIELDS[eventName] || ['items'];
    for (const field of required) {
      const val = ecom[field];
      if (field === 'items') {
        if (Array.isArray(val) && val.length > 0) {
          fields.push({ path: `ecommerce.items`, expected: '(array)', actual: `${val.length} item(s)`, status: 'match' });
          // Validate item structure
          this._auditItems(val, fields);
        } else {
          fields.push({ path: `ecommerce.items`, expected: '(array)', actual: undefined, status: 'missing' });
        }
      } else {
        if (val != null) {
          fields.push({ path: `ecommerce.${field}`, expected: field, actual: val, status: 'match' });
        } else {
          fields.push({ path: `ecommerce.${field}`, expected: field, actual: undefined, status: 'missing' });
        }
      }
    }

    // Check currency & value (recommended)
    if (ecom.currency) {
      fields.push({ path: 'ecommerce.currency', expected: 'currency', actual: ecom.currency, status: 'match' });
    } else {
      fields.push({ path: 'ecommerce.currency', expected: 'currency', actual: undefined, status: 'recommended' });
    }
    if (ecom.value != null) {
      fields.push({ path: 'ecommerce.value', expected: 'value', actual: ecom.value, status: 'match' });
    } else {
      fields.push({ path: 'ecommerce.value', expected: 'value', actual: undefined, status: 'recommended' });
    }

    const scoredFields = fields.filter((f) => f.status !== 'recommended');
    const totalFields = scoredFields.length;
    const matchedFields = scoredFields.filter((f) => f.status === 'match').length;
    const matchPercentage = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 100;

    return {
      expected: { eventName, data, pageType: 'auto' },
      actual,
      status: matchPercentage === 100 ? 'match' : matchPercentage > 0 ? 'partial' : 'missing',
      fields,
      matchPercentage,
    };
  }

  /**
   * Validate items array structure for GA4 compliance.
   */
  _auditItems(items, fields) {
    const REQUIRED_ITEM_FIELDS = ['item_id', 'item_name'];
    const RECOMMENDED_ITEM_FIELDS = ['price'];
    const ITEM_ALIASES = { item_id: 'id', item_name: 'name' };

    for (let i = 0; i < Math.min(items.length, 3); i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') continue;

      for (const field of REQUIRED_ITEM_FIELDS) {
        const val = item[field] || item[ITEM_ALIASES[field]];
        if (val != null) {
          fields.push({ path: `ecommerce.items[${i}].${field}`, expected: field, actual: val, status: 'match' });
        } else {
          fields.push({ path: `ecommerce.items[${i}].${field}`, expected: field, actual: undefined, status: 'missing' });
        }
      }
      for (const field of RECOMMENDED_ITEM_FIELDS) {
        const val = item[field];
        if (val != null) {
          fields.push({ path: `ecommerce.items[${i}].${field}`, expected: field, actual: val, status: 'match' });
        }
      }
    }
  }

  /**
   * Compare a single expected event with an actual dataLayer event.
   *
   * @param {Object} expected - Generated event
   * @param {Object} actual - Actual dataLayer event
   * @returns {DiffResult}
   */
  compare(expected, actual) {
    if (!actual || !actual.data) {
      return {
        expected,
        actual: null,
        status: 'missing',
        fields: [],
        matchPercentage: 0,
      };
    }

    const expectedData = expected.data || {};
    const actualData = actual.data || actual;

    const fields = [];
    this._deepCompare(expectedData, actualData, '', fields);

    // Fields that are recommended but should not penalize the match score when missing
    const OPTIONAL_ECOMMERCE_PATHS = new Set([
      'ecommerce.currency', 'ecommerce.value',
    ]);

    // Calculate match percentage — exclude optional/info fields from penalty
    const scoredFields = fields.filter((f) =>
      !(f.status === 'missing' && OPTIONAL_ECOMMERCE_PATHS.has(f.path)) &&
      f.status !== 'info'
    );
    const totalFields = scoredFields.length;
    const matchedFields = scoredFields.filter((f) => f.status === 'match').length;
    const matchPercentage =
      totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;

    // Mark optional missing fields as 'recommended' instead of 'missing'
    for (const f of fields) {
      if (f.status === 'missing' && OPTIONAL_ECOMMERCE_PATHS.has(f.path)) {
        f.status = 'recommended';
      }
    }

    let status;
    if (matchPercentage === 100) {
      status = 'match';
    } else if (matchPercentage > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    return {
      expected,
      actual,
      status,
      fields,
      matchPercentage,
    };
  }

  /**
   * Deep compare two objects/values and record field diffs.
   */
  _deepCompare(expected, actual, path, fields) {
    if (expected === null || expected === undefined) return;

    // Handle primitive values
    if (typeof expected !== 'object') {
      const actualVal = actual;
      if (actualVal === expected) {
        fields.push({ path: path || 'value', expected, actual: actualVal, status: 'match' });
      } else if (actualVal === null || actualVal === undefined) {
        fields.push({ path: path || 'value', expected, actual: undefined, status: 'missing' });
      } else {
        fields.push({ path: path || 'value', expected, actual: actualVal, status: 'mismatch' });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        fields.push({ path, expected: '(array)', actual: actual, status: 'mismatch' });
        return;
      }

      // For items arrays, try to match by item_id or item_name
      if (this._isItemsArray(expected)) {
        this._compareItemsArrays(expected, actual, path, fields);
        return;
      }

      // Simple array comparison
      for (let i = 0; i < expected.length; i++) {
        const itemPath = `${path}[${i}]`;
        if (i < actual.length) {
          this._deepCompare(expected[i], actual[i], itemPath, fields);
        } else {
          fields.push({
            path: itemPath,
            expected: expected[i],
            actual: undefined,
            status: 'missing',
          });
        }
      }

      // Check for extra items in actual
      for (let i = expected.length; i < actual.length; i++) {
        fields.push({
          path: `${path}[${i}]`,
          expected: undefined,
          actual: actual[i],
          status: 'extra',
        });
      }
      return;
    }

    // Handle objects
    if (typeof expected === 'object' && expected !== null) {
      const actualObj = (typeof actual === 'object' && actual !== null) ? actual : {};

      // Compare expected keys
      for (const [key, value] of Object.entries(expected)) {
        const fieldPath = path ? `${path}.${key}` : key;

        if (key in actualObj) {
          this._deepCompare(value, actualObj[key], fieldPath, fields);
        } else {
          // Key missing in actual — add as missing
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Recurse into nested objects to get individual field misses
            this._deepCompare(value, {}, fieldPath, fields);
          } else {
            fields.push({
              path: fieldPath,
              expected: value,
              actual: undefined,
              status: 'missing',
            });
          }
        }
      }

      // Check for extra keys in actual (only top-level ecommerce keys)
      for (const key of Object.keys(actualObj)) {
        if (!(key in expected)) {
          const fieldPath = path ? `${path}.${key}` : key;
          fields.push({
            path: fieldPath,
            expected: undefined,
            actual: actualObj[key],
            status: 'extra',
          });
        }
      }
    }
  }

  /**
   * Check if an array looks like an items[] array (has item_id or item_name keys).
   */
  _isItemsArray(arr) {
    return (
      arr.length > 0 &&
      typeof arr[0] === 'object' &&
      arr[0] !== null &&
      ('item_id' in arr[0] || 'item_name' in arr[0])
    );
  }

  /**
   * Compare items arrays by matching on item_id or item_name.
   */
  _compareItemsArrays(expected, actual, path, fields) {
    for (let i = 0; i < expected.length; i++) {
      const expectedItem = expected[i];
      const itemPath = `${path}[${i}]`;

      // Try to find matching actual item by item_id or item_name
      const actualItem = this._findMatchingItem(expectedItem, actual);

      if (actualItem) {
        // How was this item matched? By ID or by name fallback?
        const matchedById = expectedItem.item_id && (
          String(actualItem.item_id) === String(expectedItem.item_id) ||
          String(actualItem.id) === String(expectedItem.item_id)
        );

        // GA4-to-Shopify field aliases (expected key -> alternative actual key)
        const ITEM_ALIASES = {
          item_id: 'id', item_name: 'name', item_brand: 'brand',
          item_category: 'category', item_variant: 'variant',
        };

        // Fields that are auto-generated and rarely present in actual implementations
        const OPTIONAL_ITEM_FIELDS = new Set(['index']);

        // Compare matched items field by field
        for (const [key, value] of Object.entries(expectedItem)) {
          const fieldPath = `${itemPath}.${key}`;
          if (value == null) continue;

          // Check direct key, then alias
          const alias = ITEM_ALIASES[key];
          const actualVal = (key in actualItem) ? actualItem[key]
            : (alias && alias in actualItem) ? actualItem[alias]
            : undefined;

          if (actualVal !== undefined) {
            if (this._valuesMatch(value, actualVal)) {
              fields.push({ path: fieldPath, expected: value, actual: actualVal, status: 'match' });
            } else {
              // item_id mismatch when matched by name: downgrade to 'info' (product vs variant ID)
              if (key === 'item_id' && !matchedById) {
                fields.push({ path: fieldPath, expected: value, actual: actualVal, status: 'info' });
              } else {
                fields.push({ path: fieldPath, expected: value, actual: actualVal, status: 'mismatch' });
              }
            }
          } else {
            // Skip optional fields that are rarely in actual implementations
            if (!OPTIONAL_ITEM_FIELDS.has(key)) {
              fields.push({ path: fieldPath, expected: value, actual: undefined, status: 'missing' });
            }
          }
        }
      } else {
        // No matching item found
        fields.push({
          path: itemPath,
          expected: expectedItem,
          actual: undefined,
          status: 'missing',
        });
      }
    }
  }

  /**
   * Find a matching item in the actual array by item_id or item_name.
   */
  _findMatchingItem(expectedItem, actualArray) {
    if (!Array.isArray(actualArray)) return null;

    // Try matching by item_id first (also check 'id' — Shopify/gtag shorthand)
    if (expectedItem.item_id) {
      const expectedId = String(expectedItem.item_id);
      const match = actualArray.find(
        (a) => a && (String(a.item_id) === expectedId || String(a.id) === expectedId)
      );
      if (match) return match;
    }

    // Then by item_name (also check 'name' — Shopify/gtag shorthand)
    if (expectedItem.item_name) {
      const expectedName = expectedItem.item_name.toLowerCase();
      const match = actualArray.find(
        (a) => a && (
          (a.item_name && a.item_name.toLowerCase() === expectedName) ||
          (a.name && a.name.toLowerCase() === expectedName)
        )
      );
      if (match) return match;
    }

    // Try partial item_name match (contains) — handles truncated or reformatted names
    if (expectedItem.item_name) {
      const expectedName = expectedItem.item_name.toLowerCase();
      const match = actualArray.find(
        (a) => a && (
          (a.item_name && (a.item_name.toLowerCase().includes(expectedName) || expectedName.includes(a.item_name.toLowerCase()))) ||
          (a.name && (a.name.toLowerCase().includes(expectedName) || expectedName.includes(a.name.toLowerCase())))
        )
      );
      if (match) return match;
    }

    // Fallback: match by index 0 if only one item in each
    if (actualArray.length === 1) return actualArray[0];

    return null;
  }

  /**
   * Compare two values, with tolerance for numeric/string mismatches.
   */
  _valuesMatch(expected, actual) {
    if (expected === actual) return true;
    // Numeric comparison with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      return Math.abs(expected - actual) < 0.01;
    }
    // String comparison (case-insensitive for names)
    if (typeof expected === 'string' && typeof actual === 'string') {
      return expected.toLowerCase() === actual.toLowerCase();
    }
    // Number vs string comparison
    if (typeof expected === 'number' && typeof actual === 'string') {
      return Math.abs(expected - parseFloat(actual)) < 0.01;
    }
    if (typeof expected === 'string' && typeof actual === 'number') {
      return Math.abs(parseFloat(expected) - actual) < 0.01;
    }
    return false;
  }

  /**
   * Find the best matching actual event for an expected event.
   */
  _findBestMatch(expected, actualEvents) {
    const eventName = expected.eventName || expected.data?.event;
    if (!eventName) return null;

    // First try exact event name match
    const nameMatches = actualEvents.filter(
      (a) => a.event === eventName || a.data?.event === eventName
    );

    if (nameMatches.length === 0) return null;
    if (nameMatches.length === 1) return nameMatches[0];

    // If multiple matches, return the one with the most ecommerce data
    return nameMatches.reduce((best, current) => {
      const bestKeys = Object.keys(best.data?.ecommerce || {}).length;
      const currentKeys = Object.keys(current.data?.ecommerce || {}).length;
      return currentKeys > bestKeys ? current : best;
    });
  }
}
