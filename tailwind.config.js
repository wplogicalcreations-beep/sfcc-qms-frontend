/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0D1B2A', 50: '#E8EEF4', 100: '#B8CBE0', 200: '#6B9ABF', 300: '#2C6D9E', 400: '#1A4F7A', 500: '#0D3357', 600: '#0D1B2A' },
        gold: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
      }
    }
  },
  plugins: []
};
