import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __resetImageCacheForTests,
  cacheImage,
  deleteCachedImage,
  enforceImageCacheBudget,
  getCachedImage,
  getImageCacheUsage,
  getCachedCalendarPreview,
  cacheCalendarPreview,
  clearAllCachedImages,
} from '../../src/lib/imageCache';

type Store = Map<IDBValidKey, unknown>;

function makeIdbStub() {
  const stores = new Map<string, Store>();
  const failNextPutFor = new Set<string>();
  const getAllCounts = new Map<string, number>();

  class FakeRequest<T> {
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onupgradeneeded: ((event: { target: FakeRequest<T> }) => void) | null = null;
    result!: T;
    error: DOMException | null = null;
  }

  class FakeObjectStore {
    constructor(private name: string, private store: Store) {}

    get(key: IDBValidKey) {
      return complete(this.store.get(key));
    }

    getAll() {
      getAllCounts.set(this.name, (getAllCounts.get(this.name) ?? 0) + 1);
      return complete([...this.store.entries()]
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([, value]) => value));
    }

    getAllKeys() {
      return complete([...this.store.keys()].sort((a, b) =>
        String(a).localeCompare(String(b))
      ));
    }

    put(value: unknown, key: IDBValidKey) {
      if (failNextPutFor.delete(this.name)) {
        return fail(new DOMException('Injected write failure'));
      }
      this.store.set(key, value);
      return complete(undefined);
    }

    delete(key: IDBValidKey) {
      this.store.delete(key);
      return complete(undefined);
    }

    clear() {
      this.store.clear();
      return complete(undefined);
    }
  }

  class FakeTransaction {
    objectStore(name: string) {
      const store = stores.get(name);
      if (!store) throw new Error(`Missing object store: ${name}`);
      return new FakeObjectStore(name, store);
    }
  }

  class FakeDb {
    objectStoreNames = {
      contains: (name: string) => stores.has(name),
    };

    createObjectStore(name: string) {
      const store = new Map<IDBValidKey, unknown>();
      stores.set(name, store);
      return new FakeObjectStore(name, store);
    }

    transaction(_names: string | string[], _mode: IDBTransactionMode) {
      return new FakeTransaction();
    }
  }

  function complete<T>(result: T): FakeRequest<T> {
    const request = new FakeRequest<T>();
    request.result = result;
    queueMicrotask(() => request.onsuccess?.());
    return request;
  }

  function fail<T>(error: DOMException): FakeRequest<T> {
    const request = new FakeRequest<T>();
    request.error = error;
    queueMicrotask(() => request.onerror?.());
    return request;
  }

  return {
    open: (_name: string, _version: number) => {
      const request = new FakeRequest<FakeDb>();
      queueMicrotask(() => {
        request.result = new FakeDb();
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.();
      });
      return request;
    },
    __stores: stores,
    __getAllCounts: getAllCounts,
    __failNextPut: (storeName: string) => failNextPutFor.add(storeName),
  };
}

let idbStub: ReturnType<typeof makeIdbStub>;

