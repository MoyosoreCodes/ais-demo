/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Government-service neutral palette (CLAUDE.md §2).
        // Deliberately NOT Cutting-Edge's pink bid-template branding.
        brand: {
          50: '#EAF5F1',
          100: '#CFE8DF',
          200: '#A2D2C2',
          300: '#6FB8A2',
          400: '#3F9A80',
          500: '#1B7D62',
          600: '#0F6B4F',
          700: '#0C5540',
          800: '#094131',
          900: '#062B21',
        },
        warn: {
          50: '#FEF6E7',
          100: '#FCE9C4',
          200: '#F8D08A',
          500: '#C77700',
          600: '#A85F00',
          700: '#7C4600',
        },
        danger: {
          50: '#FDECEC',
          100: '#FAD4D4',
          200: '#F3A9A9',
          500: '#C62828',
          600: '#A81E1E',
          700: '#7F1616',
        },
        ink: {
          50: '#F7F8F8',
          100: '#EDEFEF',
          200: '#DCE0E0',
          300: '#B9C0C0',
          400: '#8B9494',
          500: '#68716F',
          600: '#4B5352',
          700: '#363C3B',
          800: '#232827',
          900: '#141817',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
