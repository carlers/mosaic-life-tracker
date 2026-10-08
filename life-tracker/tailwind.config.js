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
        mosaicPanel: 'var(--mosaic-surface)',
        mosaicRaised: 'var(--mosaic-surface-elevated)',
        mosaicPressed: 'var(--mosaic-surface-pressed)',
        mosaicBorder: 'var(--mosaic-border)',
        mosaicBorderStrong: 'var(--mosaic-border-strong)',
        mosaicText: 'var(--mosaic-text)',
        mosaicSecondary: 'var(--mosaic-text-secondary)',
        mosaicMuted: 'var(--mosaic-text-muted)',
        mosaicFaint: 'var(--mosaic-text-faint)',
        mosaicFloating: 'var(--mosaic-floating-surface)',
        mosaicHover: 'var(--mosaic-hover-wash)',
        mosaicChatIncoming: 'var(--mosaic-chat-incoming)',
        mosaicChatOutgoing: 'var(--mosaic-chat-outgoing)',
        mosaicChatQuoteIncoming: 'var(--mosaic-chat-quote-incoming)',
        mosaicChatQuoteOutgoing: 'var(--mosaic-chat-quote-outgoing)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}