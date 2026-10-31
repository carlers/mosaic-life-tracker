import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument } from '../db/schema';

export function useCategories(enabled = true) {
  const { user } = useAuth();
  const userId = user?.$id;
  const reorderQueue = useRef(Promise.resolve());

  const { data: categories, isLoading } = useRxCollection<CategoryDocument>({
    collection: 'categories',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ order: 'asc' }],
    logPrefix: '[useCategories]',
    enabled,
    startupMark: 'home:categories-ready',
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
        throw new Error('Cannot add category: not authenticated');
      }
      const db = getDatabase();
      const newCat: CategoryDocument = {
        ...cat,
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        isDeleted: false,
        retiredOn: '',
        updatedAt: new Date().toISOString(),
      };
      try {
        await db.categories.insert(newCat);
      } catch (error) {
        console.error('[useCategories] Error inserting category:', error);
        throw error;
      }
    },
    [user?.$id]
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<CategoryDocument>) => {
      // #1186: never tombstone a category from an offline-capable client.
      // Another device may hold unsynced tasks even when this device sees none.
      if (updates.isDeleted === true) {
        throw new Error('Category deletion is temporarily unavailable to protect tasks');
      }
      if (updates.retiredOn !== undefined &&
          updates.retiredOn !== '' &&
          !(await import('../lib/categoryLifecycle')).validLocalDateKey(updates.retiredOn)) {
        throw new Error('Choose a valid last-active date');
      }
      const db = getDatabase();
      try {
        const doc = await db.categories.findOne(id).exec();
        if (!doc || doc.isDeleted || !userId || doc.userId !== userId) {
          throw new Error('Category no longer belongs to this account');
        }
        if ((updates.userId !== undefined && updates.userId !== userId) ||
            (updates.id !== undefined && updates.id !== id)) {
          throw new Error('Cannot reassign category ownership');
        }
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
        throw err;
      }
    },
    [userId]
  );

  const retireCategory = useCallback(async (id: string, lastActiveDate: string) => {
    await updateCategory(id, { retiredOn: lastActiveDate });
  }, [updateCategory]);

  const restoreCategory = useCallback(async (id: string) => {
    await updateCategory(id, { retiredOn: '' });
  }, [updateCategory]);

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!id) throw new Error('Invalid category');
      throw new Error('Category deletion is temporarily unavailable to protect tasks');
    },
    []
  );

  const reorderCategories = useCallback(
    (newOrder: CategoryDocument[]) => {
      const order = [...newOrder];
      const applyOrder = async () => {
        const db = getDatabase();
        let firstError: unknown = null;
        for (let i = 0; i < order.length; i++) {
          const id = order[i].id;
          try {
            const doc = await db.categories.findOne(id).exec();
            if (!doc || doc.isDeleted || doc.userId !== userId) {
              throw new Error('Category no longer belongs to this account');
            }
            if (doc.order === i) continue;
            await doc.incrementalPatch({
              order: i,
              updatedAt: new Date().toISOString(),
            });
          } catch (err) {
            if (firstError === null) firstError = err;
            console.error(
              `[useCategories] reorder failed for ${id}:`,
              err
            );
          }
        }
        if (firstError !== null) throw firstError;
      };

      // Framer Motion can report several orders during one drag. Serialize
      // them so a later (and usually final) order is never silently dropped.
      const queued = reorderQueue.current.then(applyOrder, applyOrder);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    [userId]
  );

  return {
    categories,
    isLoading,
    addCategory,
    updateCategory,
    retireCategory,
    restoreCategory,
    deleteCategory,
    reorderCategories,
  };
}
