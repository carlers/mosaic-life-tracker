import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');

function workerFixture(count: number, matchAll: () => Promise<{ postMessage: (payload: unknown) => void }[]>) {
  const entries = Array.from({ length: count }, (_, index) => ({
    url: '/assets/test-' + index + '.js',
    revision: String(index),
    mosaicBytes: 100,
  }));
  const handlers = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
  const requests: unknown[] = [];
  const clientMatch = vi.fn(matchAll);
  const self = {
    __WB_MANIFEST: entries,
    location: { href: 'https://mosaic.example/sw.js' },
    clients: { matchAll: clientMatch },
    addEventListener: (type: string, handler: (event: never) => void) =>
      handlers.set(type, handler as never),
    skipWaiting: vi.fn(),
  };

  class PrecacheController {
    private plugins: Array<{ handlerDidComplete: (options: { request: { url: string } }) => unknown }>;
    constructor({ plugins }: { plugins: PrecacheController['plugins'] }) {
      this.plugins = plugins;
    }
    addToCacheList() {}
    async install() {
      for (const entry of entries) {
        for (const plugin of this.plugins) {
          // Workbox awaits plugin callbacks. Telemetry must not add an async
          // client lookup to each asset's install critical path.
          const result = plugin.handlerDidComplete({
            request: { url: new URL(entry.url, self.location.href).href },
          });
          expect(result).toBeUndefined();
          await result;
        }
      }
    }
    async activate() {}
    getCacheKeyForURL() { return undefined; }
    strategy = { handle: () => undefined };
    createHandlerBoundToURL() { return () => undefined; }
  }

  runInNewContext(source, {
    self,
    importScripts: () => undefined,
    PrecacheController,
    NavigationRoute: class {},
    registerRoute: (...args: unknown[]) => requests.push(args),
    URL,
    setTimeout,
    clearTimeout,
  });

  return {
    clientMatch,
    async install() {
      let completion!: Promise<unknown>;
      handlers.get('install')!({
        waitUntil: (promise) => { completion = promise; },
      });
      await completion;
    },
  };
}

describe('service-worker precache progress is not an asset-install bottleneck', () => {
  it('coalesces a burst of 120 asset completions into one final client lookup', async () => {
    const postMessage = vi.fn();
    const fixture = workerFixture(120, async () => [{ postMessage }]);
    await fixture.install();
    expect(fixture.clientMatch).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith({
      type: 'MOSAIC_PWA_ASSET_PROGRESS',
      completed: 120,
      total: 120,
      completedBytes: 12_000,
      totalBytes: 12_000,
    });
  });

  it('does not fail an offline precache when client progress delivery fails', async () => {
    const fixture = workerFixture(3, async () => { throw new Error('client closed'); });
    await expect(fixture.install()).resolves.toBeUndefined();
    expect(fixture.clientMatch).toHaveBeenCalledTimes(1);
  });
});
