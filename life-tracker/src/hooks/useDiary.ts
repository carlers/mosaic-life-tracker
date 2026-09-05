import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { CURRENT_USER_ID } from '../db/sync';
import type { DiaryDocument } from '../db/schema';

export function useDiary() {
  const [entries, setEntries] = useState<DiaryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;
    
    async function init() {
      try {
        const db = getDatabase();
        const query = db.diary.find({
          selector: {
            userId: CURRENT_USER_ID,
            isDeleted: false,
          },
          sort: [{ date: 'desc' }],
        });

        subscription = query.$.subscribe((docs) => {
          setEntries(docs);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('[useDiary] Error loading diary:', error);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const saveEntry = useCallback(async (date: string, content: string, visibility: 'public' | 'followers' | 'private' = 'private') => {
    const db = getDatabase();
    const id = `${CURRENT_USER_ID}_${date}`;
    const now = new Date().toISOString();

    const doc = await db.diary.findOne(id).exec();
    
    if (doc) {
      await doc.patch({
        content,
        visibility,
        updatedAt: now,
        isDeleted: false, // In case it was previously soft-deleted
      });
    } else {
      const newEntry: DiaryDocument = {
        id,
        date,
        content,
        visibility,
        userId: CURRENT_USER_ID,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      await db.diary.insert(newEntry);
    }
  }, []);

  const deleteEntry = useCallback(async (date: string) => {
    const id = `${CURRENT_USER_ID}_${date}`;
    const doc = await getDatabase().diary.findOne(id).exec();
    if (doc) {
      await doc.patch({ isDeleted: true });
    }
  }, []);

  const getEntryByDate = useCallback((date: string): DiaryDocument | undefined => {
    return entries.find(e => e.date === date);
  }, [entries]);

  return { entries, isLoading, saveEntry, deleteEntry, getEntryByDate };
}