/**
 * Diff Engine — Compares expected events (from generators) with actual events (from dataLayer).
 * Performs deep field-by-field comparison.
 */

export class DiffEngine {
  /**
   * Compare all generated events against actual dataLayer events.
   *
   * @param {Array} expectedEvents - Generated events from generators
   * @param {Array} actualEvents - Events extracted from dataLayer
   * @returns {Array<DiffResult>}
   */
  compareAll(expectedEvents, actualEvents) {
    return expectedEvents.map((expected) => {
      // Find the best matching actual event
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

    // Calculate match percentage
    const totalFields = fields.length;
    const matchedFields = fields.filter((f) => f.status === 'match').length;
    const matchPercentage =
      totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;

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
        // Compare matched items field by field
        for (const [key, value] of Object.entries(expectedItem)) {
          const fieldPath = `${itemPath}.${key}`;
          if (value == null) continue;

          if (key in actualItem) {
            if (this._valuesMatch(value, actualItem[key])) {
              fields.push({ path: fieldPath, expected: value, actual: actualItem[key], status: 'match' });
            } else {
              fields.push({ path: fieldPath, expected: value, actual: actualItem[key], status: 'mismatch' });
            }
          } else {
            fields.push({ path: fieldPath, expected: value, actual: undefined, status: 'missing' });
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

    // Try matching by item_id first
    if (expectedItem.item_id) {
      const match = actualArray.find(
        (a) => a && String(a.item_id) === String(expectedItem.item_id)
      );
      if (match) return match;
    }

    // Then by item_name
    if (expectedItem.item_name) {
      const match = actualArray.find(
        (a) =>
          a &&
          a.item_name &&
          a.item_name.toLowerCase() === expectedItem.item_name.toLowerCase()
      );
      if (match) return match;
    }

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
