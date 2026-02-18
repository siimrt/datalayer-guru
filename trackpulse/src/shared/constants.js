// CMS identifiers
export const CMS = {
  SHOPIFY: 'shopify',
  WOOCOMMERCE: 'woocommerce',
  PRESTASHOP: 'prestashop',
  MAGENTO: 'magento',
  WEBFLOW: 'webflow',
  UNKNOWN: 'unknown',
};

// Page type identifiers
export const PAGE_TYPES = {
  HOME: 'home',
  COLLECTION: 'collection',
  PRODUCT: 'product',
  CART: 'cart',
  CHECKOUT: 'checkout',
  THANK_YOU: 'thank_you',
  SEARCH: 'search',
  BLOG: 'blog',
  ARTICLE: 'article',
  ACCOUNT: 'account',
  PAGE: 'page',
  UNKNOWN: 'unknown',
};

// Platform identifiers
export const PLATFORMS = {
  GA4: 'ga4',
  META: 'meta',
  TIKTOK: 'tiktok',
  PINTEREST: 'pinterest',
};

// CMS detection signals with scoring weights
export const CMS_SIGNALS = {
  shopify: {
    jsGlobals: ['Shopify', 'ShopifyAnalytics'],
    metaTags: [
      { name: 'shopify-digital-wallet', exists: true },
      { property: 'og:site_name', contentIncludes: 'shopify' },
    ],
    urlPatterns: [/\/cart\.js/, /cdn\.shopify\.com/],
    domElements: [
      'script[src*="cdn.shopify.com"]',
      'link[href*="cdn.shopify.com"]',
    ],
    cookies: ['_shopify_s', '_shopify_y', 'cart_currency'],
    htmlPatterns: [/Shopify\.theme/, /shopify-section/],
  },
  woocommerce: {
    jsGlobals: [
      'wc_add_to_cart_params',
      'wc_cart_fragments_params',
      'woocommerce_params',
    ],
    metaTags: [{ name: 'generator', contentIncludes: 'WooCommerce' }],
    urlPatterns: [/wp-content\/plugins\/woocommerce/],
    domElements: [
      'body.woocommerce',
      'body.woocommerce-page',
      'script[src*="woocommerce"]',
      '.woocommerce-Price-amount',
    ],
    cookies: ['woocommerce_cart_hash', 'woocommerce_items_in_cart'],
    htmlPatterns: [/woocommerce/i],
  },
  prestashop: {
    jsGlobals: ['prestashop', 'PrestaShop'],
    metaTags: [{ name: 'generator', contentIncludes: 'PrestaShop' }],
    urlPatterns: [/\/modules\/ps_/, /\/themes\/.*\/assets/],
    domElements: [
      'script[src*="prestashop"]',
      '#prestashop',
      'body[id^="cms"]',
    ],
    cookies: ['PrestaShop-'],
    htmlPatterns: [/prestashop/i, /ps_shoppingcart/],
  },
  magento: {
    jsGlobals: ['Mage', 'mageUrl'],
    metaTags: [{ name: 'generator', contentIncludes: 'Magento' }],
    urlPatterns: [/static\/version/, /\/pub\/static/],
    domElements: [
      'script[src*="mage/"]',
      'script[src*="Magento_"]',
      'body.cms-index-index',
      '[data-mage-init]',
    ],
    cookies: ['form_key', 'mage-cache-storage'],
    htmlPatterns: [/Magento/i, /mage\/cookies/],
  },
  webflow: {
    jsGlobals: ['Webflow'],
    metaTags: [{ name: 'generator', contentIncludes: 'Webflow' }],
    urlPatterns: [/assets\.website-files\.com/, /uploads-ssl\.webflow\.com/],
    domElements: [
      '[data-wf-site]',
      '[data-wf-page]',
      'html.w-mod-js',
    ],
    cookies: [],
    htmlPatterns: [/webflow/i, /data-wf-/],
  },
};

// Signal scoring weights
export const SIGNAL_WEIGHTS = {
  jsGlobals: 30,
  metaTags: 25,
  domElements: 15,
  urlPatterns: 10,
  cookies: 10,
  htmlPatterns: 5,
};

// Minimum score to declare a CMS detected
export const CMS_MIN_THRESHOLD = 30;

// CMS display info
export const CMS_INFO = {
  shopify: { name: 'Shopify', badge: 'SH', color: '#96BF48' },
  woocommerce: { name: 'WooCommerce', badge: 'WC', color: '#7F54B3' },
  prestashop: { name: 'PrestaShop', badge: 'PS', color: '#DF0067' },
  magento: { name: 'Magento', badge: 'MG', color: '#F26322' },
  webflow: { name: 'Webflow', badge: 'WF', color: '#4353FF' },
  unknown: { name: 'Unknown', badge: '?', color: '#5E5E72' },
};

// Page type display labels
export const PAGE_TYPE_LABELS = {
  home: 'Home',
  collection: 'Collection',
  product: 'Product',
  cart: 'Cart',
  checkout: 'Checkout',
  thank_you: 'Thank You',
  search: 'Search',
  blog: 'Blog',
  article: 'Article',
  account: 'Account',
  page: 'Page',
  unknown: 'Unknown',
};

