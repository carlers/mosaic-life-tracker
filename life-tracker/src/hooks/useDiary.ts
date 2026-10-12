import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeDiaryRowId } from '../lib/settingsRowId';
import { upsertLocalDoc } from '../lib/localUpsert';
import type { DiaryDocument } from '../db/schema';

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
    if (docs.length > 1) throw new Error('Multiple diary entries exist for this day; no change was made.');
    return docs[0] ?? null;
  }, []);

  const saveEntry = useCallback(async (
    date: string, content: string, visibility?: DiaryVisibility, emoji = ''
  ) => {
    const uid = user?.$id;
    if (!uid) throw new Error('You must be signed in to save a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    if (typeof content !== 'string' || typeof emoji !== 'string' || emoji.length > 32 ||
      !['', 'public', 'followers', 'private'].includes(visibility ?? '')) {
      throw new Error('Invalid diary entry.');
    }
    if (!content.trim() && !emoji.trim()) throw new Error('Write a diary entry or choose an emoji.');
    const doc = await findStored(date, uid);
    const now = new Date().toISOString();
    const selectedVisibility = visibility ?? (doc && !doc.isDeleted ? doc.visibility : 'private');
    if (doc) {
      await upsertLocalDoc('diary', doc.id, {
        content, emoji, visibility: selectedVisibility, updatedAt: now, isDeleted: false,
      });
      return;
    }
    const id = makeDiaryRowId(uid, date);
    await upsertLocalDoc('diary', id, {
      id, date, content, emoji, visibility: selectedVisibility, userId: uid,
      createdAt: now, updatedAt: now, isDeleted: false,
    } satisfies DiaryDocument);
  }, [user?.$id, findStored]);

  const deleteEntry = useCallback(async (date: string) => {
    const uid = user?.$id;
    if (!uid) throw new Error('You must be signed in to delete a diary entry.');
    if (!validDiaryDate(date)) throw new Error('Invalid diary date.');
    const doc = await findStored(date, uid);
    if (doc && !doc.isDeleted) {
      await doc.incrementalPatch({ isDeleted: true, updatedAt: new Date().toISOString() });
    }
  }, [user?.$id, findStored]);

  const getEntryByDate = useCallback(
    (date: string): DiaryDocument | undefined => entries.find(entry => entry.date === date),
    [entries]
  );

  return { entries, isLoading, saveEntry, deleteEntry, getEntryByDate };
}
