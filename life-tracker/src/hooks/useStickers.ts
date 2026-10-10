import { useCallback, useMemo } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { normalizeStickers, STICKER_SETTINGS_KEY, MAX_STICKERS, type SavedSticker } from '../lib/stickerProtocol';
import { uploadSticker, deleteUnusedSticker } from '../lib/stickerStorage';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from '../lib/accountWorkScope';

export function useStickers() {
  const { user } = useAuth();
  const { settings, isLoading, setSetting } = useSettings();
  const userId = user?.$id ?? '';
  const stickers = useMemo(
    () => normalizeStickers(settings[STICKER_SETTINGS_KEY]),
    [settings]
  );

  const addSticker = useCallback(async (file: File, label: string) => {
    if (!userId) throw new Error('Sign in to add stickers.');
    if (stickers.length >= MAX_STICKERS) throw new Error('Sticker collection is full (32).');
    const generation = captureAccountWorkGeneration(userId);
    if (generation === null) throw new Error('Session changed. Retry sticker upload.');
    const fileId = await uploadSticker(file, userId);
    if (!isAccountWorkCurrent(userId, generation)) throw new Error('Session changed. Retry sticker upload.');
    if (stickers.some(item => item.fileId === fileId)) return;
    const next: SavedSticker[] = [...stickers, { fileId, label }];
    await setSetting(STICKER_SETTINGS_KEY, normalizeStickers(next));
  }, [userId, stickers, setSetting]);

  const removeSticker = useCallback(async (fileId: string) => {
    if (!userId) return;
    const generation = captureAccountWorkGeneration(userId);
    if (generation === null) return;
    await setSetting(STICKER_SETTINGS_KEY, stickers.filter(s => s.fileId !== fileId));
    if (!isAccountWorkCurrent(userId, generation)) return;
    // A recipient may still need a sticker from an earlier message; only
    // delete if we can prove no local references *and* no remote recipient ACL.
    try {
      const rows = await getDatabase().messages.find({
        selector: { userId, isDeleted: false },
      }).exec();
      const referenced = rows.some(row => row.content.includes(fileId));
      await deleteUnusedSticker(fileId, userId, referenced);
    } catch (error) {
      console.warn('[Stickers] Deferred unused file cleanup:', error);
    }
  }, [userId, stickers, setSetting]);

  return { stickers, isLoading, addSticker, removeSticker };
}
