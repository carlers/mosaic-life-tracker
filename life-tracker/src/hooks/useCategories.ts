import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { CategoryDocument } from '../db/schema';

let reorderInProgress = false;

export function useCategories() {
  const { user } = useAuth();
  const userId = user?.$id;
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let subscription: { unsubscribe: () => void } | undefined;
    let isMounted = true;

    async function init() {
      try {
        const db = getDatabase();
        const query = db.categories.find({
          selector: {
            userId: uid,
            isDeleted: false,
          },
          sort: [{ order: 'asc' }],
        });
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          setCategories(docs);
          setLoadedUserId(uid);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.error('[useCategories] Error loading categories:', error);
        if (isMounted) setLoadedUserId(uid);
      }
    }

    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);

  const addCategory = useCallback(
    async (cat: Omit<CategoryDocument, 'id' | 'userId' | 'isDeleted'>) => {
      const uid = user?.$id;
      if (!uid) {
        console.error(
          '[useCategories] Cannot add category: User not authenticated'
        );
        return;
      }
      const db = getDatabase();
      const newCat: CategoryDocument = {
        ...cat,
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        isDeleted: false,
      };
      try {
        await db.categories.insert(newCat);
      } catch (error) {
        console.error('[useCategories] Error inserting category:', error);
      }
    },
    [user?.$id]
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<CategoryDocument>) => {
      const db = getDatabase();
      try {
        const doc = await db.categories.findOne(id).exec();
        if (!doc) return;
        // Skip if nothing would actually change.
        let changed = false;
        for (const key of Object.keys(updates) as (keyof CategoryDocument)[]) {
          if (doc[key] !== updates[key]) {
            changed = true;
            break;
          }
        }
        if (!changed) return;
        await doc.incrementalPatch(updates);
      } catch (err) {
        console.error('[useCategories] updateCategory failed:', err);
      }
    },
    []
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await updateCategory(id, { isDeleted: true });
    },
    [updateCategory]
  );

  const reorderCategories = useCallback(
    async (newOrder: CategoryDocument[]) => {
      if (reorderInProgress) return;
      reorderInProgress = true;
      try {
        const db = getDatabase();
        // Serialize patches to avoid racing sync writes on the same
        // collection. Skip no-op writes. incrementalPatch retries on
        // CONFLICT internally.
        for (let i = 0; i < newOrder.length; i++) {
          const id = newOrder[i].id;
          try {
            const doc = await db.categories.findOne(id).exec();
            if (!doc) continue;
            if (doc.order === i) continue;
            await doc.incrementalPatch({ order: i });
          } catch (err) {
            console.error(
              `[useCategories] reorder failed for ${id}:`,
              err
            );
          }
        }
      } finally {
        reorderInProgress = false;
      }
    },
    []
  );

  const visibleCategories =
    userId && loadedUserId === userId ? categories : [];
  const isLoading = !!userId && loadedUserId !== userId;

  return {
    categories: visibleCategories,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}