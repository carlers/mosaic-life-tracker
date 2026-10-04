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

async function enforceBudget(
  db: IDBDatabase,
  maxBytes: number
): Promise<ImageCacheSweepResult> {
  const boundedMax = Math.max(0, maxBytes);
  const { entries, staleMetadataIds } = await readEntries(db);
  let totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0);
  const ordered = entries
    .map((entry) => ({
      fileId: entry.fileId,
      size: entry.blob.size,
      lastAccessedAt: entry.metadata?.lastAccessedAt ?? 0,
    }))
    .sort(
      (a, b) =>
        a.lastAccessedAt - b.lastAccessedAt || a.fileId.localeCompare(b.fileId)
    );
  const evictedIds: string[] = [];
  for (const entry of ordered) {
    if (totalBytes <= boundedMax) break;
    totalBytes -= entry.size;
    evictedIds.push(entry.fileId);
  }
  await deleteEntries(db, [...staleMetadataIds, ...evictedIds]);

  const evicted = new Set(evictedIds);
  await writeMetadataEntries(
    db,
    ordered
      .filter((entry) => !evicted.has(entry.fileId))
      .map((entry) => ({ ...entry }))
  );
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

  // Sweep first so a legacy unbounded cache is reduced before another write.
  await enforceBudget(db, IMAGE_CACHE_MAX_BYTES);
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
  await deleteEntries(await openDB(), [fileId]);
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
