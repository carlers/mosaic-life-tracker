import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeDiaryRowId } from '../lib/settingsRowId';
import { useOwnerMutationGuard } from './useOwnerMutationGuard';
import type { DiaryDocument } from '../db/schema';
import { parseDiaryPhotos, serializeDiaryPhotos } from '../lib/diaryPhotos';
import { MOSAIC_FEATURE_PROFILE } from '../lib/backendCapabilities';

export type DiaryVisibility = DiaryDocument['visibility'];

function validDiaryDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

export function useDiary(enabled = true) {
  const { user } = useAuth();
  const assertOwner = useOwnerMutationGuard();
  const { data: entries, isLoading } = useRxCollection<DiaryDocument>({
    collection: 'diary',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'desc' }],
    logPrefix: '[useDiary]',
    enabled,
  });

  const findStored = useCallback(async (date: string, uid: string) => {
    const docs = await getDatabase().diary.find({
      selector: { userId: uid, date },
    }).exec();
    assertOwner(uid);
    if (docs.length > 1) throw new Error('Multiple diary entries exist for this day; no change was made.');
    if (docs[0] && (docs[0].userId !== uid || docs[0].date !== date))
      throw new Error('Diary identity changed; no change was made.');
    return docs[0] ?? null;
  }, [assertOwner]);

  const saveEntry = useCallback(async (
    date: string, content: string, visibility?: DiaryVisibility, emoji = '', photos?: string
  ) => {
    const uid = user?.$id;
    if (!uid) throw new Error('You must be signed in to save a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    if (typeof content !== 'string' || typeof emoji !== 'string' || emoji.length > 32 ||
      !['', 'public', 'followers', 'private'].includes(visibility ?? '')) {
      throw new Error('Invalid diary entry.');
    }
    const doc = await findStored(date, uid);
    assertOwner(uid);
    const savedPhotos = photos === undefined ? parseDiaryPhotos(doc?.photos) : parseDiaryPhotos(photos);
    if (photos !== undefined && serializeDiaryPhotos(savedPhotos) !== photos)
      throw new Error('Invalid diary photo list.');
    if (!content.trim() && !emoji.trim() && savedPhotos.length === 0)
      throw new Error('Write a diary entry, choose an emoji, or attach a photo.');
    const now = new Date().toISOString();
    const selectedVisibility = visibility ?? (doc && !doc.isDeleted ? doc.visibility : 'private');
    // Private Diary photos are part of the Supabase personal MVP.
    // Social visibility remains unsupported and must never be widened here.
    if (['core-diary', 'personal'].includes(MOSAIC_FEATURE_PROFILE) && selectedVisibility !== 'private')
      throw new Error('Diary entries must remain private on this backend.');
    if (doc) {
      await doc.incrementalPatch({
        content, emoji, photos: serializeDiaryPhotos(savedPhotos), visibility: selectedVisibility, updatedAt: now, isDeleted: false,
      });
      return;
    }
    const id = makeDiaryRowId(uid, date);
    await getDatabase().diary.insert({
      id, date, content, emoji, photos: serializeDiaryPhotos(savedPhotos), visibility: selectedVisibility, userId: uid,
      createdAt: now, updatedAt: now, isDeleted: false,
    } satisfies DiaryDocument);
  }, [user?.$id, findStored, assertOwner]);

  const deleteEntry = useCallback(async (date: string) => {
    const uid = user?.$id;
    if (!uid) throw new Error('You must be signed in to delete a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    const doc = await findStored(date, uid);
    assertOwner(uid);
    if (doc && !doc.isDeleted) {
      await doc.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() });
    }
  }, [user?.$id, findStored, assertOwner]);

  const getEntryByDate = useCallback(
    (date: string): DiaryDocument | undefined => entries.find(entry => entry.date === date),
    [entries]
  );

  return { entries, isLoading, saveEntry, deleteEntry, getEntryByDate };
}
