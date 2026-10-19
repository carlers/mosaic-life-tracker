import releaseNotes from './data/pwaUpdateNotes.json';
import { APP_VERSION } from './lib/appVersion';
import { PrecacheController } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// The PWA registrar, update activation, and push handling remain separate owners.
// This worker never claims existing clients or skips waiting on its own.
importScripts('/push-sw.js');

const entries = self.__WB_MANIFEST;
self.__MOSAIC_ASSETS__ = entries;

const sizes = new Map(entries.map((entry) => [
  new URL(entry.url, self.location.href).href,
  Number.isSafeInteger(entry.mosaicBytes) && entry.mosaicBytes >= 0
    ? entry.mosaicBytes : null,
]));
const reliableSizes = [...sizes.values()].every((value) => value !== null);
const totalBytes = reliableSizes
  ? [...sizes.values()].reduce((total, value) => total + value, 0)
  : null;
const doneURLs = new Set();
let completedBytes = 0;
let installing = true;

const controller = new PrecacheController({
  plugins: [{
    async handlerDidComplete({ request }) {
      if (!installing || !sizes.has(request.url) || doneURLs.has(request.url)) return;
      doneURLs.add(request.url);
      if (reliableSizes) completedBytes += sizes.get(request.url);
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({
          type: 'MOSAIC_PWA_ASSET_PROGRESS',
          completed: doneURLs.size,
          total: sizes.size,
          completedBytes: reliableSizes ? completedBytes : null,
          totalBytes,
        });
      }
    },
  }],
});
controller.addToCacheList(entries);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      await controller.install(event);
    } finally {
      installing = false;
    }
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(controller.activate(event));
});

registerRoute(
  ({ url }) => controller.getCacheKeyForURL(url.href) !== undefined,
  ({ request, event }) => controller.strategy.handle({
    request,
    event,
    params: { cacheKey: controller.getCacheKeyForURL(request.url) },
  }),
);
registerRoute(new NavigationRoute(
  controller.createHandlerBoundToURL('index.html'),
  { denylist: [/^\/v1\//, /^\/api\//] },
));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'MOSAIC_PWA_UPDATE_INFO_REQUEST') {
    // The browser targets the exact waiting worker. Do not fetch a mutable
    // deploy URL, which could belong to a later release by the time it loads.
    event.ports?.[0]?.postMessage({
      type: 'MOSAIC_PWA_UPDATE_INFO',
      info: { version: APP_VERSION, releases: releaseNotes },
    });
  }
});
