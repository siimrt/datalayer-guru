# CLAUDE.md — Traacky Extension

## Branding

- **Nom du produit** : **Traacky** (jamais "TrackPulse" — ancien nom, historique git uniquement)
- Les préfixes internes `TRACKPULSE_` et `__TRACKPULSE_*__` dans le code sont conservés par rétro-compatibilité, ne pas les renommer
- Les variables CSS utilisent le préfixe `--tp-*`
- Les logs console sont préfixés `[Traacky]`

## Architecture du projet

### Monorepo `datalayer-guru/`

```
datalayer-guru/
├── trackpulse/          ← Extension Chrome (ce projet)
├── web/                 ← Site marketing (Next.js 16, React 19, static export)
└── chrome-store-assets/ ← Visuels Chrome Web Store
```

### Extension Chrome MV3

```
src/
├── background/          # Service worker (lifecycle, routing messages, licensing)
├── content/             # Content scripts injectés dans les pages web
│   ├── detectors/       # Détection CMS, pixels, page type, site type, forms, leadgen
│   ├── extractors/      # Extraction données e-commerce (factory pattern, un par CMS)
│   ├── generators/      # Génération événements (GA4, Meta, TikTok, Pinterest)
│   ├── auditor/         # Audit dataLayer, diff engine, consent checker
│   ├── parsers/         # Parsing requêtes réseau (network requests)
│   ├── bridge.js        # Bridge message page ↔ content ↔ background
│   ├── index.js         # Orchestrateur content script (pipeline de détection)
│   ├── page-context-script.js     # Injecté dans MAIN world
│   ├── early-network-hooks.js     # Interception réseau (document_start, isolated)
│   └── early-network-hooks-main.js # Interception réseau (document_start, MAIN world)
├── sidepanel/           # UI principale (side panel Chrome)
│   ├── main.js          # Orchestrateur, state management, routing messages
│   ├── styles.css       # Styles Tailwind + custom properties
│   ├── index.html       # Point d'entrée HTML
│   ├── components/      # Composants UI (render functions, pas de framework)
│   └── utils/           # Utilitaires sidepanel (network audit/pixel enhancer)
├── shared/              # Modules partagés entre toutes les couches
│   ├── constants.js     # CMS, PAGE_TYPES, SITE_TYPES, PLATFORMS, CMS_SIGNALS, poids
│   ├── messaging.js     # Types de messages (MSG), sendMessage, onMessage
│   ├── plans.js         # Définitions plans (free/starter/pro/agency)
│   ├── analytics.js     # PostHog (posthog-js-lite, MV3-safe)
│   ├── utils.js         # Helpers (safeJsonParse, formatPrice, escapeHtml, etc.)
│   ├── canonical-audit.js # Mappings événements canoniques par plateforme
│   └── platform-icons.js # Icônes SVG plateformes
├── licensing/           # Gestion abonnements (ExtensionPay)
│   ├── plan-manager.js  # Singleton, gestion état plan
│   ├── feature-gates.js # Contrôle accès fonctionnalités par plan
│   ├── usage-tracker.js # Suivi usage par plan
│   └── extpay-content.js
├── report/              # Page rapport (entrée HTML séparée)
├── export/              # Export PDF (html2pdf.js)
├── stubs/               # Stubs pour réduire la taille du bundle (canvg, dompurify)
└── assets/              # Icônes extension + icônes plateformes SVG
```

### Pipeline de détection (content/index.js)

L'exécution suit un pipeline strict en 5 phases :

1. **Phase 1 (sync)** : `detectCMS()` → `detectPageType()` — scoring multi-signaux
2. **Phase 2 (parallel)** : Extraction données, pixels, site type, forms, leadgen, consent
3. **Phase 3 (serial)** : Génération événements GA4/Meta/TikTok/Pinterest
4. **Phase 4 (audit)** : Audit dataLayer existant + diff engine
5. **Phase 5 (broadcast)** : Envoi résultats au background → sidepanel

