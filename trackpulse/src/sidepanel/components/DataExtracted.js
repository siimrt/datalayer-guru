/**
 * DataExtracted Component — Shows a summary of extracted ecommerce data.
 */

import { formatPrice, truncate } from '../../shared/utils.js';

export function renderDataExtracted(ecommerceData, pageType) {
  if (!ecommerceData) return '';

  const { product, cart, order, productImpressions } = ecommerceData;
  const currency = ecommerceData.currency || 'USD';

  let content = '';

  if (product) {
    const sources = [];
    if (product.id) sources.push('ID');
    if (product.sku) sources.push('SKU');
    if (product.brand) sources.push('Brand');

    content = `
      <div class="tp-data-row">
        <span class="tp-data-label">Product</span>
        <span class="tp-data-value">${truncate(product.name, 30)}</span>
      </div>
      <div class="tp-data-row">
        <span class="tp-data-label">ID${product.sku ? ' | SKU' : ''}</span>
        <span class="tp-data-value">${product.id || '—'}${product.sku ? ` | ${product.sku}` : ''}</span>
      </div>
      <div class="tp-data-row">
        <span class="tp-data-label">Price</span>
        <span class="tp-data-value">${formatPrice(product.price, currency)}</span>
      </div>
      ${product.brand || product.category ? `
      <div class="tp-data-row">
        <span class="tp-data-label">${product.brand ? 'Brand' : ''}${product.brand && product.category ? ' | ' : ''}${product.category ? 'Cat' : ''}</span>
        <span class="tp-data-value">${product.brand || ''}${product.brand && product.category ? ' | ' : ''}${product.category || ''}</span>
      </div>
      ` : ''}
      ${product.variant ? `
      <div class="tp-data-row">
        <span class="tp-data-label">Variant</span>
        <span class="tp-data-value">${truncate(product.variant, 30)}</span>
      </div>
      ` : ''}
      ${product.compareAtPrice ? `
      <div class="tp-data-row">
        <span class="tp-data-label">Compare at</span>
        <span class="tp-data-value" style="text-decoration: line-through; color: var(--tp-text-muted);">${formatPrice(product.compareAtPrice, currency)}</span>
      </div>
      ` : ''}
    `;
  } else if (cart) {
    content = `
      <div class="tp-data-row">
        <span class="tp-data-label">Items</span>
        <span class="tp-data-value">${cart.itemCount || cart.items?.length || 0} items</span>
      </div>
      <div class="tp-data-row">
        <span class="tp-data-label">Total</span>
        <span class="tp-data-value">${formatPrice(cart.totalValue, currency)}</span>
      </div>
      ${cart.coupon ? `
      <div class="tp-data-row">
        <span class="tp-data-label">Coupon</span>
        <span class="tp-data-value">${cart.coupon}</span>
      </div>
      ` : ''}
    `;
  } else if (order) {
    content = `
      <div class="tp-data-row">
        <span class="tp-data-label">Order ID</span>
        <span class="tp-data-value">${order.transactionId || '—'}</span>
      </div>
      <div class="tp-data-row">
        <span class="tp-data-label">Revenue</span>
        <span class="tp-data-value">${formatPrice(order.value, currency)}</span>
      </div>
      ${order.tax != null ? `
      <div class="tp-data-row">
        <span class="tp-data-label">Tax</span>
        <span class="tp-data-value">${formatPrice(order.tax, currency)}</span>
      </div>
      ` : ''}
      ${order.shipping != null ? `
      <div class="tp-data-row">
        <span class="tp-data-label">Shipping</span>
        <span class="tp-data-value">${formatPrice(order.shipping, currency)}</span>
      </div>
      ` : ''}
      <div class="tp-data-row">
        <span class="tp-data-label">Items</span>
        <span class="tp-data-value">${order.items?.length || 0} items</span>
      </div>
    `;
  } else if (productImpressions?.length > 0) {
    content = `
      <div class="tp-data-row">
        <span class="tp-data-label">Products found</span>
        <span class="tp-data-value">${productImpressions.length} items</span>
      </div>
      <div class="tp-data-row">
        <span class="tp-data-label">List</span>
        <span class="tp-data-value">${truncate(productImpressions[0]?.listName || 'Collection', 30)}</span>
      </div>
    `;
  } else {
    return `
      <div class="tp-data-summary">
        <div class="text-tp-text-muted text-center text-[11px]">No ecommerce data extracted on this page</div>
      </div>
    `;
  }

  return `
    <div class="tp-data-summary animate-slide-in">
      <div class="flex items-center justify-between mb-2">
        <span class="font-medium text-[12px]">Extracted Data</span>
      </div>
      ${content}
    </div>
  `;
}
