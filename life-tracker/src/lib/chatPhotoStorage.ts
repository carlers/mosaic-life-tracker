import { Permission, Role } from 'appwrite';
import { APPWRITE_STORAGE_BUCKET_ID } from './appwriteConfig';
import { guardedStorage } from './sdk';
import { compressImage } from './storage';
import { cacheImage, getCachedImage, deleteCachedImage } from './imageCache';

const DB_NAME = 'mosaic_chat_photo_outbox_v1';
const STORE = 'photos';
const MAX_BYTES = 262144;
interface StagedPhoto { id: string; userId: string; blob: Blob }
let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(error => { opening = null; throw error; });
  return opening;
}
function settled(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error('Photo staging transaction aborted'));
  });
}
export function chatPhotoFileId(messageId: string): string {
  if (!/^msg_[A-Za-z0-9_]{1,27}$/.test(messageId)) throw Error('Invalid message identity');
  const id = 'chat_' + messageId.slice(4);
  if (id.length > 36) throw Error('Chat file ID is too long');
  return id;
}
export async function stageChatPhoto(userId: string, fileId: string, file: File): Promise<void> {
  if (!userId || !/^chat_[A-Za-z0-9_]{1,27}$/.test(fileId)) throw Error('Invalid photo owner');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Unsupported image type');
  const blob = await compressImage(file);
  if (blob.type !== 'image/webp' || blob.size < 1 || blob.size > MAX_BYTES)
    throw Error('Photo is too large after compression');
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const done = settled(tx);
  tx.objectStore(STORE).put({ id: fileId, userId, blob } satisfies StagedPhoto, fileId);
  await done;
  await cacheImage('chat:' + userId + ':' + fileId, blob).catch(() => {});
}
async function staged(userId: string, fileId: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const done = settled(tx);
  const record = await new Promise<StagedPhoto | undefined>((resolve, reject) => {
    const req = tx.objectStore(STORE).get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await done;
  return record?.userId === userId ? record.blob : null;
}
export async function removeStagedChatPhoto(userId: string, fileId: string): Promise<void> {
  if (!await staged(userId, fileId)) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const done = settled(tx);
  tx.objectStore(STORE).delete(fileId);
  await done;
}
export async function clearStagedChatPhotosForUser(userId: string): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const done = settled(tx);
  const request = tx.objectStore(STORE).getAll();
  request.onsuccess = () => {
    for (const entry of request.result as StagedPhoto[]) {
      if (entry.userId === userId) tx.objectStore(STORE).delete(entry.id);
    }
  };
  await done;
}

export async function discardChatPhoto(userId: string, fileId: string): Promise<void> {
  // Owner-signed best-effort deletion covers an upload that completed just
  // before local cancellation. The trusted Function independently handles
  // delivered photo revocation and idempotent 404s.
  if (userId && /^chat_[A-Za-z0-9_]{1,27}$/.test(fileId)) {
    try {
      const file = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
      if (file.$permissions?.includes(Permission.delete(Role.user(userId))))
        await guardedStorage.deleteFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
    } catch { /* Offline cancellation retains the remote retry requirement. */ }
  }
  await removeStagedChatPhoto(userId, fileId);
  await deleteCachedImage('chat:' + userId + ':' + fileId);
}
function checkRemotePhoto(file: { mimeType?: string; sizeOriginal?: number; $permissions?: string[] }, userId: string): void {
  const required = [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))];
  if (file.mimeType !== 'image/webp' || !file.sizeOriginal ||
      file.sizeOriginal > MAX_BYTES || !required.every(p => file.$permissions?.includes(p))) {
    throw Object.assign(Error('Remote photo does not belong to this account'), { code: 403 });
  }
}
export async function uploadPendingChatPhoto(userId: string, messageId: string, fileId: string): Promise<void> {
  if (fileId !== chatPhotoFileId(messageId)) {
    throw Object.assign(Error('Invalid chat photo identity'), { code: 400 });
  }
  try {
    checkRemotePhoto(await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId }), userId);
    return;
  } catch (err) {
    if ((err as { code?: number })?.code !== 404) throw err;
  }
  const blob = await staged(userId, fileId);
  if (!blob) throw Object.assign(Error('Pending photo missing from this device'), { code: 422 });
  try {
    await guardedStorage.createFile({
      bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId,
      file: new File([blob], fileId + '.webp', { type: 'image/webp' }),
      permissions: [Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
    });
  } catch (err) {
    if ((err as { code?: number })?.code !== 409) throw err;
  }
  checkRemotePhoto(await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId }), userId);
}
export async function getChatPhotoUrl(userId: string, fileId: string): Promise<string | null> {
  if (!userId || !/^chat_[A-Za-z0-9_]{1,27}$/.test(fileId)) return null;
  const local = await staged(userId, fileId).catch(() => null);
  if (local) return URL.createObjectURL(local);
  const key = 'chat:' + userId + ':' + fileId;
  const cached = await getCachedImage(key).catch(() => undefined);
  if (cached) return URL.createObjectURL(cached);
  try {
    const blob = await guardedStorage.downloadFileBlob({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
    if (blob.type !== 'image/webp' || blob.size > MAX_BYTES) return null;
    void cacheImage(key, blob).catch(() => {});
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