// GA4 event mapping by page type
export const GA4_EVENT_MAP = {
  product: 'view_item',
  collection: 'view_item_list',
  cart: 'view_cart',
  checkout: 'begin_checkout',
  thank_you: 'purchase',
  search: 'search',
};

// Meta event mapping by page type
export const META_EVENT_MAP = {
  product: 'ViewContent',
  collection: 'ViewCategory',
  cart: 'ViewCart',
  checkout: 'InitiateCheckout',
  thank_you: 'Purchase',
  search: 'Search',
};

// TikTok event mapping by page type
export const TIKTOK_EVENT_MAP = {
  product: 'ViewContent',
  collection: 'ViewContent',
  cart: 'ViewCart',
  checkout: 'InitiateCheckout',
  thank_you: 'PlaceAnOrder',
  search: 'Search',
};

// Pinterest event mapping by page type
export const PINTEREST_EVENT_MAP = {
  product: 'pagevisit',
  collection: 'viewcategory',
  cart: 'addtocart',
  thank_you: 'checkout',
  search: 'search',
};

// Pixel detection patterns
export const PIXEL_PATTERNS = {
  gtm: {
    scripts: [/googletagmanager\.com\/gtm\.js/],
    idPattern: /GTM-[A-Z0-9]+/,
  },
  ga4: {
    scripts: [/googletagmanager\.com\/gtag/, /google-analytics\.com/],
    idPattern: /G-[A-Z0-9]+/,
  },
  ua: {
    scripts: [/google-analytics\.com\/analytics\.js/],
    idPattern: /UA-\d+-\d+/,
  },
  meta: {
    scripts: [/connect\.facebook\.net\/.*\/fbevents\.js/],
    idPattern: /\d{15,16}/,
  },
  tiktok: {
    scripts: [/analytics\.tiktok\.com/],
    idPattern: /[A-Z0-9]{20}/,
  },
  pinterest: {
    scripts: [/s\.pinimg\.com\/ct\/core\.js/],
    idPattern: /\d{13}/,
  },
  snapchat: {
    scripts: [/sc-static\.net\/scevent\.min\.js/],
    idPattern: /[a-f0-9-]{36}/,
  },
  linkedin: {
    scripts: [/snap\.licdn\.com\/li\.lms-analytics/],
    idPattern: /\d{6,8}/,
  },
  twitter: {
    scripts: [/static\.ads-twitter\.com\/uwt\.js/],
    idPattern: /[a-z0-9]{5,6}/,
  },
};

// CMP (Consent Management Platform) detection
export const CMP_SIGNALS = {
  cookiebot: { globals: ['Cookiebot', 'CookieConsent'] },
  onetrust: { globals: ['OneTrust', 'OptanonActiveGroups'] },
  axeptio: { globals: ['_axcb', 'axeptioSettings'] },
  didomi: { globals: ['Didomi', 'didomiOnReady'] },
  tarteaucitron: { globals: ['tarteaucitron'] },
  complianz: { globals: ['complianz'] },
};

// CMS logo SVGs (inline)
export const CMS_LOGOS = {
  shopify: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.34 5.68c-.03-.16-.16-.25-.27-.26s-2.2-.15-2.2-.15l-1.53-1.52c-.17-.18-.5-.12-.63-.08l-.87.27C9.46 2.93 8.9 2.4 8.1 2.4h-.12c-.36-.44-.8-.62-1.18-.62C4.64 1.78 3.6 4.36 3.28 5.62l-2.04.63c-.63.2-.65.22-.73.81L.02 12.97l11.2 2.1L15.34 5.68z" fill="#96BF48"/><path d="M15.07 5.42s-2.2-.15-2.2-.15l-1.53-1.52c-.07-.07-.16-.1-.25-.11l-1.33 16.43 5.57-1.2-1.03-9.19c-.03-.16-.16-.25-.27-.26z" fill="#5A863E"/><path d="M8.1 7.92L7.4 10.4s-.66-.35-1.46-.3c-1.16.08-1.17.8-1.16.99.06 1.04 2.8 1.27 2.96 3.7.12 1.92-.98 3.22-2.58 3.33-1.92.13-2.98-1.01-2.98-1.01l.4-1.73s1.07.8 1.92.75c.56-.04.76-.49.74-.81-.08-1.36-2.31-1.28-2.46-3.5C2.65 10 3.87 8.16 6.4 7.99c.97-.07 1.47.19 1.47.19l.23-.26z" fill="#FFF"/></svg>`,
  woocommerce: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#7F54B3"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">W</text></svg>`,
  prestashop: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#DF0067"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">PS</text></svg>`,
  magento: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#F26322"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">M</text></svg>`,
  webflow: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#4353FF"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">Wf</text></svg>`,
  unknown: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#5E5E72"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="sans-serif">?</text></svg>`,
};
