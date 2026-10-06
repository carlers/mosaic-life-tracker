import { Permission, Role } from 'appwrite';
import {
  guardedCall,
  makeUnauthorizedError,
  isUnauthorizedError,
  OfflineError,
} from './authEvents';
import { guardedStorage, guardedAccount } from './sdk';
import { getCachedImage, cacheImage, deleteCachedImage } from './imageCache';
import { getConnectivitySnapshot } from './connectivity';
import {
  createPendingImage,
  deletePendingImage,
  getPendingImage,
  isPendingImageId,
} from './pendingImages';
import {
  APPWRITE_PROJECT_ID,
  APPWRITE_STORAGE_BUCKET_ID,
} from './appwriteConfig';

const APPWRITE_CONFIG = {
  projectId: APPWRITE_PROJECT_ID,
  bucketId: APPWRITE_STORAGE_BUCKET_ID,
};

export async function compressImage(file: File): Promise<Blob> {
  const options = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/webp',
  };
  try {
    const { default: imageCompression } = await import('browser-image-compression');
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

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const user = await guardedAccount.get();
    return user?.$id || null;
  } catch (err) {
    if (isUnauthorizedError(err)) {
      return null;
    }
    throw new OfflineError(
      "You're offline. Try again when you reconnect."
    );
  }
}

function buildFilePermissions(userId: string, readForAllUsers = false) {
  return [
    readForAllUsers ? Permission.read(Role.users()) : Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function isNotFoundError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

function isConflictError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 409;
}

function isValidFileId(fileId: string): boolean {
  return (
    fileId.length > 0 &&
    fileId.length <= 36 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileId)
  );
}

async function uploadCompressedBlobWithId(
  compressedBlob: Blob,
  fileId: string,
  userId: string,
  readForAllUsers = false
): Promise<string> {
  const webpFile = new File([compressedBlob], `${fileId}.webp`, {
    type: 'image/webp',
  });
  try {
    await guardedStorage.createFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId,
      file: webpFile,
      permissions: buildFilePermissions(userId, readForAllUsers),
    });
    await cacheImage(fileId, compressedBlob).catch((error) => {
      console.warn('[Storage] Failed to cache uploaded image:', error);
    });
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

async function uploadImageWithId(
  file: File,
  fileId: string,
  userId: string,
  readForAllUsers = false
): Promise<string> {
  return uploadCompressedBlobWithId(await compressImage(file), fileId, userId, readForAllUsers);
}

/** Task attachments are visible through the authorized friend calendar. */
export async function saveImage(
  file: File,
  userId: string
): Promise<string> {
  if (!userId) throw new Error('Cannot upload image: no authenticated user');
  const compressedBlob = await compressImage(file);
  if (getConnectivitySnapshot().status !== 'online') {
    return createPendingImage(userId, compressedBlob);
  }
  try {
    return await uploadCompressedBlobWithId(
      compressedBlob,
      generateFileId(),
      userId,
      true
    );
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const code = (cause as { code?: number } | null)?.code;
    const transient =
      !isUnauthorizedError(cause) &&
      (typeof code !== 'number' || code === 429 || code >= 500);
    if (!transient) throw error;
    return createPendingImage(userId, compressedBlob);
  }
}

export async function uploadPendingImage(
  fileId: string,
  userId: string
): Promise<string> {
  if (!isPendingImageId(fileId)) return fileId;
  const blob = await getPendingImage(fileId, userId);
  if (!blob) {
    throw new Error('Pending image is missing or belongs to another account.');
  }
  const remoteFileId = `img_${fileId.slice('localimg_'.length)}`;
  try {
    return await uploadCompressedBlobWithId(blob, remoteFileId, userId, true);
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (isConflictError(cause)) {
      await guardedStorage.updateFile({
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId: remoteFileId,
        permissions: buildFilePermissions(userId, true),
      });
      await cacheImage(remoteFileId, blob).catch(() => {});
      return remoteFileId;
    }
    throw error;
  }
}

export async function saveProfileImage(file: File, userId: string): Promise<string> {
  if (!userId) throw new Error('Cannot save profile image: no authenticated user');
  const compressedBlob = await compressImage(file);
  if (getConnectivitySnapshot().status !== 'online') return createPendingImage(userId, compressedBlob);
  try {
    return await uploadCompressedBlobWithId(compressedBlob, generateFileId(), userId, true);
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const code = (cause as { code?: number } | null)?.code;
    const transient = !isUnauthorizedError(cause) && (typeof code !== 'number' || code === 429 || code >= 500);
    if (!transient) throw error;
    return createPendingImage(userId, compressedBlob);
  }
}

export async function makeProfileImageReadable(fileId: string, userId: string): Promise<void> {
  if (!fileId || isPendingImageId(fileId) || !userId) return;
  await guardedStorage.updateFile({
    bucketId: APPWRITE_CONFIG.bucketId,
    fileId,
    permissions: [
      Permission.read(Role.users()),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  });
}

export async function uploadImage(file: File): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Cannot upload image: no authenticated user');
  }
  return uploadImageWithId(file, generateFileId(), userId);
}

export interface EnsuredImage {
  fileId: string;
  uploaded: boolean;
}

/**
 * Ensures a deterministic restored/imported task image exists. Existing files
 * are reused so repeated backup restores remain idempotent. Restored task
 * attachments use authenticated-user read access because friends may receive
 * the owning task through the authorized friend calendar.
 */
export async function ensureRestoredImage(
  file: File,
  preferredFileId: string,
  expectedUserId?: string,
  alreadyCompressed = false
): Promise<EnsuredImage> {
  if (!isValidFileId(preferredFileId)) {
    throw new Error('Backup image has an invalid file ID.');
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Cannot restore image: no authenticated user');
  }
  if (expectedUserId && userId !== expectedUserId) {
    throw new Error('Cannot restore image: authenticated user changed');
  }

  try {
    await guardedStorage.getFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: preferredFileId,
    });
    await guardedStorage.updateFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: preferredFileId,
      permissions: buildFilePermissions(userId, true),
    });
    return { fileId: preferredFileId, uploaded: false };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  try {
    await (alreadyCompressed ? uploadCompressedBlobWithId : uploadImageWithId)(
      file,
      preferredFileId,
      userId,
      true
    );
    return { fileId: preferredFileId, uploaded: true };
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (isConflictError(cause)) {
      await guardedStorage.updateFile({
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId: preferredFileId,
        permissions: buildFilePermissions(userId, true),
      });
      return { fileId: preferredFileId, uploaded: false };
    }
    throw error;
  }
}

export async function getLocalImageUrl(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  if (isPendingImageId(fileId)) {
    const pendingBlob = await getPendingImage(fileId);
    return pendingBlob ? URL.createObjectURL(pendingBlob) : null;
  }
  const cachedBlob = await getCachedImage(fileId);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }
  if (getConnectivitySnapshot().status !== 'online') return null;
  try {
    const url = guardedStorage.getFileView({
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
  if (isPendingImageId(fileId)) {
    await deletePendingImage(fileId);
    return;
  }
  try {
    await guardedStorage.deleteFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: fileId,
    });
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
  const url = guardedStorage.getFilePreview({
    bucketId: APPWRITE_CONFIG.bucketId,
    fileId: fileId,
    width: 200,
    height: 200,
  });
  return url.toString();
}

export function getImageFullUrl(fileId: string): string {
  const url = guardedStorage.getFileView({
    bucketId: APPWRITE_CONFIG.bucketId,
    fileId: fileId,
  });
  return url.toString();
}
