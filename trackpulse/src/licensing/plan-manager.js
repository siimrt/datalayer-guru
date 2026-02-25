/**
 * Core Plan/License Management — uses ExtensionPay for payment processing.
 * This is the central module. Every feature check goes through here.
 */

import ExtPay from 'extpay';
import { PLANS, PLAN_ID_MAP, resolvePlanFromId } from '../shared/plans.js';

const extpay = ExtPay('datalayer-guru');

class PlanManager {
  constructor() {
    this.currentPlan = 'free';
    this.user = null;
    this.listeners = new Set();
    this._initialized = false;
    this._initPromise = null;
    this._storedPlan = null; // Plan stored locally when user clicks CTA (ExtensionPay doesn't return planId)
  }

  /**
   * Initialize ExtensionPay and load user state.
   * Call this ONCE in the service worker on extension startup.
   * Returns a promise that resolves when init is complete.
   */
  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      // ExtensionPay background setup
      extpay.startBackground();

      // Load locally stored plan selection (ExtensionPay doesn't return planId)
      const stored = await chrome.storage.local.get('tp_selected_plan');
      this._storedPlan = stored.tp_selected_plan || null;

      // Get current user
      this.user = await extpay.getUser();
      console.log('[Traacky] ExtPay user:', JSON.stringify(this.user));
      this._resolvePlan();
      console.log('[Traacky] Resolved plan:', this.currentPlan);

      // Listen for payment events
      extpay.onPaid.addListener((user) => {
        console.log('[Traacky] onPaid fired:', JSON.stringify(user));
        this.user = user;
        this._resolvePlan();
        console.log('[Traacky] Plan after payment:', this.currentPlan);
        this._persistPlanCache();
        this._notifyListeners();
        this._broadcastPlanChanged();
      });

      // Cache plan in chrome.storage for quick access
      await this._persistPlanCache();

      this._initialized = true;
    } catch (err) {
      console.error('[Traacky] ExtensionPay init error:', err);
      // Fallback to cached plan
      await this._loadCachedPlan();
      this._initialized = true; // Mark as initialized even on error to avoid retry loops
    }
  }

  /**
   * Resolve the internal plan name from ExtensionPay user data.
   *
   * ExtensionPay user object shape:
   *   { paid: boolean, paidAt: Date|null, email: string,
   *     installedAt: Date, trialStartedAt: Date|null,
   *     subscriptionPlanId?: string, subscriptionStatus?: string }
   *
   * If the user has paid but we can't determine a specific plan from the planId,
   * we default to 'starter' (the lowest paid tier) to be safe.
   */
  _resolvePlan() {
    if (!this.user) {
      this.currentPlan = 'free';
      return;
    }

    // Log ALL user properties for debugging
    console.log('[Traacky] _resolvePlan user keys:', Object.keys(this.user));
    console.log('[Traacky] user.paid:', this.user.paid, typeof this.user.paid);
    console.log('[Traacky] user.subscriptionStatus:', this.user.subscriptionStatus);
    console.log('[Traacky] user.paidAt:', this.user.paidAt);

    // Multiple ways to detect paid status:
    // 1. user.paid === true (standard ExtensionPay)
    // 2. user.subscriptionStatus === 'active' (active subscription)
    // 3. user.paidAt is truthy (has a payment date)
    const isPaid = !!this.user.paid
      || this.user.subscriptionStatus === 'active'
      || !!this.user.paidAt;

    console.log('[Traacky] isPaid resolved to:', isPaid);

    if (!isPaid) {
      this.currentPlan = 'free';
      return;
    }

    // User has paid — determine which plan
    // Try multiple possible property names from ExtensionPay
    const planId = this.user.subscriptionPlanId
      || this.user.planId
      || this.user.plan_id
      || this.user.subscription_plan_id
      || '';

    console.log('[Traacky] User isPaid=true, planId="' + planId + '"');

    const resolved = resolvePlanFromId(planId);
    if (resolved) {
      this.currentPlan = resolved;
    } else if (this._storedPlan) {
      // ExtensionPay doesn't return planId — use locally stored selection from checkout
      console.log('[Traacky] Using stored plan selection:', this._storedPlan);
      this.currentPlan = this._storedPlan;
    } else {
      // Paid but no recognizable plan ID and no stored selection — default to 'starter'
      this.currentPlan = 'starter';
    }
  }

  /**
   * Cache plan in chrome.storage.local for fast access across contexts.
   */
  async _persistPlanCache() {
    const data = {
      tp_plan: this.currentPlan,
      tp_plan_updated: Date.now(),
      tp_user_email: this.user?.email || null,
      tp_paid: !!this.user?.paid,
    };
    console.log('[Traacky] Persisting plan cache:', JSON.stringify(data));
    await chrome.storage.local.set(data);
  }

  /**
   * Load cached plan (used as fallback when ExtensionPay is unreachable).
   */
  async _loadCachedPlan() {
    const data = await chrome.storage.local.get(['tp_plan', 'tp_plan_updated']);
    if (data.tp_plan) {
      this.currentPlan = data.tp_plan;
      console.log('[Traacky] Loaded cached plan:', this.currentPlan);
      // If cache is older than 24h, try to refresh
      if (Date.now() - (data.tp_plan_updated || 0) > 86400000) {
        this.refreshPlan();
      }
    }
  }

  /**
   * Force refresh plan status from ExtensionPay.
   * Returns the resolved plan name.
   */
  async refreshPlan() {
    try {
      // Reload stored plan selection in case it was updated
      const stored = await chrome.storage.local.get('tp_selected_plan');
      this._storedPlan = stored.tp_selected_plan || this._storedPlan;

      this.user = await extpay.getUser();
      console.log('[Traacky] Refresh - ExtPay user:', JSON.stringify(this.user));
      this._resolvePlan();
      console.log('[Traacky] Refresh - resolved plan:', this.currentPlan);
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
      // Service worker may have restarted — re-initialize
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
