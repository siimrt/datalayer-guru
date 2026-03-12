import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

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
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        report: 'src/report/index.html',
      }
    }
  }
});
