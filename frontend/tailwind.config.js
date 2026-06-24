/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f0ff',
          100: '#ede0ff',
          200: '#dcc5ff',
          300: '#c39aff',
          400: '#a463ff',
          500: '#8b30ff',
          600: '#7c10ff',
          700: '#6b00eb',
          800: '#5900c4',
          900: '#49009e',
          950: '#2d006b',
        },
        surface: {
          950: '#07000f',
          900: '#0e0019',
          800: '#160026',
          700: '#1e0033',
          600: '#280040',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'gradient-x': 'gradient-x 6s ease infinite',
        'float': 'float 4s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'slide-up': 'slide-up 0.6s ease forwards',
        'fade-in': 'fade-in 0.5s ease forwards',
        'pop-in': 'pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'reel-bg': 'reel-bg 1s ease forwards',
        'reel-hook': 'slide-up 0.7s 0.8s ease both',
        'reel-headline': 'slide-up 0.7s 1.5s ease both',
        'reel-sub': 'fade-in 0.7s 2.2s ease both',
        'reel-cta': 'pop-in 0.6s 2.8s cubic-bezier(0.34,1.56,0.64,1) both',
        'reel-tags': 'fade-in 0.7s 3.4s ease both',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'slide-up': {
          from: { transform: 'translateY(40px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pop-in': {
          from: { transform: 'scale(0.5)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'reel-bg': {
          from: { opacity: '0', transform: 'scale(1.05)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
      },
      backgroundSize: {
        '200': '200% 200%',
      },
    },
  },
  plugins: [],
}
