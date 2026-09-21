import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import posthog from '@posthog/rollup-plugin';

const posthogSourceMapsEnabled = Boolean(
  process.env.POSTHOG_PERSONAL_API_KEY &&
    process.env.POSTHOG_PROJECT_ID &&
    process.env.POSTHOG_HOST
);

const posthogSourceMapPlugin = posthogSourceMapsEnabled
  ? posthog({
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      projectId: process.env.POSTHOG_PROJECT_ID!,
      host: process.env.POSTHOG_HOST!,
      sourcemaps: {
        enabled: true,
        releaseMode: 'event',
        deleteAfterUpload: true,
      },
    })
  : null;

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    ...(posthogSourceMapPlugin ? [posthogSourceMapPlugin] : []),
    VitePWA({
      // Keep an installed update waiting until the old worker controls no
      // clients: close all Mosaic tabs and installed-app windows, then reopen.
      // A refresh alone may leave the old worker active. `autoUpdate` forces
      // both activation flags below to true, so use `prompt` (PWA-4).
      // The explicit lifecycle below surfaces the waiting worker and only
      // requests activation after the user chooses Update now.
      registerType: 'prompt',
      // Registration is owned by src/lib/pwaLifecycle.ts so Mosaic can show
      // explicit install/update UI instead of injecting a second registrar.
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Life Tracker',
        short_name: 'Mosaic',
        description: 'An offline-first, local-first life tracker PWA.',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'portrait',
        id: '/',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'lifestyle'],
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
        // a second cache for either — see PWA-1 and docs/PROJECT_REFERENCE.md §15
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
        // Preserve the current worker while it still controls open clients.
        // See the registerType comment above (PWA-4).
        skipWaiting: false,
        clientsClaim: false,
      }
    })
  ],
  build: {
    sourcemap: posthogSourceMapsEnabled ? 'hidden' : false,
  },
});
