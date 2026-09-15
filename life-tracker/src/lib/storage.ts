import imageCompression from 'browser-image-compression';
import { client, account } from './appwrite';
import { Storage, Permission, Role } from 'appwrite';
import { guardedCall, makeUnauthorizedError } from './authEvents';

const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  bucketId: 'task_images',
};

const storage = new Storage(client);

export async function compressImage(file: File): Promise<Blob> {
  const options = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp',
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('[Storage] Image compression failed:', error);
    throw error;
  }
}

function generateFileId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `img_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    return `img_${hex}`;
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const user = await guardedCall(() => account.get());
    return user?.$id || null;
  } catch {
    return null;
  }
}

function buildFilePermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function uploadImage(file: File): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Cannot upload image: no authenticated user');
  }
  const compressedBlob = await compressImage(file);
  const fileId = generateFileId();
  const webpFile = new File([compressedBlob], `${fileId}.webp`, {
    type: 'image/webp',
  });
  try {
    await guardedCall(() =>
      storage.createFile({
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId: fileId,
        file: webpFile,
        permissions: buildFilePermissions(userId),
      })
    );
    return fileId;
  } catch (error) {
    console.error('[Storage] Upload failed:', error);
    throw new Error(
      `Appwrite Storage Upload Error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      { cause: error }
    );
  }
}

const DB_NAME = 'mosaic_image_cache';
const STORE_NAME = 'blobs';

function openCacheDB(): Promise<IDBDatabase> {
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

async function getCachedImage(fileId: string): Promise<Blob | undefined> {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheImage(fileId: string, blob: Blob): Promise<void> {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteCachedImage(fileId: string): Promise<void> {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalImageUrl(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  const cachedBlob = await getCachedImage(fileId);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }
  if (!navigator.onLine) return null;
  try {
    const url = storage.getFileView({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: fileId,
    });
    const res = await guardedCall(async () => {
      const r = await fetch(url.toString(), {
        credentials: 'include',
        headers: { 'X-Appwrite-Project': APPWRITE_CONFIG.projectId },
      });
      if (r.status === 401) {
        throw makeUnauthorizedError();
      }
      return r;
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    await cacheImage(fileId, blob);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('[Storage] Failed to fetch image:', err);
    return null;
  }
}

export async function deleteImage(fileId: string): Promise<void> {
  try {
    await guardedCall(() =>
      storage.deleteFile({
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId: fileId,
      })
    );
  } catch (err) {
    console.warn(
      '[Storage] Failed to delete image from Appwrite:',
      fileId,
      err
    );
  }
  await deleteCachedImage(fileId);
}

export function getImagePreviewUrl(fileId: string): string {
  const url = storage.getFilePreview({
    bucketId: APPWRITE_CONFIG.bucketId,
    fileId: fileId,
    width: 200,
    height: 200,
  });
  return url.toString();
}

export function getImageFullUrl(fileId: string): string {
  const url = storage.getFileView({
    bucketId: APPWRITE_CONFIG.bucketId,
    fileId: fileId,
  });
  return url.toString();
}
