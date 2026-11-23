const DB_NAME = 'mosaic_image_cache';
const DB_VERSION = 2;
const BLOB_STORE = 'blobs';
const METADATA_STORE = 'metadata';

export const IMAGE_CACHE_MAX_BYTES = 50 * 1024 * 1024;

interface ImageCacheMetadata {
  fileId: string;
  size: number;
  lastAccessedAt: number;
}

export interface ImageCacheSweepResult {
  totalBytes: number;
  evictedIds: string[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBlob(db: IDBDatabase, fileId: string): Promise<Blob | undefined> {
  const tx = db.transaction(BLOB_STORE, 'readonly');
  return requestResult(tx.objectStore(BLOB_STORE).get(fileId));
}

async function writeMetadata(
  db: IDBDatabase,
  fileId: string,
  size: number,
  lastAccessedAt: number
): Promise<void> {
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  await requestResult(
    tx.objectStore(METADATA_STORE).put(
      { fileId, size, lastAccessedAt } satisfies ImageCacheMetadata,
      fileId
    )
  );
}

async function writeMetadataEntries(
  db: IDBDatabase,
  entries: ImageCacheMetadata[]
): Promise<void> {
  if (entries.length === 0) return;
  const tx = db.transaction(METADATA_STORE, 'readwrite');
  const store = tx.objectStore(METADATA_STORE);
  await Promise.all(
    entries.map((entry) => requestResult(store.put(entry, entry.fileId)))
  );
}

async function deleteEntries(db: IDBDatabase, fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  const tx = db.transaction([BLOB_STORE, METADATA_STORE], 'readwrite');
  const blobs = tx.objectStore(BLOB_STORE);
  const metadata = tx.objectStore(METADATA_STORE);
  await Promise.all(
    fileIds.flatMap((fileId) => [
      requestResult(blobs.delete(fileId)),
      requestResult(metadata.delete(fileId)),
    ])
  );
}

async function readEntries(db: IDBDatabase): Promise<{
  entries: Array<{ fileId: string; blob: Blob; metadata?: ImageCacheMetadata }>;
  staleMetadataIds: string[];
}> {
  const tx = db.transaction([BLOB_STORE, METADATA_STORE], 'readonly');
  const blobs = tx.objectStore(BLOB_STORE);
  const metadata = tx.objectStore(METADATA_STORE);
  const blobKeysRequest = blobs.getAllKeys();
  const blobValuesRequest = blobs.getAll();
  const metadataValuesRequest = metadata.getAll();
  const [blobKeys, blobValues, metadataValues] = await Promise.all([
    requestResult(blobKeysRequest),
    requestResult(blobValuesRequest),
    requestResult(metadataValuesRequest),
  ]);
  const metadataById = new Map(
    (metadataValues as ImageCacheMetadata[]).map((entry) => [entry.fileId, entry])
  );
  const entries = blobKeys.map((key, index) => {
    const fileId = String(key);
    const entry = {
      fileId,
      blob: blobValues[index] as Blob,
      metadata: metadataById.get(fileId),
    };
    metadataById.delete(fileId);
    return entry;
  });
  return { entries, staleMetadataIds: [...metadataById.keys()] };
}

// A dense Calendar can download hundreds of photos. Read small LRU records
// and Blob keys, not every image Blob, on each budget pass. Only legacy
// metadata-less entries require a one-time read of their original bytes.
async function enforceBudget(
  db: IDBDatabase,
  maxBytes: number
): Promise<ImageCacheSweepResult> {
  const tx = db.transaction([BLOB_STORE, METADATA_STORE], 'readonly');
  const [keys, records] = await Promise.all([
    requestResult(tx.objectStore(BLOB_STORE).getAllKeys()),
    requestResult(tx.objectStore(METADATA_STORE).getAll()) as Promise<ImageCacheMetadata[]>,
  ]);
  const byId = new Map(records.map(entry => [entry.fileId, entry]));
  const missing = keys.map(String).filter(id => !byId.has(id));
  const legacy = await Promise.all(missing.map(async fileId => ({
    fileId, blob: await readBlob(db, fileId),
  })));
  const entries = keys.map(key => byId.get(String(key))).filter(
    (entry): entry is ImageCacheMetadata => Boolean(entry)
  );
  for (const { fileId, blob } of legacy) {
    if (blob) entries.push({ fileId, size: blob.size, lastAccessedAt: 0 });
  }
  let totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  const evictedIds: string[] = [];
  entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt ||
    a.fileId.localeCompare(b.fileId));
  for (const entry of entries) {
    if (totalBytes <= Math.max(0, maxBytes)) break;
    totalBytes -= entry.size;
    evictedIds.push(entry.fileId);
  }
  const surviving = new Set(keys.map(String).filter(id => !evictedIds.includes(id)));
  await deleteEntries(db, [
    ...records.map(item => item.fileId).filter(id => !surviving.has(id)),
    ...evictedIds,
  ]);
  await writeMetadataEntries(db, legacy.filter(item => item.blob && surviving.has(item.fileId))
    .map(({ fileId, blob }) => ({ fileId, size: blob!.size, lastAccessedAt: 0 })));
  return { totalBytes, evictedIds };
}

export async function enforceImageCacheBudget(
  maxBytes = IMAGE_CACHE_MAX_BYTES
): Promise<ImageCacheSweepResult> {
  return enforceBudget(await openDB(), maxBytes);
}

export async function getCachedImage(fileId: string): Promise<Blob | undefined> {
  const db = await openDB();
  const blob = await readBlob(db, fileId);
  if (!blob) return undefined;
  try {
    await writeMetadata(db, fileId, blob.size, Date.now());
  } catch (error) {
    console.warn('[ImageCache] Failed to refresh access metadata:', fileId, error);
  }
  return blob;
}

export async function cacheImage(fileId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  if (blob.size > IMAGE_CACHE_MAX_BYTES) return;

  // A single metadata-only sweep after committing avoids reading/cloning
  // every cached Blob twice per new photo while preserving the 50 MiB cap.
  const tx = db.transaction([BLOB_STORE, METADATA_STORE], 'readwrite');
  const now = Date.now();
  await Promise.all([
    requestResult(tx.objectStore(BLOB_STORE).put(blob, fileId)),
    requestResult(
      tx.objectStore(METADATA_STORE).put(
        { fileId, size: blob.size, lastAccessedAt: now } satisfies ImageCacheMetadata,
        fileId
      )
    ),
  ]);
  await enforceBudget(db, IMAGE_CACHE_MAX_BYTES);
}

export async function deleteCachedImage(fileId: string): Promise<void> {
  // Deleting a source also invalidates its derived local preview.
  await deleteEntries(await openDB(), fileId.startsWith(CALENDAR_PREFIX)
    ? [fileId] : [fileId, CALENDAR_PREFIX + fileId]);
}

// Reuse the *existing v2 cache* and device-wide 50 MiB budget. This is
// deliberate old-PWA compatibility: old clients can still open v2 and their
// existing 'Clear cached images' action deletes these namespaced previews.
// A new IndexedDB version/store would make their cache reads fail.
const CALENDAR_PREFIX = 'calendar-preview:';
export function getCachedCalendarPreview(fileId: string): Promise<Blob | undefined> {
  return getCachedImage(CALENDAR_PREFIX + fileId);
}
export function cacheCalendarPreview(fileId: string, blob: Blob): Promise<void> {
  return cacheImage(CALENDAR_PREFIX + fileId, blob);
}
export function deleteCachedCalendarPreview(fileId: string): Promise<void> {
  return deleteCachedImage(CALENDAR_PREFIX + fileId);
}


/** Exact bytes of downloaded blobs at the time of this on-demand scan.
 * This is a device-wide cache and is intentionally not presented as per-account.
 */
export async function getImageCacheUsage(): Promise<{ bytes: number; count: number }> {
  const { entries } = await readEntries(await openDB());
  return {
    bytes: entries.reduce((sum, entry) => sum + entry.blob.size, 0),
    count: entries.length,
  };
}

export async function clearAllCachedImages(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([BLOB_STORE, METADATA_STORE], 'readwrite');
  await Promise.all([
    requestResult(tx.objectStore(BLOB_STORE).clear()),
    requestResult(tx.objectStore(METADATA_STORE).clear()),
  ]);
}

export function __resetImageCacheForTests(): void {
  dbPromise = null;
}
