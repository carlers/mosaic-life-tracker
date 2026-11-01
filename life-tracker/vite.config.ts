import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { assertPreviewBackendIsolation, assertProductionBackendIsolation } from './scripts/lib/preview-backend-isolation.ts';

const verifiedPreviewBackend = assertPreviewBackendIsolation(process.env);
if (verifiedPreviewBackend) {
  console.info(`[Mosaic] Preview backend: scratch Appwrite ${verifiedPreviewBackend.projectId} (${verifiedPreviewBackend.endpoint})`);
}

// Effective non-secret feature presence is logged on every hosted build so
// identical-tree deployments can be compared without exposing Vite API keys.
if (process.env.VERCEL_ENV || process.env.GITHUB_ACTIONS === 'true') {
  console.info('[Mosaic] Build features: GIPHY stickers ' +
    (process.env.VITE_GIPHY_API_KEY?.trim() ? 'enabled' : 'disabled'));
  console.info('[Mosaic] Build runtime: Node.js ' + process.versions.node);
}

const isLocalBuild = !process.env.VERCEL_ENV;
const isOfficialMosaicBuild =
  process.env.GITHUB_REPOSITORY === 'carlers/mosaic-life-tracker' ||
  process.env.VERCEL_PROJECT_ID === 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';

if (isOfficialMosaicBuild) {
  const verifiedProductionBackend = assertProductionBackendIsolation(process.env);
  if (verifiedProductionBackend) {
    console.info('[Mosaic] Production backend: production Appwrite');
  }
}

const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || '';
const buildMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE?.trim() || '';
const buildRef = process.env.VERCEL_GIT_COMMIT_REF?.trim() || '';
const vercelEnvironment = process.env.VERCEL_ENV?.trim() || '';
const buildChannel =
  buildRef === 'preview' || vercelEnvironment === 'preview'
    ? 'Preview'
    : vercelEnvironment === 'production'
      ? 'Production'
      : 'Local';

const embeddedBuildInfo = JSON.stringify({
  commit: buildCommit || null,
  commitMessage: buildMessage || null,
  branch: buildRef || null,
  builtAt: new Date().toISOString(),
  channel: buildChannel,
});

const buildInfoMetaPlugin = {
  name: 'mosaic-build-info-meta',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: {
          name: 'mosaic-build-info',
          content: embeddedBuildInfo,
        },
        injectTo: 'head' as const,
      },
    ];
  },
};

const posthogSourceMapsEnabled =
  vercelEnvironment !== 'preview' &&
  process.env.POSTHOG_SOURCE_MAPS_ENABLED === 'true' &&
  Boolean(
    process.env.POSTHOG_PERSONAL_API_KEY &&
      process.env.POSTHOG_PROJECT_ID &&
      process.env.POSTHOG_HOST
  );

const posthogPluginPackage = ['@posthog', 'rollup-plugin'].join('/');
const posthog = posthogSourceMapsEnabled
  ? (await import(posthogPluginPackage)).default
  : null;

const posthogSourceMapPlugin = posthog
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
  define: {
    'import.meta.env.VITE_MOSAIC_OFFICIAL_BUILD': JSON.stringify(
      isOfficialMosaicBuild ? 'true' : 'false'
    ),
  },
  plugins: [
    react(),
    buildInfoMetaPlugin,
    ...(isLocalBuild ? [basicSsl()] : []),
    ...(posthogSourceMapPlugin ? [posthogSourceMapPlugin] : []),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
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
        orientation: 'any',
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
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,wasm,json}'],
        globIgnores: ['.vite/manifest.json', '**/*localWhisperWorker*.js', '**/ort-wasm-*.wasm'],
        // These are emitted, uncompressed asset bytes, not network transfer
        // bytes (which depend on browser compression and existing caches).
        manifestTransforms: [
          (manifest) => ({
            manifest: manifest.map((entry) => ({
              ...entry,
              mosaicBytes: entry.size,
            })),
          }),
        ],
      }
    })
  ],
  build: {
    // Vite 8.1+ can route chunk-to-chunk imports through an import map so a
    // changed dependency hash does not invalidate every transitive importer.
    // This directly reduces PWA update downloads while retaining hashed chunks.
    chunkImportMap: true,
    manifest: true,
    sourcemap: posthogSourceMapsEnabled ? 'hidden' : false,
  },
});
