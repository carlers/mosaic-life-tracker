import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate', // Automatically update the service worker when a new version is deployed
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Life Tracker',
        short_name: 'Mosaic',
        description: 'An offline-first, local-first life tracker PWA.',
        theme_color: '#111111', // Matches our dark mode background
        background_color: '#111111',
        display: 'standalone', // Hides the browser URL bar when installed
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Required for Android adaptive icons
          }
        ]
      },
      workbox: {
        // Cache all static assets and API calls for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sgp\.cloud\.appwrite\.io\/.*/i,
            handler: 'NetworkFirst', // Try network first, fallback to cache for Appwrite API
            options: {
              cacheName: 'appwrite-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          }
        ]
      }
    })
  ],
});