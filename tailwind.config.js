/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B9FD9',
          dark: '#0883B8',
          light: '#3DB4E5'
        },
        secondary: {
          DEFAULT: '#F59120',
          dark: '#D67A0F',
          light: '#F7A849'
        },
        dark: {
          DEFAULT: '#2D3E50',
          light: '#3F5265'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    },
  },
  plugins: [],
}
