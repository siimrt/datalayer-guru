/**
 * Core Plan/License Management — uses ExtensionPay for payment processing.
 * This is the central module. Every feature check goes through here.
 */

import ExtPay from 'extpay';
import { PLANS, PLAN_ID_MAP, VALID_PLANS, resolvePlanFromId } from '../shared/plans.js';
import { computePlanSignature, verifyPlanSignature } from '../shared/crypto.js';

const extpay = ExtPay('datalayer-guru');

// --- Dev-only logging ---
let _isDevMode = null;
function isDevMode() {
  if (_isDevMode === null) {
    try { _isDevMode = !chrome.runtime.getManifest().update_url; }
    catch (e) { _isDevMode = false; }
  }
  return _isDevMode;
}
const _log = (...args) => { if (isDevMode()) console.log('[Traacky]', ...args); };

// --- Plan Manager ---

class PlanManager {
  constructor() {
    this.currentPlan = 'free';
    this.user = null;
    this.listeners = new Set();
    this._initialized = false;
    this._initPromise = null;
    this._storedPlan = null;
    this._lastPlanChange = 0;
  }

  /**
   * Validate a plan value against the whitelist. Returns 'free' for invalid values.
   */
  _validatePlan(plan) {
    return VALID_PLANS.has(plan) ? plan : 'free';
  }

  /**
   * Initialize ExtensionPay and load user state.
   * Call this ONCE in the service worker on extension startup.
   */
  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      extpay.startBackground();

      // Load locally stored plan selection — sync first, fallback local
      let stored;
      try {
        stored = await chrome.storage.sync.get('tp_selected_plan');
      } catch (e) {
        _log('sync read failed:', e.message);
      }
      if (!stored?.tp_selected_plan) {
        stored = await chrome.storage.local.get('tp_selected_plan');
      }
      this._storedPlan = this._validatePlan(stored.tp_selected_plan || 'free') === 'free'
        ? null
        : stored.tp_selected_plan;

      // Get current user
      this.user = await extpay.getUser();
      _log('ExtPay user loaded');
      this._resolvePlan();
      _log('Resolved plan:', this.currentPlan);

      // Listen for payment events
      extpay.onPaid.addListener((user) => {
        _log('onPaid fired');
        this.user = user;
        this._resolvePlan();
        this._persistPlanCache();
        this._notifyListeners();
        this._broadcastPlanChanged();
      });

