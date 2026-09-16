import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      // `autoUpdate` is retained, but `skipWaiting` / `clientsClaim` are
      // disabled below so the new SW does NOT take over mid-session.
      // Without that, a deploy landing during an in-flight RxDB write can
      // orphan the transaction (the new bundle and the new SW arrive at
      // the same time). The new SW waits until the tab is fully closed
      // and reopened. A "New version available" prompt UI would let us
      // update sooner, but that is Phase 3.5+ feature work (PWA-4).
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Life Tracker',
        short_name: 'Mosaic',
        description: 'An offline-first, local-first life tracker PWA.',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
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
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Precache the app shell only. Data is RxDB + the sync engine;
        // images are `src/lib/imageCache.ts`. The SW is deliberately not
        // a second cache for either — see PWA-1 and AGENTS.md §15
        // (`imageCache.ts` is the single owner of the blob cache).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,wasm}'],
        // SPA routes: cold-loading `/messages/abc123` offline must serve
        // the app shell, not a 404 from the SW. The denylist keeps any
        // `/v1/*` (Appwrite REST) or `/api/*` path from being rewritten
        // to index.html. Cross-origin Appwrite calls are not matched by
        // this SW's navigation handler, but the denylist documents
        // intent and guards against a future same-origin proxy (PWA-3).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/v1\//, /^\/api\//],
        // Do not take over the page mid-session. Applies on next full
        // relaunch. See registerType comment above (PWA-4).
        skipWaiting: false,
        clientsClaim: false,
      }
    })
  ],
});
