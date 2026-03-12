/**
 * Form Detector — Detects forms on the page, identifies their builder,
 * classifies their purpose, analyzes fields, and checks for UTM/GCLID capture.
 */

const FORM_BUILDERS = {
  gravity_forms: {
    name: 'Gravity Forms',
    selectors: '.gform_wrapper, .gfield, form[id^="gform_"]',
    idPattern: /gform_(\d+)/,
  },
  wpforms: {
    name: 'WPForms',
    selectors: '.wpforms-container, .wpforms-form, form[id^="wpforms-form-"]',
    idPattern: /wpforms-form-(\d+)/,
  },
  cf7: {
    name: 'Contact Form 7',
    selectors: '.wpcf7, .wpcf7-form, form.wpcf7-form',
    idPattern: /wpcf7-f(\d+)/,
  },
  ninja_forms: {
    name: 'Ninja Forms',
    selectors: '.nf-form-cont, .ninja-forms-cont, form.nf-form',
    idPattern: /nf-form-(\d+)/,
  },
  hubspot_forms: {
    name: 'HubSpot Forms',
    selectors: '.hbspt-form, .hs-form, form[data-form-id], form.hs-form-private',
    idPattern: /hs-form-([a-f0-9-]+)/,
  },
  typeform: {
    name: 'Typeform',
    selectors: '[data-tf-widget], [data-tf-popup], .typeform-widget, iframe[src*="typeform.com"]',
    idPattern: null,
  },
  formidable: {
    name: 'Formidable Forms',
    selectors: '.frm_forms, .frm_form_fields, form.frm-show-form',
    idPattern: /frm_form_(\d+)/,
  },
  elementor_forms: {
    name: 'Elementor Forms',
    selectors: '.elementor-form, form.elementor-form',
    idPattern: null,
  },
  mailchimp: {
    name: 'Mailchimp',
    selectors: '#mc_embed_signup, form[action*="list-manage.com"], .mc-embedded-subscribe-form',
    idPattern: null,
  },
  convertkit: {
    name: 'ConvertKit',
    selectors: '.formkit-form, form[data-sv-form], [data-formkit-toggle]',
    idPattern: null,
  },
};

const PURPOSE_KEYWORDS = {
  contact: {
    urlPatterns: [/contact/, /kontakt/, /nous-contacter/],
    headingPatterns: [/contact\s*us/i, /get\s*in\s*touch/i, /reach\s*out/i, /nous\s*contacter/i],
    fieldPatterns: [/message/, /comment/, /inquiry/],
  },
  demo: {
    urlPatterns: [/demo/, /book-a-demo/, /request-demo/],
    headingPatterns: [/request\s*(a\s*)?demo/i, /book\s*(a\s*)?demo/i, /schedule\s*(a\s*)?demo/i],
    fieldPatterns: [/company[-_]?size/, /role/, /job[-_]?title/],
  },
  newsletter: {
    urlPatterns: [/newsletter/, /subscribe/],
    headingPatterns: [/subscribe/i, /newsletter/i, /stay\s*updated/i, /join\s*our/i],
    fieldPatterns: [],
  },
  quote: {
    urlPatterns: [/quote/, /devis/, /estimate/],
    headingPatterns: [/get\s*(a\s*)?quote/i, /request\s*(a\s*)?quote/i, /free\s*estimate/i, /demander\s*un\s*devis/i],
    fieldPatterns: [/budget/, /project[-_]?type/, /service/],
  },
  signup: {
    urlPatterns: [/sign[-_]?up/, /register/, /create[-_]?account/],
    headingPatterns: [/sign\s*up/i, /create\s*(an?\s*)?account/i, /register/i, /get\s*started/i],
    fieldPatterns: [/password/, /confirm[-_]?password/],
  },
  lead: {
    urlPatterns: [/lead/, /whitepaper/, /ebook/, /download/],
    headingPatterns: [/download/i, /get\s*(the|your)\s*(free)?/i, /whitepaper/i, /ebook/i],
    fieldPatterns: [/company/, /industry/],
  },
};

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const CLICK_ID_PARAMS = ['gclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id'];

export class FormDetector {
  /**
   * Detect all forms on the page.
   *
   * @returns {Array<{
   *   builder: string|null,
   *   builderName: string|null,
   *   purpose: string,
   *   fields: string[],
   *   hasEmail: boolean,
   *   hasPhone: boolean,
   *   hasName: boolean,
   *   capturesUtm: boolean,
   *   capturesClickIds: boolean,
   *   utmFields: string[],
   *   clickIdFields: string[],
   *   formId: string|null,
   *   action: string|null,
   * }>}
   */
  detect() {
    const results = [];
    const forms = document.querySelectorAll('form');

    for (const form of forms) {
      // Skip hidden/tiny forms (search bars, login, etc.)
      if (this._isIgnorable(form)) continue;

      const builder = this._detectBuilder(form);
      const fields = this._extractFields(form);
      const purpose = this._classifyPurpose(form, fields);
      const utmAnalysis = this._analyzeUtmCapture(form);

      results.push({
        builder: builder?.key || null,
        builderName: builder?.name || null,
        purpose,
        fields: fields.map((f) => f.name || f.type),
        hasEmail: fields.some((f) => f.type === 'email' || /email/i.test(f.name)),
        hasPhone: fields.some((f) => f.type === 'tel' || /phone|tel/i.test(f.name)),
        hasName: fields.some((f) => /name/i.test(f.name) && !/user|company/i.test(f.name)),
        capturesUtm: utmAnalysis.capturesUtm,
        capturesClickIds: utmAnalysis.capturesClickIds,
        utmFields: utmAnalysis.utmFields,
        clickIdFields: utmAnalysis.clickIdFields,
        formId: form.id || null,
        action: form.action || null,
      });
    }

    // Also detect embedded Typeform / Calendly iframes
    this._detectEmbeddedForms(results);

    return results;
  }

