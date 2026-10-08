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
        background: 'var(--mosaic-bg)',
        surface: 'var(--mosaic-surface)',
        surfaceHighlight: 'var(--mosaic-surface-elevated)',
        mosaicText: 'var(--mosaic-text)',
        mosaicIncoming: 'var(--mosaic-chat-incoming)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}