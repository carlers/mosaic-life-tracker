/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We will force dark mode
  theme: {
    extend: {
      colors: {
        background: '#111111', // Deep dark background
        surface: '#1E1E1E',    // Slightly lighter for cards/sheets
        surfaceHighlight: '#2A2A2A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}