// Site type identifiers
export const SITE_TYPES = {
  ECOMMERCE: 'ecommerce',
  LEADGEN: 'leadgen',
  HYBRID: 'hybrid',
  UNKNOWN: 'unknown',
};

// CMS identifiers
export const CMS = {
  SHOPIFY: 'shopify',
  WOOCOMMERCE: 'woocommerce',
  PRESTASHOP: 'prestashop',
  MAGENTO: 'magento',
  WEBFLOW: 'webflow',
  WORDPRESS: 'wordpress',
  HUBSPOT_CMS: 'hubspot_cms',
  SQUARESPACE: 'squarespace',
  WIX: 'wix',
  UNBOUNCE: 'unbounce',
  INSTAPAGE: 'instapage',
  LEADPAGES: 'leadpages',
  CLICKFUNNELS: 'clickfunnels',
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
  // Lead gen page types
  LANDING: 'landing_page',
  FORM: 'form_page',
  PRICING: 'pricing',
  DEMO: 'demo_request',
  CONFIRMATION: 'confirmation',
  CONTACT: 'contact',
  ABOUT: 'about',
  SERVICES: 'services',
  UNKNOWN: 'unknown',
};

// Platform identifiers
export const PLATFORMS = {
  GA4: 'ga4',
  GOOGLE_ADS: 'google_ads',
  META: 'meta',
  TIKTOK: 'tiktok',
  PINTEREST: 'pinterest',
  SNAPCHAT: 'snapchat',
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter',
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
  wordpress: {
    jsGlobals: ['wp'],
    metaTags: [{ name: 'generator', contentIncludes: 'WordPress' }],
    urlPatterns: [/\/wp-content\//, /\/wp-includes\//],
    domElements: [
      'link[href*="wp-content"]',
      'script[src*="wp-includes"]',
      'script[src*="wp-content"]',
    ],
    cookies: ['wordpress_logged_in', 'wp-settings'],
    htmlPatterns: [/wp-content/i, /wp-includes/],
  },
  hubspot_cms: {
    jsGlobals: ['hsVars', '_hsq'],
    metaTags: [{ name: 'generator', contentIncludes: 'HubSpot' }],
    urlPatterns: [/\.hubspot\.com/, /\.hs-sites\.com/],
    domElements: [
      '[data-hs-cos-type]',
      '.hs-cta-wrapper',
      '#hs-script-loader',
    ],
    cookies: ['__hs_opt_out', 'hubspotutk'],
    htmlPatterns: [/data-hs-cos/i, /hs-cta-wrapper/],
  },
  squarespace: {
    jsGlobals: ['Static'],
    metaTags: [{ name: 'generator', contentIncludes: 'Squarespace' }],
    urlPatterns: [/static1\.squarespace\.com/, /images\.squarespace\.com/],
    domElements: [
      '.sqs-block',
      '[data-squarespace-cacheversion]',
    ],
    cookies: ['crumb', 'SS_MID'],
    htmlPatterns: [/squarespace/i, /sqs-block/],
  },
  wix: {
    jsGlobals: ['wixBiSession'],
    metaTags: [{ name: 'generator', contentIncludes: 'Wix.com' }],
    urlPatterns: [/static\.wixstatic\.com/, /static\.parastorage\.com/],
    domElements: [
      '[data-mesh-id]',
      '#WIX_ADS',
    ],
    cookies: [],
    htmlPatterns: [/wixstatic/i, /parastorage/],
  },
  unbounce: {
    jsGlobals: ['ub'],
    metaTags: [],
    urlPatterns: [/unbouncepages\.com/],
    domElements: [
      '#lp-pom-root',
      '[class*="lp-pom-"]',
    ],
    cookies: [],
    htmlPatterns: [/lp-pom-root/, /unbouncepages/i],
  },
  instapage: {
    jsGlobals: ['__instapage'],
    metaTags: [],
    urlPatterns: [/\.instapage\.com/, /\.pageserve\.co/],
    domElements: [
      '#instapage-noscript',
    ],
    cookies: [],
    htmlPatterns: [/instapage/i],
  },
  leadpages: {
    jsGlobals: ['LeadpagesMetrics'],
    metaTags: [{ name: 'generator', contentIncludes: 'Leadpages' }],
    urlPatterns: [/\.leadpages\.net/, /lpcdn\.io/],
    domElements: [],
    cookies: [],
    htmlPatterns: [/leadpages/i],
  },
  clickfunnels: {
    jsGlobals: ['cfJsHost'],
    metaTags: [],
    urlPatterns: [/\.clickfunnels\.com/],
    domElements: [
      '.elBTN',
    ],
    cookies: [],
    htmlPatterns: [/clickfunnels/i, /cfJsHost/],
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
  wordpress: { name: 'WordPress', badge: 'WP', color: '#21759B' },
  hubspot_cms: { name: 'HubSpot', badge: 'HS', color: '#FF7A59' },
  squarespace: { name: 'Squarespace', badge: 'SQ', color: '#000000' },
  wix: { name: 'Wix', badge: 'WX', color: '#0C6EFC' },
  unbounce: { name: 'Unbounce', badge: 'UB', color: '#2542E7' },
  instapage: { name: 'Instapage', badge: 'IP', color: '#1A82E2' },
  leadpages: { name: 'Leadpages', badge: 'LP', color: '#7B2D8E' },
  clickfunnels: { name: 'ClickFunnels', badge: 'CF', color: '#F77F00' },
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
  // Lead gen page types
  landing_page: 'Landing Page',
  form_page: 'Form Page',
  pricing: 'Pricing',
  demo_request: 'Demo Request',
  confirmation: 'Confirmation',
  contact: 'Contact',
  about: 'About',
  services: 'Services',
  unknown: 'Unknown',
};

// Platform display labels
export const PLATFORM_LABELS = {
  ga4: 'GA4', google_ads: 'Google Ads', meta: 'Meta', tiktok: 'TikTok',
  pinterest: 'Pinterest', snapchat: 'Snapchat', linkedin: 'LinkedIn',
  twitter: 'Twitter',
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
  google_ads: {
    scripts: [/googletagmanager\.com\/gtag/],
    idPattern: /AW-[A-Z0-9]+/,
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

// Lead gen platform identifiers
export const LEADGEN_PLATFORMS = {
  HUBSPOT: 'hubspot',
  PARDOT: 'pardot',
  MARKETO: 'marketo',
  ACTIVECAMPAIGN: 'activecampaign',
  CALLRAIL: 'callrail',
  CALLTRACKINGMETRICS: 'calltrackingmetrics',
  WHATCONVERTS: 'whatconverts',
  DRIFT: 'drift',
  INTERCOM: 'intercom',
  CRISP: 'crisp',
  LIVECHAT: 'livechat',
  TIDIO: 'tidio',
  CALENDLY: 'calendly',
  CHILIPIPER: 'chilipiper',
};

// Lead gen tool detection patterns
export const LEADGEN_PIXEL_PATTERNS = {
  hubspot: { scriptPatterns: ['js.hs-scripts.com', 'js.hs-analytics.net'], globals: ['_hsq', 'HubSpotConversations'] },
  pardot: { scriptPatterns: ['pi.pardot.com/pd.js'], globals: ['piAId', 'piCId'] },
  marketo: { scriptPatterns: ['munchkin.marketo.net/munchkin.js'], globals: ['Munchkin'] },
  activecampaign: { scriptPatterns: ['trackcmp.net'], globals: ['vgo'] },
  callrail: { scriptPatterns: ['cdn.callrail.com'], globals: [] },
  calltrackingmetrics: { scriptPatterns: ['tctm.co', 'calltrackingmetrics.com'], globals: [] },
  whatconverts: { scriptPatterns: ['cdn.whatconverts.com'], globals: [] },
  drift: { scriptPatterns: ['js.driftt.com'], globals: ['drift', 'driftt'] },
  intercom: { scriptPatterns: ['widget.intercom.io'], globals: ['Intercom'] },
  crisp: { scriptPatterns: ['client.crisp.chat'], globals: ['$crisp', 'CRISP_WEBSITE_ID'] },
  livechat: { scriptPatterns: ['cdn.livechatinc.com'], globals: ['LiveChatWidget', '__lc'] },
  tidio: { scriptPatterns: ['code.tidio.co'], globals: [] },
  calendly: { scriptPatterns: ['assets.calendly.com'], globals: [] },
  chilipiper: { scriptPatterns: ['js.chilipiper.com'], globals: ['ChiliPiper'] },
};

// Lead gen tool display info
export const LEADGEN_TOOL_INFO = {
  hubspot: { name: 'HubSpot', category: 'crm', color: '#FF7A59' },
  pardot: { name: 'Pardot', category: 'crm', color: '#00A1E0' },
  marketo: { name: 'Marketo', category: 'crm', color: '#5C4C9F' },
  activecampaign: { name: 'ActiveCampaign', category: 'crm', color: '#356AE6' },
  callrail: { name: 'CallRail', category: 'call_tracking', color: '#00C389' },
  calltrackingmetrics: { name: 'CTM', category: 'call_tracking', color: '#F26522' },
  whatconverts: { name: 'WhatConverts', category: 'call_tracking', color: '#4CAF50' },
  drift: { name: 'Drift', category: 'chat', color: '#0176FF' },
  intercom: { name: 'Intercom', category: 'chat', color: '#1F8DED' },
  crisp: { name: 'Crisp', category: 'chat', color: '#4B48F0' },
  livechat: { name: 'LiveChat', category: 'chat', color: '#F56B2A' },
  tidio: { name: 'Tidio', category: 'chat', color: '#1B74E4' },
  calendly: { name: 'Calendly', category: 'scheduling', color: '#006BFF' },
  chilipiper: { name: 'Chili Piper', category: 'scheduling', color: '#FF5722' },
};

// Lead gen canonical events (cross-platform mapping)
export const LEADGEN_CANONICAL_EVENTS = {
  generate_lead: { label: 'Lead Generated', platforms: { ga4: 'generate_lead', google_ads: 'submit_lead_form', meta: 'Lead', tiktok: 'SubmitForm', pinterest: 'lead', linkedin: 'conversion', twitter: 'Lead' } },
  contact: { label: 'Contact', platforms: { ga4: 'contact', google_ads: 'contact', meta: 'Contact', tiktok: 'Contact', pinterest: 'custom' } },
  sign_up: { label: 'Sign Up', platforms: { ga4: 'sign_up', google_ads: 'submit_lead_form', meta: 'CompleteRegistration', tiktok: 'CompleteRegistration', pinterest: 'signup' } },
  schedule: { label: 'Schedule / Book', platforms: { ga4: 'schedule', google_ads: 'book_appointment', meta: 'Schedule', tiktok: 'SubmitForm', pinterest: 'custom' } },
  subscribe: { label: 'Subscribe', platforms: { ga4: 'sign_up', google_ads: 'submit_lead_form', meta: 'Subscribe', tiktok: 'CompleteRegistration', pinterest: 'signup' } },
};

// Lead gen expected events by page type
export const LEADGEN_EXPECTED_EVENTS_BY_PAGE = {
  form_page: ['generate_lead'],
  confirmation: ['generate_lead'],
  contact: ['contact', 'generate_lead'],
  demo_request: ['generate_lead', 'schedule'],
  landing_page: ['generate_lead'],
  pricing: [],
};

// CMS → default site type mapping
export const CMS_SITE_TYPE_MAP = {
  shopify: SITE_TYPES.ECOMMERCE,
  woocommerce: SITE_TYPES.ECOMMERCE,
  prestashop: SITE_TYPES.ECOMMERCE,
  magento: SITE_TYPES.ECOMMERCE,
  bigcommerce: SITE_TYPES.ECOMMERCE,
  wordpress: SITE_TYPES.LEADGEN,
  hubspot_cms: SITE_TYPES.LEADGEN,
  squarespace: SITE_TYPES.UNKNOWN,
  wix: SITE_TYPES.UNKNOWN,
  webflow: SITE_TYPES.UNKNOWN,
  unbounce: SITE_TYPES.LEADGEN,
  instapage: SITE_TYPES.LEADGEN,
  leadpages: SITE_TYPES.LEADGEN,
  clickfunnels: SITE_TYPES.LEADGEN,
};

// Site type display info
export const SITE_TYPE_INFO = {
  ecommerce: { name: 'E-commerce', badge: 'EC', color: '#00B894' },
  leadgen: { name: 'Lead Gen', badge: 'LG', color: '#0984E3' },
  hybrid: { name: 'Hybrid', badge: 'HY', color: '#6C5CE7' },
  unknown: { name: 'Unknown', badge: '?', color: '#5E5E72' },
};

// CMS logo SVGs (inline)
export const CMS_LOGOS = {
  shopify: `<svg viewBox="-18 0 292 292" xmlns="http://www.w3.org/2000/svg"><path d="M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.805-.19.056-3.388 1.043-8.678 2.68-5.18-14.906-14.322-28.604-30.405-28.604-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.976 70.635-14.558 4.511-24.9 7.718-26.221 8.133-8.126 2.549-8.383 2.805-9.45 10.462C21.3 95.806.038 260.235.038 260.235l165.678 31.042 89.77-19.42S223.973 58.8 223.775 57.34zM156.49 40.848l-14.019 4.339c.005-.988.01-1.96.01-3.023 0-9.264-1.286-16.723-3.349-22.636 8.287 1.04 13.806 10.469 17.358 21.32zm-27.638-19.483c2.304 5.773 3.802 14.058 3.802 25.238 0 .572-.005 1.095-.01 1.624-9.117 2.824-19.024 5.89-28.953 8.966 5.575-21.516 16.025-31.908 25.161-35.828zm-11.131-10.537c1.617 0 3.246.549 4.805 1.622-12.007 5.65-24.877 19.88-30.312 48.297l-22.886 7.088C75.694 46.16 90.81 10.828 117.72 10.828z" fill="#95BF46"/><path d="M221.237 54.983c-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.959-2.394-1.099l-12.527 256.233 89.762-19.418S223.972 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357" fill="#5E8E3E"/><path d="M135.242 104.585l-11.069 32.926s-9.698-5.176-21.586-5.176c-17.428 0-18.305 10.937-18.305 13.693 0 15.038 39.2 20.8 39.2 56.024 0 27.713-17.577 45.558-41.277 45.558-28.44 0-42.984-17.7-42.984-17.7l7.615-25.16s14.95 12.835 27.565 12.835c8.243 0 11.596-6.49 11.596-11.232 0-19.616-32.16-20.491-32.16-52.724 0-27.129 19.472-53.382 58.778-53.382 15.145 0 22.627 4.338 22.627 4.338" fill="#FFF"/></svg>`,
  woocommerce: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 503.81 299.89"><defs><style>.wc1{fill:#7f54b3}.wc2{fill:#fff}</style></defs><path class="wc1" d="M46.75,0H456.84a46.94,46.94,0,0,1,47,47V203.5a46.94,46.94,0,0,1-47,47H309.78L330,299.89l-88.78-49.43H47a46.94,46.94,0,0,1-47-47V47A46.77,46.77,0,0,1,46.76,0Z"/><path class="wc2" d="M28.69,42.8c2.86-3.89,7.16-5.94,12.9-6.35Q57.25,35.24,59.41,51.2,68.94,115.4,80.09,160l44.85-85.4q6.15-11.67,15.36-12.29c9-.61,14.54,5.12,16.8,17.2,5.12,27.24,11.67,50.38,19.45,70q8-78,27-112.64c3.07-5.73,7.57-8.6,13.51-9A17.8,17.8,0,0,1,230,32a16,16,0,0,1,6.35,11.67,17.79,17.79,0,0,1-2,9.83c-8,14.75-14.55,39.53-19.87,73.93-5.12,33.39-7,59.4-5.73,78a24.29,24.29,0,0,1-2.46,13.52c-2.46,4.51-6.15,7-10.86,7.37-5.32.41-10.85-2.05-16.17-7.57Q150.64,189.54,134,131.48q-20,39.32-29.49,59c-12.09,23.14-22.33,35-30.93,35.64C68,226.51,63.3,221.8,59.2,212Q43.54,171.72,25.41,56.52A17.44,17.44,0,0,1,28.69,42.8ZM468.81,75C461.43,62.05,450.58,54.27,436,51.2A53.72,53.72,0,0,0,425,50c-19.66,0-35.63,10.24-48.13,30.72a108.52,108.52,0,0,0-16,57.75q0,23.66,9.83,40.55c7.37,12.91,18.23,20.69,32.77,23.76A53.64,53.64,0,0,0,414.54,204c19.86,0,35.83-10.24,48.12-30.72a109.73,109.73,0,0,0,16-58C478.84,99.33,475.36,86,468.81,75ZM443,131.69c-2.86,13.51-8,23.55-15.56,30.31-5.94,5.32-11.47,7.57-16.59,6.55-4.92-1-9-5.32-12.08-13.31a52,52,0,0,1-3.69-18.64,71.48,71.48,0,0,1,1.43-14.95,66.29,66.29,0,0,1,10.86-24.37c6.76-10,13.92-14.13,21.3-12.7,4.91,1,9,5.33,12.08,13.31a52,52,0,0,1,3.69,18.64A71.47,71.47,0,0,1,443,131.69ZM340.6,75c-7.37-12.91-18.43-20.69-32.76-23.76A53.79,53.79,0,0,0,296.78,50c-19.66,0-35.64,10.24-48.13,30.72a108.52,108.52,0,0,0-16,57.75q0,23.66,9.83,40.55c7.37,12.91,18.22,20.69,32.76,23.76A53.72,53.72,0,0,0,286.33,204c19.87,0,35.84-10.24,48.13-30.72a109.72,109.72,0,0,0,16-58C350.43,99.33,347.16,86,340.6,75Zm-26,56.73c-2.86,13.51-8,23.55-15.56,30.31-5.94,5.32-11.47,7.57-16.59,6.55-4.91-1-9-5.32-12.08-13.31a52,52,0,0,1-3.69-18.64,71.48,71.48,0,0,1,1.43-14.95A66.29,66.29,0,0,1,279,97.28c6.76-10,13.92-14.13,21.3-12.7,4.91,1,9,5.33,12.08,13.31A52,52,0,0,1,316,116.53a60.45,60.45,0,0,1-1.44,15.16Z"/></svg>`,
  prestashop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 333334 333334" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd"><defs><style>.fil2{fill:#000;fill-rule:nonzero}.fil1,.fil8,.fil9{fill:#525252;fill-rule:nonzero}.fil8,.fil9{fill:#676969}.fil9{fill:#909393}.fil3,.fil4,.fil7{fill:#aa9577;fill-rule:nonzero}.fil4,.fil7{fill:#babcbc}.fil4{fill:#c3b6a1}.fil10,.fil11,.fil6{fill:#e2dddb;fill-rule:nonzero}.fil11,.fil6{fill:#fbaf3f}.fil6{fill:#fff}</style></defs><g id="Layer_x0020_1"><path d="M108046 255750c2661-1185 5358-2275 8080-3297 3073-1155 6170-2241 9310-3186 3907-1177 7848-2242 11841-3090 5388-1146 10837-1988 16320-2522-3099 9721-6490 19347-10167 28865 152 1858 249 3720 292 5583 7557-1494 15242-2247 22945-2249 7853 0 15521 784 22945 2249 43-1863 140-3725 292-5583-3678-9517-7068-19143-10167-28865 5488 533 10936 1379 16320 2522 3992 848 7932 1913 11840 3090 3141 945 6238 2031 9311 3186 2722 1023 5420 2113 8082 3298 19239 8554 36379 21206 50221 37072 35391-30561 57822-75725 57822-126156C333333 74620 258713 0 166666 0S-1 74620-1 166667c0 50431 22431 95594 57822 126156 13843-15866 30983-28519 50224-37073z" fill="#a5dbe8" fill-rule="nonzero"/><path class="fil1" d="M225291 255752l10346 35577 2935 138c1905 0 3245 501 3245 2406 0 3167 164 6725 467 9832 2578 2189 5718 4657 8098 7056 8913-5191 17325-11195 25130-17937-13842-15866-30982-28518-50221-37072zm-20231-356l12149-2943c-3073-1155-6170-2241-9311-3186-3907-1177-7848-2242-11840-3090-5389-1146-10837-1988-16320-2522 3099 9721 6489 19347 10167 28865-152 1858-249 3720-292 5583 8608 1698 17072 4648 24897 8109l-9450-30817z"/><path class="fil2" d="M82952 310761c1935 1128 3889 2228 5876 3279 695-3340 1807-7967 2143-11404-2578 2189-5639 5726-8020 8125zm131354-24856c-7917-3507-16199-6124-24694-7802-7557-1494-15242-2247-22945-2249-7854 0-15521 784-22945 2249-8607 1696-17587 4271-25410 7730l-832 5184h98378l-1551-5112z"/><path class="fil1" d="M90667 303623c305-3107 525-5876 525-9044 0-1904 1306-3124 3211-3124l3124-109 10519-35595c-19240 8554-36381 21207-50224 37073 7805 6742 16217 12747 25130 17937 2380-2400 4861-4699 7437-6888l278-250z"/><path class="fil2" d="M243556 309955c674 3385 827 4060 949 4085 1981-1053 3940-2146 5876-3279-2406-2427-4913-4750-7516-6965l690 6159z"/><path class="fil3" d="M214306 285905l1551 5112h20122l-10689-35266c-2661-1179-5356-2279-8082-3298l-12149 2943 9246 30509z"/><path class="fil4" d="M97707 298140c106-74 213-148 317-224h-302c-3 74-11 150-15 224z"/><path class="fil3" d="M235612 297916h-303l316 224c-3-74-10-150-13-224z"/><path class="fil3" d="M235266 297401l-68742 78 143 35854c25583 0 49813-5780 71475-16082-1414-6213-1556-12906-1786-19419-104-76-1090-431-1090-431z"/><path class="fil4" d="M166556 297628s-69121-87-69227-13c-229 6514-1573 14243-2138 19637 21663 10302 45892 16082 71475 16082l39-35590-150-116z"/><path fill="#776452" fill-rule="nonzero" d="M166667 294467h1v3449h-1z"/><path class="fil3" d="M218222 271042l35 108-35-108s-1690-1340-3835-3807c2144 2467 3835 3807 3835 3807z"/><path class="fil6" d="M269148 120245v8-8zm6707 47986l1-50-1 50z"/><path class="fil7" d="M275857 168181l-1-45z"/><path class="fil8" d="M275670 165585c5 44 18 83 23 128 4 27 12 52 16 78v11c80 637 109 1302 124 1972 3 124 24 240 24 362l1 45-1 50c-2 133-24 257-25 388-9 646-50 1292-121 1935v9l-18 95c-5 51-21 96-28 146-87 664-212 1323-374 1973l-2 9v1l23-26 9-30v1l4362-4566-4397-4603 1 9c164 642 289 1316 383 2013z"/><path class="fil2" d="M275664 170804c12-86 34-163 46-250 77-625 106-1277 121-1935 1-148 25-288 25-438 0-139-21-269-24-407-8-659-49-1317-124-1972-11-76-30-142-39-216-89-678-217-1350-383-2013-57-224-137-423-203-639-394-1305-932-2457-1570-3414-244-364-511-712-800-1042-263-291-552-559-862-801-115-87-236-148-353-224-359-236-748-424-1156-558-385-128-788-198-1194-206-409 0-804 86-1194 206-409 134-798 322-1157 558-115 76-237 135-350 223-536 418-1007 914-1398 1470-91 122-180 248-265 375-638 957-1177 2109-1570 3414l-50 156c-174 599-310 1229-423 1876-34 198-80 388-107 591-104 724-157 1479-170 2253-2 107-18 208-18 315h26c0 6349 3004 11495 6708 11495 638 0 1251-167 1836-452 350-172 681-381 987-624 126-102 245-224 366-339 295-276 577-589 843-936 185-243 367-487 537-759 108-173 207-361 307-546 187-346 365-707 524-1090 60-138 121-272 176-414 204-532 383-1095 534-1685 160-629 280-1291 374-1973zm-6274-4152c-1389 0-2516-1931-2516-4311 0-2379 1126-4310 2516-4310 1389 0 2514 1931 2514 4310 0 2380-1125 4311-2514 4311z"/><path class="fil6" d="M269390 158030c-1389 0-2516 1931-2516 4310 0 2380 1126 4311 2516 4311 1389 0 2514-1931 2514-4311 0-2379-1125-4310-2514-4310z"/><path class="fil9" d="M263214 162934c393-1305 932-2457 1570-3414 86-130 173-251 265-375 390-557 861-1053 1398-1470 113-87 236-147 350-223 359-237 748-425 1157-558 388-122 785-206 1194-206s806 83 1194 206c408 134 797 322 1156 558 117 76 239 137 353 224 299 229 586 500 862 801 288 330 555 678 800 1042 638 957 1176 2109 1570 3414v2l-5935-27183-5936 27182h1z"/><path class="fil2" d="M190494 167927c-8-547-43-1087-104-1618-1-7-4-15-4-22-61-520-149-1036-261-1547l-11-39c-111-498-248-991-407-1476l-13-33c-159-481-343-954-550-1417-2-9-9-19-13-29-1654-3681-4655-6589-8387-8125l-46-17c-908-370-1848-654-2810-848-25-4-48-5-73-10-992-196-2001-295-3012-296-1014 0-2000 104-2959 288l-102 16c-955 190-1875 469-2759 823l-70 27c-894 363-1752 808-2564 1330-811 524-1573 1119-2274 1776l-17 54-59 13c-1122 1067-2082 2293-2850 3638l-29 48c-234 413-446 843-642 1280-20 47-47 91-66 138-178 405-332 824-475 1246-28 83-64 162-90 244-125 394-226 800-323 1204-25 117-63 229-87 345-83 401-141 811-194 1222-16 126-43 248-56 374-164 1559-92 3134 213 4672 3 19 4 42 9 63 197 980 486 1926 857 2831 6 13 8 26 15 38 751 1817 1836 3478 3198 4896 1068 1113 2297 2068 3648 2831l20 12c422 237 858 450 1302 648 37 16 72 37 109 52 411 180 837 335 1266 479 73 25 143 56 216 80 396 126 805 228 1214 322 111 26 217 63 329 86 397 82 806 138 1218 191 124 15 246 43 372 56 3667 386 7352-533 10409-2596 1672-1130 3112-2569 4242-4241 1751-2593 2685-5651 2682-8780 0-38-5-73-5-108-2-40-7-78-8-119zm-15690-1840c-3258 0-5899-2642-5898-5900 0-3258 2642-5899 5900-5898 3258 0 5898 2642 5898 5900s-2642 5899-5900 5898z"/><path class="fil6" d="M174804 154289c-3257-3-5900 2636-5903 5894-3 3257 2636 5900 5893 5903h10c3257-3 5896-2646 5894-5903-3-3254-2640-5891-5894-5894z"/><path class="fil7" d="M164000 156776l59-13 17-54 10815-33076v-7741l-2-87c-6104-1264-12321-1905-18554-1914-2116 0-4215 90-6301 232-304 21-608 39-913 63-10856 824-21546 3654-31444 8172-8488 3876-16375 8982-23465 15035v2l-12 10c-1897 1624-3735 3317-5509 5074-333 326-672 648-1002 979-1678 1692-3300 3437-4866 5233-340 392-674 792-1010 1187-1580 1854-3101 3757-4560 5707-121 164-235 336-354 500-1384 1890-2711 3822-3979 5792-249 384-504 763-748 1151-1028 1632-1985 3307-2936 4987h49267l45496-11239z"/><path class="fil10" d="M205593 153055c100-1291 182-2580 248-3871 90-1747 151-3497 185-5246 26-1358 22-2717 15-4076 0-392 9-784 5-1177-40-3507-169-7011-387-10511l-30-20-13-25c-1302-748-2605-1493-3910-2234l-91-52-1020-577-18-10-707-396-139-78c-170-95-342-188-514-280-2265-1176-4575-2261-6926-3254-5603-2366-13150-4440-17401-5441v7828l10720 33129 12 27c1107 1055 2059 2267 2822 3603v1c250 437 479 889 686 1352 5 10 10 19 13 29 207 461 389 933 550 1417l13 33c159 483 296 975 407 1476l11 39c112 507 199 1024 261 1547 0 8 3 16 4 22 61 531 96 1071 104 1618l40 89h13126c881-4817 1514-9676 1897-14558 9-134 25-269 35-402z"/><path class="fil11" d="M222759 141341c-9 15-16 31-24 46l24-44v-2z"/><path class="fil9" d="M164076 156710c705-661 1469-1257 2282-1780 809-520 1664-963 2555-1326 24-10 48-17 70-27 892-359 1816-634 2759-823l102-16c975-189 1966-286 2959-288 1031 0 2037 104 3012 296 25 5 48 6 73 10 977 196 1933 486 2856 865 1808 746 3463 1820 4879 3169l-12-27-10720-33129-10815 33076z"/><path class="fil8" d="M160267 174081c-376-914-662-1862-857-2831-5-21-6-43-9-63-305-1538-377-3113-213-4672 13-126 40-247 56-374 54-411 111-822 194-1222 25-116 63-228 87-345 96-405 198-810 323-1204 27-82 61-160 90-244 143-422 297-841 475-1246 20-47 46-91 67-138 195-437 407-867 642-1280l29-48c768-1345 1728-2570 2850-3638l-45496 11239h-87l45063 10999c-1362-1418-2447-3079-3198-4896-6-12-9-25-14-38z"/><path class="fil10" d="M262634 165557c29-203 72-393 107-591 113-647 248-1278 423-1876 20-68 28-144 48-211l5936-27182-2-15499c-4850-4006-10044-6196-15452-6196-6833 0-13205 3773-17969 8433-5213 5100-9242 11517-12500 17992-150 298-304 585-452 884 1004 870 1998 1751 2978 2648 2216 2034 4393 4110 6531 6225 997 985 1976 1990 2958 2991 1042 1061 2085 2120 3111 3198 1876 1971 3726 3967 5549 5987 1565 1726 3112 3467 4642 5222l2 3c257 268 437 461 506 539h13388c0-108 22-207 24-315 13-774 66-1529 170-2253zm-39861-24174l-14-40-24 44 59 57c-6-20-13-41-21-61z"/><path class="fil1" d="M61166 185121l120-299c1798-4665 3871-9218 6208-13637 362-687 716-1378 1091-2059 207-376 441-735 652-1111 951-1680 1908-3355 2936-4987 244-389 499-767 748-1151 1268-1970 2595-3902 3979-5792 120-164 233-336 354-500 1459-1950 2980-3854 4560-5707 336-396 669-794 1010-1187 1566-1796 3188-3541 4866-5233 331-331 668-654 1002-979 1774-1757 3612-3450 5509-5074l12-12c7488-25083 31668-40497 58779-40497 10911 0 21763 3144 31062 8833 9539 5835 16043 11535 21093 21500l76 150c128 253 271 495 396 750l13 25 30 20c4241 2624 8280 5559 12085 8782 1280 1080 2535 2189 3766 3326 406 372 824 727 1225 1106 8-16 14-31 24-46 4-11 9-21 14-31 138-283 274-570 413-849 3820-24111 15958-37257 28502-37257 9456 0 16330 5638 21521 20815l54 163 13 19c1531 1670 2960 3430 4280 5271l-3-2c28 37 56 70 83 108l-2-1 2 1c74 220 138 446 209 667v-1l-195-791c-15606-46200-59303-79463-110772-79463-64557 0-116891 52333-116891 116891 0 12727 2034 24979 5810 36380l15-67c1328-6150 3117-12191 5352-18072z"/><path class="fil6" d="M279397 168171l-4077 4561v-1l-9 30c-155 600-345 1160-555 1700-55 142-116 276-176 414-156 372-331 736-525 1090-100 185-199 372-307 546-169 271-352 517-536 759-255 335-537 648-844 936-121 113-239 237-366 339-306 243-637 452-987 624-585 285-1198 452-1836 452-3704 0-6708-5146-6708-11495h-13460l8 11c2529 2922 5018 5880 7466 8870 2353 2875 4677 5774 6972 8696l338 428c2174 2776 4329 5567 6464 8372l622 813c2267 2985 4520 5981 6759 8988 3939-11661 6008-23871 6130-36178l-3784-143-590 189z"/><path class="fil2" d="M149121 114187c305-24 609-42 913-63 2097-149 4198-226 6301-232 6339 0 12531 678 18554 1914h2c4251 1001 11798 3076 17401 5441 2351 993 4661 2078 6926 3254l514 280 139 78c210 117 439 244 707 396l18 10 1020 577 91 52c1440 816 3034 1732 3643 2081l156 90 111 64c-125-255-268-497-396-750l-76-150c-5050-9965-12823-18512-22362-24346-9300-5689-20151-8833-31064-8833-27109 0-50020 18261-57508 43344 7090-6053 14976-11159 23465-15035 9898-4518 20589-7348 31444-8172z"/><path class="fil7" d="M277637 129577l-1-1 1 1c-27-38-56-72-83-108l3 2c-1320-1841-2749-3601-4280-5271l-38-46c-652-708-1326-1396-2020-2064-256-246-522-461-781-697-428-389-854-791-1289-1148v15507l5937 27185v-2c65 211 143 409 200 628l4112 4608 41-46h4304c5-398 30-792 30-1191v-7c-2-12466-2002-24852-5924-36685v1c-72-220-135-446-210-667z"/><path class="fil2" d="M235727 122435c4764-4660 11135-8433 17969-8433 5407 0 10602 2190 15452 6196l2 47v8-8c435 357 861 759 1289 1148 259 236 525 451 781 697 694 667 1368 1356 2020 2064l38 46c-3-6-7-11-12-16l-1-1-54-164c-5191-15177-13568-25038-23021-25038-12545 0-23182 17370-27002 41480l40-34c3258-6475 7287-12892 12500-17992zm-16952 148185s-1689-1339-3833-3806c-998-1141-1928-2340-2785-3590-274-398-544-813-814-1240-811-1283-1458-2844-2172-4387-826-1787-828-2975-1302-4639-349-1226-626-2470-830-3728-329-2035-461-4096-394-6156 36-1189 159-2419 337-3672 177-1244 419-2478 726-3697 945-3780 2579-7806 5129-12056l648-1456c833-1388 1018-1327 1810-2664 11151-18819 17167-33050 14224-54961-323-2245-689-4483-1099-6713-257 1617-528 3231-814 4842-111 500-414 1043-529 1383-4844 14336-12469 24881-23440 36789-1528 1652-3074 3286-4638 4902-2794 2889-5618 5749-8470 8581-1187 1181-2398 2379-3630 3600-1131 1120-2539 3514-4219 5278-1037 2902-2215 6176-3211 9619-449-170-878-323-1335-500-21312-8243-35582-19258-35582-19258s10979 14296 29476 27715c1701 1232 3465 2374 5285 3422-763 12078 4565 23673 28616 27131 4067 585 8230 557 12424 85-42-125 235-122 212-191-23-70 224-256 224-256l-16-379z"/><path d="M205910 239530c21352 3445 52952 2880 85757-12479 791-370 1661 604 2452 216 0 0-22421 22900-49197 35846-783 378-1555 780-2345 1139-2587 1182-5219 2212-7861 3163-5181 1862-10431 3275-15643 3927-240 31-480 77-719 103-33-98-65-197-98-296l-35-108s-1690-1340-3835-3807c-999-1140-1928-2339-2784-3590-1195-1736-2241-3570-3126-5482-748-1615-1369-3285-1858-4996-919-3211-1332-6546-1225-9884 45-1229 157-2455 337-3672l180-81z" fill="#9e2154" fill-rule="nonzero"/><path class="fil11" d="M190607 215222c2853-2831 5677-5692 8471-8581 1564-1617 3110-3251 4638-4902 10970-11907 19023-23051 23868-37387 113-340 228-788 339-1292l52-233c113-535 224-1130 335-1801 44-462 1494-1394 1534-1828-1215-6242-4014-12805-7070-17815 7 20 15 41 21 61l-59-57c-401-379-819-733-1225-1106-1230-1137-2486-2245-3766-3326-3805-3223-7844-6158-12085-8782 214 3507 350 7011 387 10511 6 393-5 785-5 1177 7 1358 11 2717-15 4076-34 1750-95 3498-185 5246-66 1292-148 2581-248 3871-11 134-26 268-35 402-383 4882-1017 9741-1897 14558l-1542 7291c-3220 13055-9761 24896-15138 37122-1426 3242-2779 6521-3965 9861l-336 943c1412-1490 2844-2960 4297-4410 1233-1220 2444-2419 3630-3600z"/><path class="fil1" d="M120050 285434c7824-3461 15065-5634 23672-7331-43-1863-140-3725-292-5583 3677-9518 7067-19144 10167-28865-5483 534-10932 1376-16320 2522-3994 848-7934 1913-11841 3090-3139 945-6237 2031-9310 3186l12150 2943-9776 30685 1551-647z"/><path d="M270259 194503c-2135-2806-4289-5597-6464-8372l-338-428c-2323-2958-4676-5893-7059-8803-2420-2954-4880-5875-7379-8763-157-184-315-370-475-552-2059-2365-4150-4702-6271-7011-1294-1411-2600-2811-3920-4198-1029-1074-2066-2140-3111-3198-982-1001-1961-2006-2958-2991-2139-2115-4317-4190-6531-6225-981-896-1974-1780-2979-2650-6 10-10 20-14 31 2112 6070 4522 12216 5729 18547 314 1647 573 3249 784 4814 2943 21910-4078 36216-15228 55035-817 1375-1636 2748-2459 4120-2550 4252-4182 8277-5129 12057-306 1219-548 2453-725 3697 21866 3529 54746 4186 88388-12344 0 0-6598-9697-16525-23026-2223-2986-4461-5961-6712-8926-206-272-415-543-622-813z" fill="#df0067" fill-rule="nonzero"/><path class="fil3" d="M117337 291565l10937-36169-12150-2943c-2721 1022-5418 2112-8080 3297l-10832 35815 12093 189 8031-189z"/><path class="fil6" d="M125026 275917c1067 410 2154 780 3237 1159 12409 4355 25466 6576 38617 6572 14961 8 29782-2864 43656-8461 714-287 1413-602 2119-902 1144-486 2281-990 3410-1512 1008-469 2016-933 3008-1430-240 31-479 77-719 103-4194 472-8358 500-12424-85-24051-3458-29379-15054-28616-27131-1820-1047-3584-2189-5285-3422-18497-13419-29476-27715-29476-27715s14269 11015 35582 19258c457 177 885 330 1335 500 996-3443 2174-6716 3211-9619l336-943c1186-3340 2539-6619 3965-9861 5378-12227 11918-24068 15138-37122l1542-7291h-13154l-1 2 1 26-5 2c0 35 5 70 5 108 3 3129-931 6187-2682 8780-1707 2522-4106 4497-6909 5687-2441 1033-5106 1429-7742 1150-126-13-247-41-372-56-411-53-820-109-1217-191-112-25-219-60-330-86-409-94-818-195-1213-322-73-25-143-55-216-80-428-144-854-299-1266-479-38-15-73-35-109-52-444-196-878-413-1302-648l-20-12c-1348-760-2577-1714-3648-2831l-45062-10999H69240c-211 375-445 735-652 1111-375 681-729 1372-1091 2059-1209 2283-2346 4603-3411 6956-996 2200-1929 4428-2797 6681l-120 299c-2235 5881-4024 11922-5352 18072 7742 23615 22806 43906 42498 58208 573 415 1177 785 1758 1192 3332 2339 6784 4503 10342 6483 4707 2618 9590 4904 14615 6841z"/><path d="M242943 303873c-315-3126-479-6265-489-9406 0-1904-1544-3449-3448-3449H94329c-1905 0-3448 1544-3449 3449 0 3167-186 6299-490 9406-337 3414-858 6808-1561 10167 2098 1109 4212 2189 6363 3212 1438-6277 2281-12676 2515-19112 4-74 12-150 15-224h137891c3 74 11 150 13 224 236 6435 1079 12835 2517 19112 2144-1026 4265-2096 6363-3212-703-3358-1224-6752-1563-10167z" fill="#8a7460" fill-rule="nonzero"/></g></svg>`,
  magento: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1129.16 1333.33" fill-rule="evenodd" clip-rule="evenodd"><path d="M638.91 399.93v759.5l-74.69 45.65-74.75-45.89V400.52L295.93 519.68v649.51l268.28 164.15 270.55-165.32V519.27L638.89 399.94zM564.22 0L0 341.84v649.59l146.54 86.33V428.11l417.8-254.04 418.19 253.67 1.72.98-.19 648.07 145.1-85.36V341.84L564.23 0z" fill="#f26322" fill-rule="nonzero"/></svg>`,
  webflow: `<svg xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 512 319.382"><path fill="#146EF5" d="M512 0L348.627 319.382H195.172l68.375-132.364h-3.071C204.072 260.235 119.911 308.437 0 319.382V188.849s76.71-4.533 121.808-51.945H0V.007h136.897v112.594l3.071-.013L195.91.007h103.535V111.89l3.071-.006L360.557 0H512z"/></svg>`,
  wordpress: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#21759B"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">WP</text></svg>`,
  hubspot_cms: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#FF7A59"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">HS</text></svg>`,
  squarespace: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#000000"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">SQ</text></svg>`,
  wix: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#0C6EFC"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">WX</text></svg>`,
  unbounce: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#2542E7"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">UB</text></svg>`,
  instapage: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#1A82E2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">IP</text></svg>`,
  leadpages: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#7B2D8E"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">LP</text></svg>`,
  clickfunnels: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#F77F00"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">CF</text></svg>`,
  unknown: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 48 48"><defs><linearGradient id="a" x1="3.2173" y1="15" x2="44.7812" y2="15" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d93025"/><stop offset="1" stop-color="#ea4335"/></linearGradient><linearGradient id="b" x1="20.7219" y1="47.6791" x2="41.5039" y2="11.6837" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fcc934"/><stop offset="1" stop-color="#fbbc04"/></linearGradient><linearGradient id="c" x1="26.5981" y1="46.5015" x2="5.8161" y2="10.506" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e8e3e"/><stop offset="1" stop-color="#34a853"/></linearGradient></defs><circle cx="24" cy="23.9947" r="12" style="fill:#fff"/><path d="M3.2154,36A24,24,0,1,0,12,3.2154,24,24,0,0,0,3.2154,36ZM34.3923,18A12,12,0,1,1,18,13.6077,12,12,0,0,1,34.3923,18Z" style="fill:none"/><path d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z" style="fill:url(#a)"/><circle cx="24" cy="24" r="9.5" style="fill:#1a73e8"/><path d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z" style="fill:url(#b)"/><path d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z" style="fill:url(#c)"/></svg>`,
};
