/**
 * Core Plan/License Management — uses ExtensionPay for payment processing.
 * This is the central module. Every feature check goes through here.
 */

import ExtPay from 'extpay';
import { PLANS, PLAN_ID_MAP } from '../shared/plans.js';

const extpay = ExtPay('datalayer-guru');

class PlanManager {
  constructor() {
    this.currentPlan = 'free';
    this.user = null;
    this.listeners = new Set();
    this._initialized = false;
    this._initPromise = null;
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

      // Get current user
      this.user = await extpay.getUser();
      console.log('[TrackPulse] ExtPay user:', JSON.stringify(this.user));
      this._resolvePlan();
      console.log('[TrackPulse] Resolved plan:', this.currentPlan);

      // Listen for payment events
      extpay.onPaid.addListener((user) => {
        console.log('[TrackPulse] onPaid fired:', JSON.stringify(user));
        this.user = user;
        this._resolvePlan();
        console.log('[TrackPulse] Plan after payment:', this.currentPlan);
        this._persistPlanCache();
        this._notifyListeners();
      });

      // Cache plan in chrome.storage for quick access
      await this._persistPlanCache();

      this._initialized = true;
    } catch (err) {
      console.error('[TrackPulse] ExtensionPay init error:', err);
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
    console.log('[TrackPulse] _resolvePlan user keys:', Object.keys(this.user));
    console.log('[TrackPulse] user.paid:', this.user.paid, typeof this.user.paid);
    console.log('[TrackPulse] user.subscriptionStatus:', this.user.subscriptionStatus);
    console.log('[TrackPulse] user.paidAt:', this.user.paidAt);

    // Multiple ways to detect paid status:
    // 1. user.paid === true (standard ExtensionPay)
    // 2. user.subscriptionStatus === 'active' (active subscription)
    // 3. user.paidAt is truthy (has a payment date)
    const isPaid = !!this.user.paid
      || this.user.subscriptionStatus === 'active'
      || !!this.user.paidAt;

    console.log('[TrackPulse] isPaid resolved to:', isPaid);

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

    console.log('[TrackPulse] User isPaid=true, planId="' + planId + '"');

    if (planId && PLAN_ID_MAP[planId]) {
      this.currentPlan = PLAN_ID_MAP[planId];
    } else {
      // Paid but no plan ID — ExtensionPay is single-tier by default
      // Default to 'starter' (lowest paid tier)
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
    console.log('[TrackPulse] Persisting plan cache:', JSON.stringify(data));
    await chrome.storage.local.set(data);
  }

  /**
   * Load cached plan (used as fallback when ExtensionPay is unreachable).
   */
  async _loadCachedPlan() {
    const data = await chrome.storage.local.get(['tp_plan', 'tp_plan_updated']);
    if (data.tp_plan) {
      this.currentPlan = data.tp_plan;
      console.log('[TrackPulse] Loaded cached plan:', this.currentPlan);
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
      this.user = await extpay.getUser();
      console.log('[TrackPulse] Refresh - ExtPay user:', JSON.stringify(this.user));
      this._resolvePlan();
      console.log('[TrackPulse] Refresh - resolved plan:', this.currentPlan);
      await this._persistPlanCache();
      this._notifyListeners();
      return this.currentPlan;
    } catch (e) {
      console.error('[TrackPulse] Refresh failed:', e);
      return this.currentPlan;
    }
  }

  /**
   * Wait for initialization to complete, then return plan.
   */
  async waitForInit() {
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
}

// Singleton
export const planManager = new PlanManager();
export { extpay };
