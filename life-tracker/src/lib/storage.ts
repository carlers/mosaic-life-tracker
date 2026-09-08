import imageCompression from 'browser-image-compression';

const APPWRITE_CONFIG = {
  endpoint: 'https://sgp.cloud.appwrite.io',
  projectId: '6a9703c50016b37110ff',
  bucketId: 'task_images',
};

// --- Image Compression & Upload ---

export async function compressImage(file: File): Promise<Blob> {
  const options = {
    maxSizeMB: 0.15, // 150KB target
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp', // Force WebP for superior compression
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('[Storage] Image compression failed:', error);
    throw error;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const compressedBlob = await compressImage(file);
  const fileId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Explicitly name the file with .webp extension to satisfy Appwrite validation
  const webpFile = new Blob([compressedBlob], { type: 'image/webp' });
  
  const formData = new FormData();
  formData.append('fileId', fileId);
  formData.append('file', webpFile, `${fileId}.webp`); 
  formData.append('permissions[]', 'read("any")');
  formData.append('permissions[]', 'update("any")');
  formData.append('permissions[]', 'delete("any")');
  formData.append('permissions[]', 'write("any")');

  const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': APPWRITE_CONFIG.projectId },
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Appwrite Storage Upload Error: ${errorText}`);
  }
  return fileId;
}

// --- Offline Caching Layer ---

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

/**
 * Fetches an image with a cache-first strategy for 100% offline support.
 * Returns a Blob URL that MUST be revoked by the consumer via URL.revokeObjectURL()
 */
export async function getLocalImageUrl(fileId: string): Promise<string | null> {
  if (!fileId) return null;

  // 1. Check local cache first
  const cachedBlob = await getCachedImage(fileId);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }

  // 2. If offline and not cached, return null
  if (!navigator.onLine) return null;

  // 3. Fetch from Appwrite, cache it, and return URL
  try {
    const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'X-Appwrite-Project': APPWRITE_CONFIG.projectId },
    });

    if (!res.ok) return null;

    const blob = await res.blob();
    await cacheImage(fileId, blob); // Save to IndexedDB
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('[Storage] Failed to fetch image:', err);
    return null;
  }
}

// --- Deletion & Cleanup ---

export async function deleteImage(fileId: string): Promise<void> {
  // Delete from Appwrite Cloud
  const url = `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Appwrite-Project': APPWRITE_CONFIG.projectId },
      credentials: 'include',
    });
    if (!res.ok) console.warn('[Storage] Failed to delete image from Appwrite:', fileId);
  } catch (err) {
    console.warn('[Storage] Network error deleting image:', err);
  }

  // ALWAYS delete from local cache to free up space
  await deleteCachedImage(fileId);
}

// Legacy helpers kept for backward compatibility / non-cached contexts
export function getImagePreviewUrl(fileId: string): string {
  return `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/preview?project=${APPWRITE_CONFIG.projectId}&width=200&height=200`;
}

export function getImageFullUrl(fileId: string): string {
  return `${APPWRITE_CONFIG.endpoint}/v1/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}/view?project=${APPWRITE_CONFIG.projectId}`;
}