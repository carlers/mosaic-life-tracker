import { Permission, Role } from 'appwrite';
import { APPWRITE_STORAGE_BUCKET_ID } from './appwriteConfig';
import { guardedAccount, guardedStorage } from './sdk';
import { cacheImage, deleteCachedImage } from './imageCache';
import type { WallpaperUploadSlot } from './calendarWallpaper';
import { wallpaperFileIdForOwner } from './wallpaperFileIds';
export { wallpaperFileIdForOwner } from './wallpaperFileIds';

const LIMIT = 5;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_STORED_BYTES = 1024 * 1024;
export const MAX_WALLPAPER_UPLOADS = LIMIT;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

function ownerPermissions(ownerId: string) {
  return [
    Permission.read(Role.user(ownerId)),
    Permission.update(Role.user(ownerId)),
    Permission.delete(Role.user(ownerId)),
  ];
}
function verified(file: { mimeType?: string; sizeOriginal?: number; $permissions?: string[] }, ownerId: string) {
  if (file.mimeType !== 'image/webp' || !file.sizeOriginal
      || file.sizeOriginal > MAX_STORED_BYTES
      || !ownerPermissions(ownerId).every(permission => file.$permissions?.includes(permission)))
    throw new Error('Wallpaper ownership or file format could not be verified.');
}
async function assertOwner(ownerId: string) {
  if (!ownerId || (await guardedAccount.get()).$id !== ownerId)
    throw new Error('Account changed. Reopen wallpaper settings and try again.');
}
function errorCode(error: unknown) {
  return (error as { code?: number } | null)?.code;
}

export async function listOwnerWallpaperSlots(ownerId: string): Promise<WallpaperUploadSlot[]> {
  await assertOwner(ownerId);
  const slots: WallpaperUploadSlot[] = [];
  for (const slot of [0, 1, 2, 3, 4] as const) {
    const fileId = wallpaperFileIdForOwner(ownerId, slot);
    try {
      const file = await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
      verified(file, ownerId);
      slots.push(slot);
    } catch (error) {
      if (errorCode(error) !== 404) throw error;
    }
  }
  await assertOwner(ownerId);
  return slots;
}
export async function uploadOwnerWallpaper(
  ownerId: string, file: File
): Promise<WallpaperUploadSlot> {
  if (!allowed.has(file.type) || file.size <= 0 || file.size > MAX_SOURCE_BYTES)
    throw new Error('Choose a JPEG, PNG or WebP image no larger than 12 MB.');
  const occupied = await listOwnerWallpaperSlots(ownerId);
  const slot = ([0, 1, 2, 3, 4] as const).find(value => !occupied.includes(value));
  if (slot === undefined) throw new Error('Maximum of five wallpapers. Delete one to add another.');
  const { default: compress } = await import('browser-image-compression');
  const webp = await compress(file, {
    maxSizeMB: 0.75, maxWidthOrHeight: 1920, useWebWorker: true,
    fileType: 'image/webp',
  });
  if (webp.type !== 'image/webp' || webp.size < 1 || webp.size > MAX_STORED_BYTES)
    throw new Error('Image could not be compressed within the 1 MB wallpaper limit.');
  await assertOwner(ownerId);
  const fileId = wallpaperFileIdForOwner(ownerId, slot);
  // The fixed five server-wide file IDs per account prohibit a sixth upload via
  // this UI even if two devices race. A 409 is a collision, never overwrite.
  try {
    const remote = await guardedStorage.createFile({
      bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId,
      file: new File([webp], `wallpaper-${slot + 1}.webp`, { type: 'image/webp' }),
      permissions: ownerPermissions(ownerId),
    });
    verified(remote, ownerId);
  } catch (error) {
    if (errorCode(error) === 409)
      throw new Error('Wallpaper slot was filled on another device. Refresh and try again.', { cause: error });
    throw error;
  }
  await cacheImage(fileId, webp).catch(() => {});
  await assertOwner(ownerId);
  return slot;
}

/** Explicit owner deletion is limited to one of this account's five wallpaper
 * IDs. Unlike shared task/Diary media it has no external record references. */
export async function deleteOwnerWallpaper(ownerId: string, slot: WallpaperUploadSlot): Promise<void> {
  await assertOwner(ownerId);
  const fileId = wallpaperFileIdForOwner(ownerId, slot);
  verified(await guardedStorage.getFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId }), ownerId);
  await assertOwner(ownerId);
  await guardedStorage.deleteFile({ bucketId: APPWRITE_STORAGE_BUCKET_ID, fileId });
  await deleteCachedImage(fileId).catch(() => {});
}
