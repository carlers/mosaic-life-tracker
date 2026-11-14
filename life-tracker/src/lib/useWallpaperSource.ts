import { useAuth } from '../hooks/useAuth';
import { useTaskImage } from '../hooks/useTaskImage';
import { wallpaperSourceForId } from './calendarWallpaperPresets';
import type { CalendarWallpaperId } from './calendarWallpaper';
import { wallpaperUploadSlot } from './wallpaperPageSettings';
import { wallpaperFileIdForOwner } from './wallpaperUploadStorage';

/** Never expose a custom wallpaper URL without the active account's identity. */
export function useWallpaperSource(id: CalendarWallpaperId): string | null {
  const { user } = useAuth();
  const slot = wallpaperUploadSlot(id);
  const fileId = user?.$id && slot !== null
    ? wallpaperFileIdForOwner(user.$id, slot) : undefined;
  const { imageUrl } = useTaskImage(fileId, Boolean(fileId));
  return slot === null ? wallpaperSourceForId(id) : imageUrl;
}
