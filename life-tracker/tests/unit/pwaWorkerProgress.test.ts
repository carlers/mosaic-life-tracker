import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the actual SW source with a controlled Workbox facade. Do not
// replace the installed worker's required-asset list to shorten an update.
const source = readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');

function workerFixture(
  count: number,
  matchAll: () => Promise<{ postMessage: (payload: unknown) => void }[]>,
  failAt = -1,
) {
  const entries = Array.from({ length: count }, (_, index) => ({
    url: '/assets/test-' + index + '.js',
    revision: String(index),
    mosaicBytes: 100,
  }));
  const handlers = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
  const installed = new Set<string>();
  let activeLanes = 0;
  let peakLanes = 0;
  let cleanupCalls = 0;
  const match = vi.fn(matchAll);
  const self = {
    __WB_MANIFEST: entries,
    location: { href: 'https://mosaic.example/sw.js' },
    clients: { matchAll: match },
    addEventListener: (type: string, handler: (event: never) => void) =>
      handlers.set(type, handler as never),
    skipWaiting: vi.fn(),
  };

  class PrecacheController {
    private assets: typeof entries = [];
    private plugins: Array<{ handlerDidComplete: (event: { request: { url: string } }) => unknown }>;
    constructor({ plugins = [] }: { plugins?: PrecacheController['plugins'] } = {}) {
      this.plugins = plugins;
    }
    addToCacheList(list: typeof entries) {
      this.assets.push(...list);
    }
    async install() {
      activeLanes += 1;
      peakLanes = Math.max(peakLanes, activeLanes);
      try {
        for (const entry of this.assets) {
          // A real Workbox strategy waits on one cache operation per lane.
          await Promise.resolve();
          if (Number(entry.url.match(/test-([0-9]+)/)?.[1]) === failAt) {
            throw new Error('Simulated cache operation failure');
          }
          const url = new URL(entry.url, self.location.href).href;
          if (installed.has(url)) throw new Error('Asset installed twice: ' + url);
          installed.add(url);
          for (const plugin of this.plugins) {
            expect(plugin.handlerDidComplete({ request: { url } })).toBeUndefined();
          }
        }
      } finally {
        activeLanes -= 1;
      }
    }
    async activate() {
      cleanupCalls += 1;
      if (this.assets.length !== count) {
        throw new Error('Activation cleanup must cover the complete manifest');
      }
    }
    getCacheKeyForURL(url: string) {
      return this.assets.some((entry) => new URL(entry.url, self.location.href).href === url)
        ? url : undefined;
    }
    strategy = { handle: () => undefined };
    createHandlerBoundToURL() { return () => undefined; }
  }

  runInNewContext(source, {
    self,
    APP_VERSION: '0.81.4',
    importScripts: () => undefined,
    PrecacheController,
    NavigationRoute: class {},
    registerRoute: () => undefined,
    URL,
    Promise,
    setTimeout,
    clearTimeout,
  });

  const event = () => {
    let promise!: Promise<unknown>;
    return {
      registration: { waitUntil: (pending: Promise<unknown>) => { promise = pending; } },
      done: () => promise,
    };
  };
  return {
    installed,
    match,
    get peakLanes() { return peakLanes; },
    get cleanupCalls() { return cleanupCalls; },
    requestVersion(reply: (payload: unknown) => void) {
      (handlers.get('message') as unknown as (e: {
        data: { type: string };
        source: { postMessage: typeof reply };
      }) => void)({
        data: { type: 'MOSAIC_PWA_VERSION_REQUEST' },
        source: { postMessage: reply },
      });
    },
    async install() {
      const e = event();
      handlers.get('install')!(e.registration);
      await e.done();
    },
    async activate() {
      const e = event();
      handlers.get('activate')!(e.registration);
      await e.done();
    },
  };
}

describe('complete accelerated service-worker install', () => {
  it('installs every manifest asset once with bounded parallelism and one cleanup owner', async () => {
    const send = vi.fn();
    const f = workerFixture(120, async () => [{ postMessage: send }]);
    await f.install();
    expect(f.installed.size).toBe(120);
    expect(f.peakLanes).toBe(4);
    await f.activate();
    expect(f.cleanupCalls).toBe(1);
    await vi.waitFor(() => expect(send).toHaveBeenCalled());
    expect(send).toHaveBeenCalledWith({
      type: 'MOSAIC_PWA_ASSET_PROGRESS',
      completed: 120,
      total: 120,
      completedBytes: 12_000,
      totalBytes: 12_000,
    });
  });

  it('rejects the entire install when any lane fails before all assets are prepared', async () => {
    const f = workerFixture(12, async () => [], 5);
    await expect(f.install()).rejects.toThrow('Simulated cache operation failure');
    expect(f.installed.size).toBeLessThan(12);
    expect(f.cleanupCalls).toBe(0);
  });

  it('never waits on slow or hanging progress client enumeration', async () => {
    const f = workerFixture(19, () => new Promise(() => {}));
    await f.install();
    expect(f.installed.size).toBe(19);
    expect(f.match).toHaveBeenCalled();
  });

  it('reports a waiting worker version without activating', () => {
    const f = workerFixture(1, async () => []);
    const reply = vi.fn();
    f.requestVersion(reply);
    expect(reply).toHaveBeenCalledWith({
      type: 'MOSAIC_PWA_VERSION',
      version: '0.81.4',
    });
    expect(f.cleanupCalls).toBe(0);
  });

  it('cannot fail a complete mandatory precache when progress messaging rejects', async () => {
    const f = workerFixture(7, async () => { throw new Error('Client closed'); });
    await expect(f.install()).resolves.toBeUndefined();
    expect(f.installed.size).toBe(7);
  });
});
