import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal in-memory IndexedDB stub. Only the surface imageCache.ts uses:
// open / onupgradeneeded / createObjectStore / transaction / objectStore /
// get / put / delete, each with onsuccess / onerror. This is enough to
// exercise the module's read/write/delete paths without a full IDB
// polyfill. Not a general-purpose fake — do not extend beyond what the
// module under test needs.
type Store = Map<string, unknown>;

function makeIdbStub() {
  const stores = new Map<string, Store>();
  class FakeRequest<T> {
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result!: T;
    error: unknown = null;
  }
  class FakeObjectStore {
    constructor(private store: Store) {}
    get(key: string) {
      const req = new FakeRequest<unknown>();
      queueMicrotask(() => {
        req.result = this.store.get(key);
        req.onsuccess?.();
      });
      return req;
    }
    put(value: unknown, key: string) {
      const req = new FakeRequest<void>();
      queueMicrotask(() => {
        this.store.set(key, value);
        req.onsuccess?.();
      });
      return req;
    }
    delete(key: string) {
      const req = new FakeRequest<void>();
      queueMicrotask(() => {
        this.store.delete(key);
        req.onsuccess?.();
      });
      return req;
    }
  }
  class FakeTransaction {
    constructor(private store: Store) {}
    objectStore(_name: string) {
      return new FakeObjectStore(this.store);
    }
  }
  class FakeDb {
    objectStoreNames = {
      contains: (name: string) => stores.has(name),
    };
    createObjectStore(name: string) {
      stores.set(name, new Map());
      return new FakeObjectStore(stores.get(name)!);
    }
    transaction(_name: string, _mode: string) {
      const store = stores.get('blobs') ?? new Map();
      stores.set('blobs', store);
      return new FakeTransaction(store);
    }
  }
  return {
    open: (_name: string, _version: number) => {
      const req = new FakeRequest<FakeDb>();
      queueMicrotask(() => {
        req.result = new FakeDb();
        req.onsuccess?.();
      });
      return req;
    },
    __stores: stores,
  };
}

const idbStub = makeIdbStub();

beforeEach(() => {
  vi.stubGlobal('indexedDB', idbStub);
  idbStub.__stores.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('imageCache — single source of truth for the blob cache', () => {
  it('round-trips a blob through cacheImage + getCachedImage', async () => {
    const { cacheImage, getCachedImage } = await import(
      '../../src/lib/imageCache'
    );
    const blob = new Blob(['hello'], { type: 'image/webp' });
    await cacheImage('img_a', blob);
    const got = await getCachedImage('img_a');
    expect(got).toBe(blob);
  });

  it('returns undefined for an uncached fileId', async () => {
    const { getCachedImage } = await import('../../src/lib/imageCache');
    const got = await getCachedImage('img_missing');
    expect(got).toBeUndefined();
  });

  it('deleteCachedImage removes the entry', async () => {
    const { cacheImage, getCachedImage, deleteCachedImage } = await import(
      '../../src/lib/imageCache'
    );
    const blob = new Blob(['x'], { type: 'image/webp' });
    await cacheImage('img_b', blob);
    await deleteCachedImage('img_b');
    const got = await getCachedImage('img_b');
    expect(got).toBeUndefined();
  });

  it('overwrites an existing entry on re-cache', async () => {
    const { cacheImage, getCachedImage } = await import(
      '../../src/lib/imageCache'
    );
    const first = new Blob(['one'], { type: 'image/webp' });
    const second = new Blob(['two'], { type: 'image/webp' });
    await cacheImage('img_c', first);
    await cacheImage('img_c', second);
    const got = await getCachedImage('img_c');
    expect(got).toBe(second);
  });
});
