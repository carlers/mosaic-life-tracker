import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeDiaryRowId } from '../lib/settingsRowId';
import { upsertLocalDoc } from '../lib/localUpsert';
import type { DiaryDocument } from '../db/schema';

export function useDiary() {
  const { user } = useAuth();

  const { data: entries, isLoading } = useRxCollection<DiaryDocument>({
    collection: 'diary',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'desc' }],
    logPrefix: '[useDiary]',
  });

  const saveEntry = useCallback(
    async (
      date: string,
      content: string,
      visibility: 'public' | 'followers' | 'private' = 'private'
    ) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useDiary] Cannot save entry: User not authenticated');
        return;
      }
      const id = makeDiaryRowId(uid, date);
      const now = new Date().toISOString();
      const doc = await getDatabase().diary.findOne(id).exec();
      if (doc) {
        await upsertLocalDoc('diary', id, {
          content,
          visibility,
          updatedAt: now,
          isDeleted: false,
        });
      } else {
        const newEntry: DiaryDocument = {
          id,
          date,
          content,
          visibility,
          userId: uid,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
        };
        await upsertLocalDoc('diary', id, newEntry);
      }
    },
    [user?.$id]
  );

  const deleteEntry = useCallback(
    async (date: string) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useDiary] Cannot delete entry: User not authenticated');
        return;
      }
      const id = makeDiaryRowId(uid, date);
      const doc = await getDatabase().diary.findOne(id).exec();
      if (doc) {
        await doc.incrementalPatch({
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [user?.$id]
  );

  const getEntryByDate = useCallback(
    (date: string): DiaryDocument | undefined => {
      return entries.find((e) => e.date === date);
    },
    [entries]
  );

  return {
    entries,
    isLoading,
    saveEntry,
    deleteEntry,
    getEntryByDate,
  };
}
