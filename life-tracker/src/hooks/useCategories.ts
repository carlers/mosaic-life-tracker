import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument } from '../db/schema';

export function useCategories(enabled = true) {
  const { user } = useAuth();
  const reorderQueue = useRef(Promise.resolve());

  const { data: categories, isLoading } = useRxCollection<CategoryDocument>({
    collection: 'categories',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ order: 'asc' }],
    logPrefix: '[useCategories]',
    enabled,
  });

  const addCategory = useCallback(
    async (
      cat: Omit<
        CategoryDocument,
        'id' | 'userId' | 'isDeleted' | 'updatedAt'
      >
    ) => {
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
        updatedAt: new Date().toISOString(),
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
        let changed = false;
        for (const key of Object.keys(updates) as (keyof CategoryDocument)[]) {
          // `updatedAt` is hook-managed; a caller passing it is not a
          // meaningful change signal.
          if (key === 'updatedAt') continue;
          if (doc[key] !== updates[key]) {
            changed = true;
            break;
          }
        }
        if (!changed) return;
        await doc.incrementalPatch({
          ...updates,
          updatedAt: new Date().toISOString(),
        });
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
    (newOrder: CategoryDocument[]) => {
      const order = [...newOrder];
      const applyOrder = async () => {
        const db = getDatabase();
        for (let i = 0; i < order.length; i++) {
          const id = order[i].id;
          try {
            const doc = await db.categories.findOne(id).exec();
            if (!doc) continue;
            if (doc.order === i) continue;
            await doc.incrementalPatch({
              order: i,
              updatedAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error(
              `[useCategories] reorder failed for ${id}:`,
              err
            );
          }
        }
      };

      // Framer Motion can report several orders during one drag. Serialize
      // them so a later (and usually final) order is never silently dropped.
      const queued = reorderQueue.current.then(applyOrder, applyOrder);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    []
  );

  return {
    categories,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}