### Communication entre couches

```
Page World (MAIN)  ←postMessage→  Content Script (ISOLATED)
                                        ↕ chrome.runtime.sendMessage
                                  Background (Service Worker)
                                        ↕ chrome.runtime.sendMessage
                                  SidePanel UI
```

Types de messages définis dans `src/shared/messaging.js` (objet `MSG`).

## Tech Stack

| Composant | Technologie |
|-----------|-------------|
| Runtime | Chrome Extensions Manifest V3 |
| Langage | **Vanilla JavaScript ES2020+** (pas de framework) |
| Build | Vite 5.4 + `@crxjs/vite-plugin` (beta 25) |
| Styles | Tailwind CSS 3.4 + PostCSS + Autoprefixer |
| Analytics | PostHog via `posthog-js-lite` 4.5 (MV3-compliant) |
| Licensing | ExtensionPay (`extpay` 3.1) |
| PDF | `html2pdf.js` 0.14 (tree-shaken, stubs canvg/dompurify) |
| Module system | ESM (`"type": "module"`) |

## Conventions de code

### Style général

- **Vanilla JS** — pas de React, pas de framework. Les composants sont des fonctions `render*()` qui reçoivent `(container, state, actions)` et écrivent du HTML via `innerHTML`
- **ES modules** avec extensions `.js` explicites dans tous les imports
- **Nommage** : camelCase pour variables/fonctions, PascalCase pour fichiers composants et classes
- **Commentaires** en anglais, JSDoc sur les fonctions principales
- **Séparateurs de sections** : `// --- Description ---` ou `// ─── Description ───`

### Pattern composant sidepanel

```javascript
export function renderComponentName(container, state, actions) {
  container.innerHTML = `<div>...</div>`;
  // Attacher les event listeners après le rendu
  container.querySelector('.btn').addEventListener('click', () => {
    actions.onSomething();
  });
}
```

### Sécurité & robustesse

- **Toujours** wrapper les opérations DOM/JSON dans try-catch
- Utiliser `safeJsonParse()`, `safeQuerySelector()`, `safeClone()` de `shared/utils.js`
- Les messages chrome échouent silencieusement (contexte invalidé après update)
- Ne jamais laisser une erreur casser l'app — log et continue

### Imports

```javascript
// 1. Dépendances externes (rare)
import PostHog from 'posthog-js-lite';

// 2. Modules partagés
import { MSG, sendMessage } from '../shared/messaging.js';
import { CMS, PAGE_TYPES, PLATFORMS } from '../shared/constants.js';

// 3. Modules locaux
import { GA4Generator } from './generators/ga4-generator.js';
```

### CSS & Theming

- Tailwind CSS avec custom properties `--tp-*` pour le theming
- Light mode (`:root`) + Dark mode (`html.dark`)
- Palette principale : `#006d77` (stormy teal), `#83c5be` (pearl aqua)
- Polices : Inter (sans), JetBrains Mono (mono)
- Animations custom : `pulse-custom`, `slide-in`
- Scrollbar custom webkit

## Commits

Format : `type: description — contexte additionnel`

- `feat:` pour les nouvelles fonctionnalités
- `fix:` pour les corrections de bugs
- Descriptions concises, en anglais
- Pas de scope conventionnel (pas de `feat(sidepanel):`)

## Build & Dev

```bash
npm run dev      # Vite dev server + hot reload (charge l'extension depuis dist/)
npm run build    # Build production → dist/
npm run zip      # Zip dist/ → traacky.zip (pour Chrome Web Store)
```

### Particularités Vite

- `stripRemoteCode()` : plugin custom qui retire les URLs CDN de html2pdf (compliance MV3 — pas de remote code)
- Alias : `html2pdf.js` → source non-bundlée (tree-shaking), `canvg` → stub, `dompurify` → stub
- Deux entry points : `sidepanel/index.html` + `report/index.html`
- Chunk warning limit : 700KB