      // Listen for sync changes — don't trust the value, re-verify with ExtensionPay (Fix 2)
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        if (changes.tp_plan && changes.tp_plan.newValue !== this.currentPlan) {
          _log('Sync plan change detected — triggering refresh');
          this.refreshPlan();
        }
      });

      // Cache plan in chrome.storage for quick access
      await this._persistPlanCache();

      this._initialized = true;
    } catch (err) {
      console.error('[Traacky] ExtensionPay init error:', err);
      await this._loadCachedPlan();
      this._initialized = true;
    }
  }

  /**
   * Resolve the internal plan name from ExtensionPay user data.
   */
  _resolvePlan() {
    if (!this.user) {
      this.currentPlan = 'free';
      return;
    }

    const isPaid = !!this.user.paid
      || this.user.subscriptionStatus === 'active'
      || !!this.user.paidAt;

    if (!isPaid) {
      this.currentPlan = 'free';
      return;
    }

    // User has paid — determine which plan
    const planId = this.user.subscriptionPlanId
      || this.user.planId
      || this.user.plan_id
      || this.user.subscription_plan_id
      || '';

    const resolved = resolvePlanFromId(planId);
    if (resolved) {
      this.currentPlan = this._validatePlan(resolved);
    } else if (this._storedPlan && isPaid) {
      // Only use stored plan selection if user actually paid (Fix 4)
      this.currentPlan = this._validatePlan(this._storedPlan);
    } else {
      // Paid but no recognizable plan ID and no stored selection — default to 'starter'
      this.currentPlan = 'starter';
    }
  }

  /**
   * Cache plan in chrome.storage.local with HMAC signature (Fix 3).
   */
  async _persistPlanCache() {
    const email = this.user?.email || null;
    const sig = await computePlanSignature(this.currentPlan, email);

    const data = {
      tp_plan: this.currentPlan,
      tp_plan_updated: Date.now(),
      tp_user_email: email,
      tp_paid: !!this.user?.paid,
      tp_plan_sig: sig,
    };
    _log('Persisting signed plan cache');
    await chrome.storage.local.set(data);
    // Dual-write to sync for cross-browser/cross-device sync
    try {
      await chrome.storage.sync.set(data);
    } catch (err) {
      _log('sync write failed:', err.message);
    }
  }

  /**
   * Load cached plan (used as fallback when ExtensionPay is unreachable).
   * Verifies HMAC signature before trusting cached value (Fix 3).
   */
  async _loadCachedPlan() {
    const data = await chrome.storage.local.get([
      'tp_plan', 'tp_plan_updated', 'tp_user_email', 'tp_plan_sig',
    ]);

    if (data.tp_plan) {
      const validated = this._validatePlan(data.tp_plan);

      // Verify signature — reject tampered cache
      const sigValid = await verifyPlanSignature(validated, data.tp_user_email, data.tp_plan_sig);
      if (!sigValid) {
        _log('Plan cache signature invalid — falling back to free');
        this.currentPlan = 'free';
        return;
      }

      this.currentPlan = validated;
      _log('Loaded verified cached plan:', this.currentPlan);

      // If cache is older than 1h, try to refresh (Fix 6 — reduced from 24h)
      if (Date.now() - (data.tp_plan_updated || 0) > 3600000) {
        this.refreshPlan();
      }
    }
  }

  /**
   * Force refresh plan status from ExtensionPay.
   */
  async refreshPlan() {
    // Rate-limit: max once per 30 seconds (Fix 8)
    if (this._lastPlanChange && Date.now() - this._lastPlanChange < 30000) {
      _log('Refresh rate-limited');
      return this.currentPlan;
    }
    this._lastPlanChange = Date.now();

    try {
      // Reload stored plan selection
      let stored;
      try {
        stored = await chrome.storage.sync.get('tp_selected_plan');
      } catch (e) { /* sync unavailable */ }
      if (!stored?.tp_selected_plan) {
        stored = await chrome.storage.local.get('tp_selected_plan');
      }
      const storedVal = stored.tp_selected_plan || null;
      this._storedPlan = storedVal && this._validatePlan(storedVal) !== 'free' ? storedVal : this._storedPlan;

      this.user = await extpay.getUser();
      _log('Refresh - user loaded');
      this._resolvePlan();
      _log('Refresh - resolved plan:', this.currentPlan);
      await this._persistPlanCache();
      this._notifyListeners();
      this._broadcastPlanChanged();
      return this.currentPlan;
    } catch (e) {
      console.error('[Traacky] Refresh failed:', e);
      return this.currentPlan;
    }
  }

  /**
   * Wait for initialization to complete, then return plan.
   */
  async waitForInit() {
    if (!this._initPromise && !this._initialized) {
      this.init();
    }
    if (this._initPromise) {
      await this._initPromise;
    }
    return this.currentPlan;
  }

  /**
   * Check if the current plan meets the minimum required plan.
   */
  hasAccess(minimumPlan) {
    return PLANS[this.currentPlan] >= PLANS[minimumPlan];
  }

  /**
   * Get the current plan name.
   */
  getPlan() {
    return this.currentPlan;
  }

  /**
   * Open the ExtensionPay payment page.
   */
  openPaymentPage(planNickname) {
    if (planNickname) {
      extpay.openPaymentPage(planNickname);
    } else {
      extpay.openPaymentPage();
    }
  }

  /**
   * Open the ExtensionPay management page.
   */
  openManagementPage() {
    extpay.openPaymentPage();
  }

  /**
   * Open the ExtensionPay login page (for restoring license on another browser/device).
   */
  openLoginPage() {
    extpay.openLoginPage();
  }

  /**
   * Subscribe to plan changes.
   */
  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentPlan));
  }

  _broadcastPlanChanged() {
    chrome.runtime.sendMessage({
      type: 'TRACKPULSE_PLAN_CHANGED',
      payload: { plan: this.currentPlan },
    }).catch(() => {}); // Ignore if no listeners
  }
}

// Singleton
export const planManager = new PlanManager();
export { extpay };
