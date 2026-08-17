/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: '#1a1a1a',
        'gray-light': '#f5f5f5',
        'purple-light': '#e8d5f2',
        purple: '#c4a7d6',
        orange: '#ff9800',
        'green-dark': '#1b5e20',
        alert: '#f44336',
        gray: { DEFAULT: '#666666' },
        danger: '#f44336',
      },
      borderWidth: {
        3: '3px',
      },
      fontFamily: {
        heading: ['Mali', 'cursive'],
        body: ['Mitr', 'sans-serif'],
        mono: ['Bai Jamjuree', 'sans-serif'],
        mali: ['Mali', 'cursive'],
        mitr: ['Mitr', 'sans-serif'],
      },
      fontSize: {
        h1: ['32px', { lineHeight: '1.25', fontWeight: '700' }],
        h2: ['26px', { lineHeight: '1.25', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '1.3', fontWeight: '700' }],
        body: ['16px', { lineHeight: '1.5' }],
        badge: ['11px', { lineHeight: '1', fontWeight: '700' }],
      },
      boxShadow: {
        card: '8px 8px 0 rgba(0,0,0,0.2)',
        'card-hover': '12px 12px 0 rgba(0,0,0,0.25)',
        hero: '0 6px 0 rgba(0,0,0,0.15)',
        navbar: '0 4px 0 rgba(0,0,0,0.1)',
        offset: '8px 8px 0 rgba(0,0,0,0.2)',
        'offset-hover': '12px 12px 0 rgba(0,0,0,0.25)',
        'offset-sm': '5px 5px 0 rgba(0,0,0,0.15)',
        'offset-sm-hover': '6px 8px 0 rgba(0,0,0,0.2)',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #e8d5f2 0%, #c4a7d6 100%)',
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
}