## Système de plans & licensing

| | Free | Starter ($9/m) | Pro ($19/m) | Agency ($49/m) |
|---|---|---|---|---|
| CMS/Page detection | ✓ | ✓ | ✓ | ✓ |
| GA4 generation | ✓ | ✓ | ✓ | ✓ |
| Meta events | ✗ | ✓ | ✓ | ✓ |
| TikTok/Pinterest | ✗ | ✗ | ✓ | ✓ |
| Copy events | ✗ | ✓ | ✓ | ✓ |
| Push events | ✗ | ✗ | ✓ | ✓ |
| Audit diff | ✗ | ✗ | ✓ | ✓ |
| Funnel mode | ✗ | ✗ | ✓ | ✓ |
| PDF export | ✗ | ✗ | ✓ | ✓ |
| White label PDF | ✗ | ✗ | ✗ | ✓ |

Feature gates dans `src/licensing/feature-gates.js`. En dev (extension non packagée), toutes les features sont débloquées.

## Plateformes supportées

### CMS / Frameworks détectés

Shopify, WooCommerce, PrestaShop, Magento, Webflow, WordPress, Next.js, Nuxt.js, React, Vue, Angular, Gatsby, Remix, SvelteKit, Astro, Laravel, PHP, HubSpot CMS, Squarespace, Wix, Unbounce, Instapage, Leadpages, ClickFunnels

### Pixels / Plateformes tracking

GA4, Google Ads, Meta (Facebook), TikTok, Pinterest, Snapchat, LinkedIn, Twitter

## État du projet

- **Version** : 2.0.1
- **Pas de tests automatisés** — tests manuels uniquement
- **Pas d'i18n** — interface en anglais uniquement
- **Pas d'ESLint/Prettier** configuré sur l'extension (le projet web a ESLint)

## Environnement

- `.env.local` contient les clés PostHog (`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`)
- Ne jamais commiter `.env.local` ou `.env`
- PostHog EU : `https://eu.i.posthog.com`

## Documentation plateformes (docs/platforms/)

Référence complète sur les pixels et APIs server-side des plateformes tracking supportées. **Consulter ces docs** avant toute modification du parsing réseau, de l'audit qualité, ou de la détection de déduplication.

- `docs/platforms/README.md` — Index + tableau de synthèse cross-platform (dedup, click IDs, priorités de checks)
- `docs/platforms/meta.md` — Meta/Facebook Pixel + CAPI (eid, EMQ, advanced matching)
- `docs/platforms/tiktok.md` — TikTok Pixel + Events API (event_id, _ttp, ttclid)
- `docs/platforms/pinterest.md` — Pinterest Tag + Conversions API (event_id, _epik, epik)
- `docs/platforms/snapchat.md` — Snapchat Pixel + Conversions API (client_dedup_id, ScCid)
- `docs/platforms/linkedin.md` — LinkedIn Insight Tag + Conversions API (eventId, li_fat_id)
- `docs/platforms/google-ads.md` — Google Ads Conversion Tag + Enhanced Conversions (oid, gclid)
- `docs/platforms/ga4.md` — GA4 gtag.js + Measurement Protocol (transaction_id, pas de dedup natif browser/server)

## Points d'attention

- Le service worker MV3 a un lifecycle limité — pas de state persistant, utiliser `chrome.storage.local`
- Les content scripts tournent dans un monde isolé sauf `page-context-script.js` et `early-network-hooks-main.js` (MAIN world)
- L'injection page context utilise `web_accessible_resources` dans le manifest
- `@crxjs/vite-plugin` est en beta — peut avoir des bugs de HMR, restart le dev server si besoin
- Les stubs (`src/stubs/`) sont critiques pour la taille du bundle — ne pas supprimer
- ExtensionPay ID : `datalayer-guru`
