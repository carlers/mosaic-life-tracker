const DB_NAME = 'mosaic_pending_images';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const LOCAL_PREFIX = 'localimg_';
const STICKER_ID = /^stk_[0-9a-f]{32}$/;

interface PendingImageEntry {
  id: string;
  ownerUserId: string;
  blob: Blob;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

function makePendingId(): string {
  const bytes = new Uint8Array(13);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `${LOCAL_PREFIX}${hex}`;
}

export function isPendingImageId(fileId: string): boolean {
  return fileId.startsWith(LOCAL_PREFIX);
}

export async function createPendingImage(
  ownerUserId: string,
  blob: Blob
): Promise<string> {
  if (!ownerUserId) throw new Error('Pending image requires an owner.');
  const id = makePendingId();
  const entry: PendingImageEntry = {
    id,
    ownerUserId,
    blob,
    createdAt: new Date().toISOString(),
  };
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await requestResult(tx.objectStore(STORE_NAME).put(entry));
  return id;
}

export async function getPendingImage(
  fileId: string,
  expectedOwnerUserId?: string
): Promise<Blob | null> {
  if (!isPendingImageId(fileId)) return null;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const entry = (await requestResult(
    tx.objectStore(STORE_NAME).get(fileId)
  )) as PendingImageEntry | undefined;
  if (!entry) return null;
  if (
    expectedOwnerUserId &&
    entry.ownerUserId !== expectedOwnerUserId
  ) {
    return null;
  }
  return entry.blob;
}

export async function deletePendingImage(
  fileId: string,
  expectedOwnerUserId?: string
): Promise<void> {
  if (!isPendingImageId(fileId)) return;
  const db = await openDB();
  if (expectedOwnerUserId) {
    const current = await getPendingImage(fileId, expectedOwnerUserId);
    if (!current) return;
  }
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await requestResult(tx.objectStore(STORE_NAME).delete(fileId));
}

export async function clearAllPendingImages(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await requestResult(tx.objectStore(STORE_NAME).clear());
}

export async function clearPendingImagesForUser(
  ownerUserId: string
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const entries = (await requestResult(store.getAll())) as PendingImageEntry[];
  await Promise.all(
    entries
      .filter((entry) => entry.ownerUserId === ownerUserId)
      .map((entry) => requestResult(store.delete(entry.id)))
  );
}

export function resetPendingImagesForTests(): void {
  dbPromise = null;
}

// Reuses the durable owner-scoped IndexedDB blob store already used for
// offline task images. This is a *pending send*, not a personal sticker library.
export async function stagePendingSticker(ownerUserId: string, fileId: string, blob: Blob): Promise<void> {
  if (!ownerUserId || !STICKER_ID.test(fileId) || blob.size > 128 * 1024 || blob.type !== 'image/webp') {
    throw new Error('Invalid pending sticker');
  }
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await requestResult(tx.objectStore(STORE_NAME).put({
    id: fileId, ownerUserId, blob, createdAt: new Date().toISOString(),
  } satisfies PendingImageEntry));
}

export async function getPendingSticker(fileId: string, ownerUserId: string): Promise<Blob | null> {
  if (!STICKER_ID.test(fileId) || !ownerUserId) return null;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const entry = (await requestResult(tx.objectStore(STORE_NAME).get(fileId))) as PendingImageEntry | undefined;
  return entry?.ownerUserId === ownerUserId ? entry.blob : null;
}

export async function deletePendingSticker(fileId: string, ownerUserId: string): Promise<void> {
  if (!STICKER_ID.test(fileId) || !ownerUserId) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const entry = (await requestResult(store.get(fileId))) as PendingImageEntry | undefined;
  if (entry?.ownerUserId === ownerUserId) await requestResult(store.delete(fileId));
}
