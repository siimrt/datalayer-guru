/**
 * Extractor Factory — Returns the correct extractor instance for the detected CMS.
 */

import { CMS } from '../../shared/constants.js';
import { BaseExtractor } from './base-extractor.js';
import { ShopifyExtractor } from './shopify-extractor.js';
import { WooCommerceExtractor } from './woocommerce-extractor.js';
import { PrestaShopExtractor } from './prestashop-extractor.js';
import { MagentoExtractor } from './magento-extractor.js';
import { WebflowExtractor } from './webflow-extractor.js';

const EXTRACTOR_MAP = {
  [CMS.SHOPIFY]: ShopifyExtractor,
  [CMS.WOOCOMMERCE]: WooCommerceExtractor,
  [CMS.PRESTASHOP]: PrestaShopExtractor,
  [CMS.MAGENTO]: MagentoExtractor,
  [CMS.WEBFLOW]: WebflowExtractor,
};

/**
 * Get the appropriate extractor for the detected CMS and page type.
 *
 * @param {string} cms - CMS identifier
 * @param {string} pageType - Page type identifier
 * @returns {BaseExtractor} An extractor instance
 */
export function getExtractor(cms, pageType) {
  const ExtractorClass = EXTRACTOR_MAP[cms] || BaseExtractor;
  return new ExtractorClass(cms, pageType);
}
