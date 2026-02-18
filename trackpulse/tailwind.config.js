/** @type {import('tailwindcss').Config} */
export default {
  content: [
    'src/sidepanel/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        tp: {
          bg: '#0F0F10',
          surface: '#1A1A1E',
          'surface-hover': '#252529',
          border: '#2E2E34',
          primary: '#6C5CE7',
          success: '#00B894',
          warning: '#FDCB6E',
          error: '#FF6B6B',
          text: '#E8E8ED',
          'text-secondary': '#9B9BAE',
          'text-muted': '#5E5E72',
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
