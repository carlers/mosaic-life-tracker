import { hashString } from './settingsRowId';
import type { WallpaperUploadSlot } from './calendarWallpaper';

/** Five predictable file IDs per authenticated account, never a global prefix. */
export function wallpaperFileIdForOwner(ownerId: string, slot: WallpaperUploadSlot): string {
  if (!ownerId || !Number.isInteger(slot) || slot < 0 || slot >= 5)
    throw new Error('Invalid wallpaper slot or account.');
  const raw = `wall_${ownerId}_${slot}`;
  return raw.length <= 36 && /^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(raw)
    ? raw : `wall_${hashString('wallpaper:' + ownerId)}_${slot}`;
}
export function wallpaperUploadSlot(id: unknown): WallpaperUploadSlot | null {
  return typeof id === 'string' && /^upload:[0-4]$/.test(id)
    ? Number(id.slice(-1)) as WallpaperUploadSlot : null;
}
