import { completePrecacheSizes } from '../../scripts/lib/complete-precache-sizes.mjs';
import { inspectServiceWorker } from '../../scripts/lib/inspect-service-worker.mjs';

describe('injected PWA precache asset sizes', () => {
  const sw = String.raw`
    (() => {
      self.__MOSAIC_ASSETS__ = [
        { url: 'index.html', revision: 'a', mosaicBytes: 20 },
        { url: 'manifest.webmanifest', revision: 'b' },
        { url: 'assets/app.js', revision: null, mosaicBytes: 40 }
      ];
      importScripts('/push-sw.js');
      controller.createHandlerBoundToURL('index.html');
      const route = { denylist: [/^\/v1\//, /^\/api\//] };
      self.addEventListener('message', (event) => {
        if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
      });
    })();
  `;

  const measure = (url) => new Map([
    ['index.html', 20], ['manifest.webmanifest', 21], ['assets/app.js', 40]
  ]).get(url);

  it('completes only missing weights and preserves exact completed asset sizes', async () => {
    const result = completePrecacheSizes(sw, measure);
    expect(result.patchedUrls).toEqual(['manifest.webmanifest']);
    const worker = await inspectServiceWorker(result.source);
    expect(worker.precacheSizes).toEqual([20, 21, 40]);
    expect(worker.skipWaitingOnUnrelatedMessage).toBe(false);
    expect(completePrecacheSizes(result.source, measure).patchedUrls).toEqual([]);
  });

  it('permits identical duplicate asset revisions but refuses conflicts', () => {
    const duplicate = sw.replace(
      "{ url: 'assets/app.js', revision: null, mosaicBytes: 40 }",
      "{ url: 'assets/app.js', revision: null, mosaicBytes: 40 }, { url: 'assets/app.js', revision: null }"
    );
    expect(completePrecacheSizes(duplicate, measure).patchedUrls)
      .toEqual(['manifest.webmanifest', 'assets/app.js']);
    const conflict = duplicate.replace(
      "{ url: 'assets/app.js', revision: null }",
      "{ url: 'assets/app.js', revision: 'different' }"
    );
    expect(() => completePrecacheSizes(conflict, measure)).toThrow(/Conflicting precache revisions/);
  });

  it('fails closed when an existing size is stale or a source file is absent', () => {
    expect(() => completePrecacheSizes(sw, (url) => url === 'index.html' ? 99 : measure(url)))
      .toThrow(/Manifest size does not match/);
    expect(() => completePrecacheSizes(sw, (url) => url === 'manifest.webmanifest' ? undefined : measure(url)))
      .toThrow(/Invalid emitted asset size/);
  });
});
