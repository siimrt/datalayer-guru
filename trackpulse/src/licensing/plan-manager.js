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
  }

  /**
   * Initialize ExtensionPay and load user state.
   * Call this ONCE in the service worker on extension startup.
   */
  async init() {
    if (this._initialized) return;

    try {
      // ExtensionPay background setup
      extpay.startBackground();

      // Get current user
      this.user = await extpay.getUser();
      this._resolvePlan();

      // Listen for payment events
      extpay.onPaid.addListener((user) => {
        this.user = user;
        this._resolvePlan();
        this._notifyListeners();
        this._persistPlanCache();
      });

      // Cache plan in chrome.storage for quick access in sidepanel/content
      await this._persistPlanCache();

      this._initialized = true;
    } catch (err) {
      console.error('[TrackPulse] ExtensionPay init error:', err);
      // Fallback to cached plan
      await this._loadCachedPlan();
    }
  }

  /**
   * Resolve the internal plan name from ExtensionPay user data.
   */
  _resolvePlan() {
    if (!this.user || !this.user.paid) {
      this.currentPlan = 'free';
      return;
    }

    const planId = this.user.subscriptionPlanId || this.user.planId || '';
    this.currentPlan = PLAN_ID_MAP[planId] || 'pro'; // Default to pro if paid but unrecognized
  }

  /**
   * Cache plan in chrome.storage.local for fast access across contexts.
   */
  async _persistPlanCache() {
    await chrome.storage.local.set({
      tp_plan: this.currentPlan,
      tp_plan_updated: Date.now(),
      tp_user_email: this.user?.email || null,
      tp_paid: this.user?.paid || false,
    });
  }

  /**
   * Load cached plan (used as fallback when ExtensionPay is unreachable).
   */
  async _loadCachedPlan() {
    const data = await chrome.storage.local.get(['tp_plan', 'tp_plan_updated']);
    if (data.tp_plan) {
      this.currentPlan = data.tp_plan;
      // If cache is older than 24h, try to refresh
      if (Date.now() - (data.tp_plan_updated || 0) > 86400000) {
        this._refreshInBackground();
      }
    }
  }

  /**
   * Non-blocking refresh of plan status.
   */
  async _refreshInBackground() {
    try {
      this.user = await extpay.getUser();
      this._resolvePlan();
      await this._persistPlanCache();
      this._notifyListeners();
    } catch (e) {
      // Silent fail — use cached plan
    }
  }

  /**
   * Check if the current plan meets the minimum required plan.
   * Usage: planManager.hasAccess('pro') → true if user is pro or agency
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
   * Call this when user clicks "Upgrade".
   */
  openPaymentPage() {
    extpay.openPaymentPage();
  }

  /**
   * Open the ExtensionPay management page (for cancellation, plan change).
   */
  openManagementPage() {
    extpay.openPaymentPage(); // ExtensionPay uses same page for management
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
