const DB_NAME = 'mosaic_image_cache';
const STORE_NAME = 'blobs';

// The single IndexedDB-backed blob cache for the app. Both `storage.ts`
// (image fetch/cache during normal rendering) and `exportData.ts` (image
// bundling during export) go through this module. It is deliberately
// free of Appwrite SDK imports so it can be tested without mocking the
// SDK, and so the cache logic is one file instead of two diverging copies.
//
// Cache is unbounded. See AGENTS.md §18 "Accepted Limitations"
// (OFF-6): images are compressed to ≤150KB (§4), so a heavy user with a
// few hundred images is still in the low tens of MB, well under the
// IndexedDB quota on iOS (~1GB/origin). An LRU cap with a byte budget
// is deferred to Phase 3 (optimize) so it can be sized against real
// cache-growth data rather than a guess.

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedImage(fileId: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheImage(fileId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCachedImage(fileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
