import { runInNewContext } from 'node:vm';

// Execute our trusted generateSW output with observable Workbox stubs. This
// checks generated wiring, not browser lifecycle, cache storage, or networking.
// Unknown output APIs fail rather than silently reporting a safe policy.
export async function inspectServiceWorker(source) {
  const listeners = new Map();
  let definitions = 0;
  let skipCalls = 0;
  let claimCalls = 0;
  let precacheUrls;
  let navigationFallback;
  let navigationDenylist;
  const workbox = {
    clientsClaim() { claimCalls++; },
    precacheAndRoute(entries) { precacheUrls = entries.map(({ url }) => url); },
    cleanupOutdatedCaches() {},
    createHandlerBoundToURL(url) { return { url }; },
    NavigationRoute: class {
      constructor(handler, options) {
        this.handler = handler;
        this.options = options;
      }
    },
    registerRoute(route) {
      if (!(route instanceof workbox.NavigationRoute) || navigationFallback) {
        throw new Error('Unexpected SW route; update the inspector for the new policy.');
      }
      navigationFallback = route.handler.url;
      navigationDenylist = route.options.denylist.map((pattern) => pattern.source);
    },
  };
  const define = (dependencies, factory) => {
    if (++definitions !== 1 || dependencies.length !== 1 || !dependencies[0].startsWith('./workbox-')) {
      throw new Error('Unexpected generateSW module format.');
    }
    factory(workbox);
  };
  const self = {
    define,
    skipWaiting() { skipCalls++; return Promise.resolve(); },
    clients: { claim() { claimCalls++; return Promise.resolve(); } },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
  };
  runInNewContext(source, { self, define }, { timeout: 1000 });
  if (definitions !== 1 || !precacheUrls?.length || !navigationFallback) {
    throw new Error('Missing generated SW module, precache entries, or navigation fallback.');
  }
  const skipWaitingOnStartup = skipCalls > 0;
  async function dispatch(type, data) {
    const pending = [];
    const before = skipCalls;
    for (const callback of listeners.get(type) ?? []) {
      await callback({ data, waitUntil: (promise) => pending.push(promise) });
    }
    await Promise.all(pending);
    return skipCalls > before;
  }
  const skipOnInstall = await dispatch('install');
  const skipOnActivate = await dispatch('activate');
  const skipWaitingOnUnrelatedMessage = await dispatch('message', { type: 'UNRELATED' });
  const skipWaitingOnRequest = await dispatch('message', { type: 'SKIP_WAITING' });
  return {
    skipWaitingOnStartup,
    skipWaitingOnLifecycle: skipOnInstall || skipOnActivate,
    skipWaitingOnUnrelatedMessage,
    skipWaitingOnRequest,
    clientsClaim: claimCalls > 0,
    precacheUrls: Array.from(precacheUrls),
    navigationFallback,
    navigationDenylist: Array.from(navigationDenylist),
  };
}
