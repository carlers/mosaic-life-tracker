import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { DiaryDocument } from '../db/schema';

export function useDiary() {
  const { user } = useAuth();
  const userId = user?.$id;

  const [entries, setEntries] = useState<DiaryDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    let subscription: { unsubscribe: () => void } | undefined;
    let isMounted = true;

    async function init() {
      try {
        const db = getDatabase();
        const query = db.diary.find({
          selector: {
            userId: uid,
            isDeleted: false,
          },
          sort: [{ date: 'desc' }],
        });

        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setEntries(docs);
          setLoadedUserId(uid);
        });

        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.error('[useDiary] Error loading diary:', error);
        if (isMounted) setLoadedUserId(uid);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);

  const saveEntry = useCallback(async (date: string, content: string, visibility: 'public' | 'followers' | 'private' = 'private') => {
    const uid = user?.$id;
    if (!uid) {
      console.error('[useDiary] Cannot save entry: User not authenticated');
      return;
    }
    const db = getDatabase();
    const id = `${uid}_${date}`;
    const now = new Date().toISOString();
    const doc = await db.diary.findOne(id).exec();
    if (doc) {
      await doc.patch({
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
      await db.diary.insert(newEntry);
    }
  }, [user?.$id]);

  const deleteEntry = useCallback(async (date: string) => {
    const uid = user?.$id;
    if (!uid) {
      console.error('[useDiary] Cannot delete entry: User not authenticated');
      return;
    }
    const id = `${uid}_${date}`;
    const doc = await getDatabase().diary.findOne(id).exec();
    if (doc) {
      await doc.patch({ isDeleted: true });
    }
  }, [user?.$id]);

  const getEntryByDate = useCallback((date: string): DiaryDocument | undefined => {
    return entries.find(e => e.date === date);
  }, [entries]);

  const visibleEntries = userId && loadedUserId === userId ? entries : [];
  const isLoading = !!userId && loadedUserId !== userId;

  return { entries: visibleEntries, isLoading, saveEntry, deleteEntry, getEntryByDate };
}