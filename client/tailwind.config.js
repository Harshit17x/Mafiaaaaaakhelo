import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default {
  content: [
    path.join(dir, 'index.html'),
    path.join(dir, 'src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          950: '#060911',
          900: '#0b101d',
          800: '#121a2d',
          700: '#1c2740',
          600: '#273554',
        },
        gold: {
          200: '#f5dfb0',
          300: '#e8c67a',
          400: '#ddb55e',
          500: '#d4a84f',
          600: '#b38936',
          700: '#8a6723',
        },
        crimson: {
          400: '#e04f5b',
          500: '#c92a37',
          600: '#9f1d28',
          800: '#621017',
          900: '#3f0a0f',
        },
        cream: {
          50: '#f7f3eb',
          100: '#ece4d4',
          300: '#cec4b0',
          400: '#a99f8c',
          600: '#726a5c',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', '"Playfair Display"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
