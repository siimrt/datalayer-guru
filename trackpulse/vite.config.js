import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import manifest from './manifest.json';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Strip remote CDN URLs from jsPDF to comply with Chrome Web Store MV3 policy
// (jsPDF embeds a pdfobject CDN URL that we never use, but Google flags it)
function stripRemoteCode() {
  return {
    name: 'strip-remote-code',
    transform(code, id) {
      if (id.includes('jspdf') || id.includes('html2pdf')) {
        return code.replace(
          /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[^"']*/g,
          ''
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [stripRemoteCode(), crx({ manifest })],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        report: 'src/report/index.html',
      },
    },
  },
  resolve: {
    alias: {
      // Point html2pdf.js to its unbundled source so Vite can tree-shake and
      // our canvg/dompurify stubs take effect (the dist/ build inlines everything).
      'html2pdf.js': resolve(__dirname, 'node_modules/html2pdf.js/src/index.js'),
      // Stub out heavy sub-dependencies of html2pdf.js/jsPDF that we never use.
      // canvg (1.9 MB) = SVG→Canvas rendering, only needed for jsPDF.addSvgAsImage()
      // dompurify (736 KB) = HTML sanitization, unnecessary since we generate safe HTML
      'canvg': resolve(__dirname, 'src/stubs/canvg.js'),
      'dompurify': resolve(__dirname, 'src/stubs/dompurify.js'),
    },
  },
});
