/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Government-service neutral: deep green/teal primary (#0F6B4F).
        // Deliberately NOT Cutting-Edge's pink bid branding.
        primary: {
          50: '#ECF7F2',
          100: '#CFE9DF',
          200: '#9FD3BF',
          300: '#63B79A',
          400: '#2E9576',
          500: '#158060',
          600: '#0F6B4F',
          700: '#0C563F',
          800: '#0A4230',
          900: '#072F22',
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
};