beforeEach(() => {
  idbStub = makeIdbStub();
  vi.stubGlobal('indexedDB', idbStub);
  __resetImageCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('imageCache — bounded IndexedDB blob cache', () => {
  it('round-trips, overwrites, and deletes a blob plus metadata', async () => {
    const first = new Blob(['one'], { type: 'image/webp' });
    const second = new Blob(['second'], { type: 'image/webp' });
    await cacheImage('img_a', first);
    expect(await getCachedImage('img_a')).toBe(first);
    await cacheImage('img_a', second);
    expect(await getCachedImage('img_a')).toBe(second);
    await deleteCachedImage('img_a');
    expect(await getCachedImage('img_a')).toBeUndefined();
    expect(idbStub.__stores.get('metadata')?.has('img_a')).toBe(false);
  });

  it('evicts least-recently-used blobs until the byte budget is met', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(300);
    await cacheImage('img_old', new Blob(['1234']));
    await cacheImage('img_new', new Blob(['5678']));

    const result = await enforceImageCacheBudget(4);

    expect(result).toEqual({ totalBytes: 4, evictedIds: ['img_old'] });
    expect(await getCachedImage('img_old')).toBeUndefined();
    expect(await getCachedImage('img_new')).toBeInstanceOf(Blob);
  });

  it('refreshes access time so a recently-read blob survives the next sweep', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(400);
    await cacheImage('img_first', new Blob(['1234']));
    await cacheImage('img_second', new Blob(['5678']));
    await getCachedImage('img_first');

    const result = await enforceImageCacheBudget(4);

    expect(result.evictedIds).toEqual(['img_second']);
    expect(await getCachedImage('img_first')).toBeInstanceOf(Blob);
  });

  it('migrates metadata-less legacy blobs and evicts them deterministically', async () => {
    await enforceImageCacheBudget();
    idbStub.__stores.get('blobs')?.set('legacy_b', new Blob(['bb']));
    idbStub.__stores.get('blobs')?.set('legacy_a', new Blob(['aa']));
    idbStub.__stores.get('metadata')?.set('orphan', {
      fileId: 'orphan',
      size: 10,
      lastAccessedAt: 50,
    });

    const result = await enforceImageCacheBudget(2);

    expect(result).toEqual({ totalBytes: 2, evictedIds: ['legacy_a'] });
    expect(idbStub.__stores.get('metadata')?.get('legacy_b')).toMatchObject({
      fileId: 'legacy_b',
      size: 2,
      lastAccessedAt: 0,
    });
    expect(idbStub.__stores.get('metadata')?.has('orphan')).toBe(false);
  });

  it('returns a cached blob when refreshing access metadata fails', async () => {
    const blob = new Blob(['safe']);
    await cacheImage('img_safe', blob);
    idbStub.__failNextPut('metadata');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await getCachedImage('img_safe')).toBe(blob);
    expect(warn).toHaveBeenCalledWith(
      '[ImageCache] Failed to refresh access metadata:',
      'img_safe',
      expect.any(DOMException)
    );
  });

  it('reports exact cached blob sizes separately from browser origin estimates', async () => {
    await cacheImage('img_one', new Blob(['abc']));
    await cacheImage('img_two', new Blob(['defgh']));
    expect(await getImageCacheUsage()).toEqual({ bytes: 8, count: 2 });
  });

  it('returns undefined for an uncached fileId', async () => {
    expect(await getCachedImage('img_missing')).toBeUndefined();
  });

  it('never clones every cached original Blob to budget a newly downloaded photo', async () => {
    for (let index = 0; index < 40; index++) {
      await cacheImage('dense_' + index, new Blob(['image_' + index]));
    }
    expect(idbStub.__getAllCounts.get('blobs') ?? 0).toBe(0);
    expect(await getCachedImage('dense_39')).toBeInstanceOf(Blob);
    expect(await enforceImageCacheBudget()).toEqual({ totalBytes: 310, evictedIds: [] });
    expect(idbStub.__getAllCounts.get('blobs') ?? 0).toBe(0);
  });

  it('stores tiny Calendar previews separately without replacing original photo bytes', async () => {
    const full = new Blob(['full_resolution_original']);
    const small = new Blob(['tiny_webp']);
    await cacheImage('same-photo', full);
    await cacheCalendarPreview('same-photo', small);
    expect(await getCachedImage('same-photo')).toBe(full);
    expect(await getCachedCalendarPreview('same-photo')).toBe(small);
    expect(await getImageCacheUsage()).toEqual({
      bytes: full.size + small.size, count: 2,
    });
    await deleteCachedImage('same-photo');
    expect(await getCachedCalendarPreview('same-photo')).toBeUndefined();
  });

  it('clears both full-size and Calendar preview caches, without modifying other stores', async () => {
    await cacheImage('file-a', new Blob(['full']));
    await cacheCalendarPreview('file-a', new Blob(['preview']));
    const untouched = new Map([['owner', 'pending-upload']]);
    idbStub.__stores.set('mosaic_pending_images', untouched);
    await clearAllCachedImages();
    expect(await getCachedImage('file-a')).toBeUndefined();
    expect(await getCachedCalendarPreview('file-a')).toBeUndefined();
    expect(idbStub.__stores.get('mosaic_pending_images')).toBe(untouched);
    expect(untouched.get('owner')).toBe('pending-upload');
  });

});
