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
        },
        'stormy-teal': {
          DEFAULT: '#006d77',
          600: '#00b4c4',
          700: '#005a63',
        },
        'pearl-aqua': {
          DEFAULT: '#83c5be',
        },
        'alice-blue': {
          DEFAULT: '#edf6f9',
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
