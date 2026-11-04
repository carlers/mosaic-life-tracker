import { PrecacheController } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { APP_VERSION } from './lib/appVersion';
import releaseNotes from './data/pwaUpdateNotes.json';

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

// Progress is advisory: never put client enumeration or postMessage latency on
// Workbox's per-asset precache critical path. Coalesce bursts and flush one
// final snapshot while the install event keeps this worker alive.
let progressTimer = null;
let progressBroadcast = Promise.resolve();

async function broadcastProgress() {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const progress = {
      type: 'MOSAIC_PWA_ASSET_PROGRESS',
      completed: doneURLs.size,
      total: sizes.size,
      completedBytes: reliableSizes ? completedBytes : null,
      totalBytes,
    };
    for (const client of clients) client.postMessage(progress);
  } catch {
    // A browser can deny access to a closing client. Telemetry must not
    // abort installation or delay offline precache completion.
  }
}

function queueProgress() {
  if (progressTimer !== null) return;
  progressTimer = setTimeout(() => {
    progressTimer = null;
    progressBroadcast = progressBroadcast.then(broadcastProgress);
  }, 100);
}

// Only this full-manifest controller serves routes and performs activation
// cleanup. Partitioned install controllers MUST NOT activate individually.
const controller = new PrecacheController();
controller.addToCacheList(entries);

// Workbox serializes precache requests in each controller. Use four disjoint
// lanes to bound parallelism while preserving Workbox's revision/cache logic.
const INSTALL_CONCURRENCY = 4;
const partitions = Array.from(
  { length: Math.min(INSTALL_CONCURRENCY, Math.max(1, entries.length)) },
  () => [],
);
entries.forEach((entry, index) => partitions[index % partitions.length].push(entry));
const progressPlugin = {
  handlerDidComplete({ request }) {
    if (!installing || !sizes.has(request.url) || doneURLs.has(request.url)) return;
    doneURLs.add(request.url);
    if (reliableSizes) completedBytes += sizes.get(request.url);
    queueProgress();
  },
};
const installControllers = partitions.map((partition) => {
  const installer = new PrecacheController({ plugins: [progressPlugin] });
  installer.addToCacheList(partition);
  return installer;
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      // Never mark this update installed unless EVERY manifest partition
      // has completed. Any failed Workbox install rejects the entire event.
      const results = await Promise.allSettled(
        installControllers.map((installer) => installer.install(event)),
      );
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
    } finally {
      installing = false;
      if (progressTimer !== null) clearTimeout(progressTimer);
      progressTimer = null;
      // Advisory client messages must never block the install Ready state.
      void broadcastProgress();
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
  if (event.data?.type === 'MOSAIC_PWA_VERSION_REQUEST') {
    // Report this *waiting worker's* build version, not the still-running page's.
    event.source?.postMessage({ type: 'MOSAIC_PWA_VERSION', version: APP_VERSION, releases: releaseNotes });
  } else if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
