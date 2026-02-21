/** @type {import('tailwindcss').Config} */
export default {
  content: [
    'src/sidepanel/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        tp: {
          bg: 'var(--tp-bg)',
          surface: 'var(--tp-surface)',
          'surface-hover': 'var(--tp-surface-hover)',
          border: 'var(--tp-border)',
          primary: 'var(--tp-primary)',
          success: 'var(--tp-success)',
          warning: 'var(--tp-warning)',
          error: 'var(--tp-error)',
          text: 'var(--tp-text)',
          'text-secondary': 'var(--tp-text-secondary)',
          'text-muted': 'var(--tp-text-muted)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    }
  },
  plugins: []
};