  _isIgnorable(form) {
    const rect = form.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return true;

    // Skip search forms
    const inputs = form.querySelectorAll('input');
    if (inputs.length === 1) {
      const input = inputs[0];
      if (input.type === 'search' || /search/i.test(input.name || input.placeholder || '')) {
        return true;
      }
    }

    // Skip login forms (just email/username + password)
    const visibleInputs = [...form.querySelectorAll('input:not([type="hidden"])')];
    if (visibleInputs.length <= 2) {
      const hasPassword = visibleInputs.some((i) => i.type === 'password');
      if (hasPassword) return true;
    }

    return false;
  }

  _detectBuilder(form) {
    // Walk up to check wrapper elements too
    const html = form.outerHTML + (form.parentElement?.outerHTML || '');

    for (const [key, builder] of Object.entries(FORM_BUILDERS)) {
      try {
        const match = form.closest(builder.selectors) || form.querySelector(builder.selectors);
        if (match || document.querySelector(builder.selectors)?.contains(form)) {
          let formId = null;
          if (builder.idPattern) {
            const idMatch = html.match(builder.idPattern);
            if (idMatch) formId = idMatch[1];
          }
          return { key, name: builder.name, formId };
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    return null;
  }

  _extractFields(form) {
    const fields = [];
    const inputs = form.querySelectorAll('input, select, textarea');

    for (const input of inputs) {
      const type = input.type || 'text';
      if (type === 'submit' || type === 'button' || type === 'hidden') continue;

      fields.push({
        name: input.name || input.id || input.placeholder || '',
        type,
        required: input.required || input.hasAttribute('aria-required'),
      });
    }

    return fields;
  }

  _classifyPurpose(form, fields) {
    const pathname = window.location.pathname;
    const formText = (form.textContent || '').slice(0, 1000);

    // Check URL patterns first
    for (const [purpose, config] of Object.entries(PURPOSE_KEYWORDS)) {
      for (const pattern of config.urlPatterns) {
        if (pattern.test(pathname)) return purpose;
      }
    }

    // Check heading text near the form
    for (const [purpose, config] of Object.entries(PURPOSE_KEYWORDS)) {
      for (const pattern of config.headingPatterns) {
        if (pattern.test(formText)) return purpose;
      }
    }

    // Check field names
    for (const [purpose, config] of Object.entries(PURPOSE_KEYWORDS)) {
      for (const pattern of config.fieldPatterns) {
        if (fields.some((f) => pattern.test(f.name))) return purpose;
      }
    }

    // Heuristic: email-only = newsletter, email + message = contact
    const hasMessage = fields.some((f) => f.type === 'textarea' || /message|comment/i.test(f.name));
    const hasEmail = fields.some((f) => f.type === 'email' || /email/i.test(f.name));

    if (hasEmail && !hasMessage && fields.length <= 3) return 'newsletter';
    if (hasEmail && hasMessage) return 'contact';

    return 'unknown';
  }

  _analyzeUtmCapture(form) {
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    const utmFields = [];
    const clickIdFields = [];

    for (const input of hiddenInputs) {
      const name = (input.name || '').toLowerCase();
      for (const utm of UTM_PARAMS) {
        if (name.includes(utm)) utmFields.push(utm);
      }
      for (const cid of CLICK_ID_PARAMS) {
        if (name.includes(cid)) clickIdFields.push(cid);
      }
    }

    return {
      capturesUtm: utmFields.length > 0,
      capturesClickIds: clickIdFields.length > 0,
      utmFields,
      clickIdFields,
    };
  }

  _detectEmbeddedForms(results) {
    // Typeform embeds
    const typeformEls = document.querySelectorAll(
      '[data-tf-widget], [data-tf-popup], iframe[src*="typeform.com"]'
    );
    if (typeformEls.length > 0 && !results.some((r) => r.builder === 'typeform')) {
      results.push({
        builder: 'typeform',
        builderName: 'Typeform',
        purpose: 'unknown',
        fields: [],
        hasEmail: false,
        hasPhone: false,
        hasName: false,
        capturesUtm: false,
        capturesClickIds: false,
        utmFields: [],
        clickIdFields: [],
        formId: null,
        action: null,
      });
    }

    // Calendly embeds
    const calendlyEls = document.querySelectorAll(
      '.calendly-inline-widget, [data-url*="calendly.com"], iframe[src*="calendly.com"]'
    );
    if (calendlyEls.length > 0) {
      results.push({
        builder: 'calendly_embed',
        builderName: 'Calendly',
        purpose: 'demo',
        fields: [],
        hasEmail: false,
        hasPhone: false,
        hasName: false,
        capturesUtm: false,
        capturesClickIds: false,
        utmFields: [],
        clickIdFields: [],
        formId: null,
        action: null,
      });
    }
  }
}
