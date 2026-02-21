import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F1A',
        surface: '#0F172A',
        'surface-alt': '#111827',
        gold: '#D4AF37',
        'gold-muted': '#B8962E',
        muted: '#9CA3AF',
      },
    },
  },
  plugins: [],
};
export default config;
