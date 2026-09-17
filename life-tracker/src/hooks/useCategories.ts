import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;
let reorderInProgress = false;

export function useCategories() {
  const { user } = useAuth();

  const { data: categories, isLoading } = useRxCollection<CategoryDocument>({
    collection: 'categories',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ order: 'asc' }],
    logPrefix: '[useCategories]',
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
    async (newOrder: CategoryDocument[]) => {
      // HB-12: silent guard replaced with a debug log so a debounced
      // reorder that lands while a previous one is still applying is
      // visible in dev instead of being dropped without a trace.
      if (reorderInProgress) {
        if (DEBUG) {
          console.warn(
            '[useCategories] reorder skipped: a previous reorder is still in progress'
          );
        }
        return;
      }
      reorderInProgress = true;
      try {
        const db = getDatabase();
        for (let i = 0; i < newOrder.length; i++) {
          const id = newOrder[i].id;
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
      } finally {
        reorderInProgress = false;
      }
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
