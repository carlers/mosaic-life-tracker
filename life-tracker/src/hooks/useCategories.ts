import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useOwnerMutationGuard } from './useOwnerMutationGuard';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument } from '../db/schema';
import { validLocalDateKey } from '../lib/categoryLifecycle';

export function useCategories(enabled = true) {
  const { user } = useAuth();
  const reorderQueue = useRef(Promise.resolve());
  const ownerId = user?.$id;
  const assertActiveOwner = useOwnerMutationGuard();

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
      const uid = ownerId;
      if (!uid) {
        console.error(
          '[useCategories] Cannot add category: User not authenticated'
        );
        throw new Error('Cannot add category: not authenticated');
      }
      assertActiveOwner(uid);
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
        throw error;
      }
    },
    [ownerId, assertActiveOwner]
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<CategoryDocument>) => {
      const db = getDatabase();
      try {
        const doc = await db.categories.findOne(id).exec();
        assertActiveOwner(ownerId);
        if (!doc) throw new Error('Category no longer exists');
        if (!ownerId || doc.userId !== ownerId)
          throw new Error('[useCategories] Cannot update category for another account');
        if (updates.retiredOn !== undefined && updates.retiredOn !== '' &&
            !validLocalDateKey(updates.retiredOn))
          throw new Error('Choose a valid category retirement date');
        if ((updates.userId !== undefined && updates.userId !== ownerId) ||
            (updates.id !== undefined && updates.id !== id))
          throw new Error('[useCategories] Cannot reassign category identity');
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
    [ownerId, assertActiveOwner]
  );

  const retireCategory = useCallback(async (id: string, date: string) => {
    if (!validLocalDateKey(date)) throw new Error('Choose a valid retirement date');
    await updateCategory(id, { retiredOn: date });
  }, [updateCategory]);

  const restoreCategory = useCallback(async (id: string) => {
    await updateCategory(id, { retiredOn: '' });
  }, [updateCategory]);

  /**
   * The destructive alternative to retirement: tombstone the category AND
   * its owner tasks on all dates including undated backlogs. Soft tombstones
   * ensure offline devices can learn of deletion; never silently rehome rows.
   */
  const deleteCategory = useCallback(
    async (id: string) => {
      const uid = ownerId;
      assertActiveOwner(uid);
      if (!uid) throw new Error('[useCategories] Cannot delete without an account');
      const db = getDatabase();
      const source = await db.categories.findOne(id).exec();
      assertActiveOwner(uid);
      if (source && source.userId !== uid)
        throw new Error('[useCategories] Cannot delete category for another account');
      if (!source || source.isDeleted)
        throw new Error('[useCategories] Category no longer exists for this account');
      const assignedTasks = await db.tasks.find({
        selector: { userId: uid, categoryId: id, isDeleted: false },
      }).exec();
      assertActiveOwner(uid);
      for (const task of assignedTasks) {
        assertActiveOwner(uid);
        const current = await db.tasks.findOne(task.id).exec();
        assertActiveOwner(uid);
        if (!current || current.userId !== uid)
          throw new Error('[useCategories] Task owner changed during category deletion');
        if (current.isDeleted || current.categoryId !== id) continue;
        await current.incrementalPatch({
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        });
      }
      // A concurrent task creation must not be orphaned. A failed partial
      // mutation remains retryable and never tombstones the category early.
      const remaining = await db.tasks.find({
        selector: { userId: uid, categoryId: id, isDeleted: false },
      }).exec();
      assertActiveOwner(uid);
      if (remaining.length) throw new Error('Tasks changed during deletion. Try again.');
      await updateCategory(id, { isDeleted: true });
    },
    [ownerId, assertActiveOwner, updateCategory]
  );

  const reorderCategories = useCallback(
    (newOrder: CategoryDocument[]) => {
      const order = [...newOrder];
      const applyOrder = async () => {
        const uid = ownerId;
        if (!uid) throw new Error('[useCategories] Cannot reorder without an account');
        assertActiveOwner(uid);
        const db = getDatabase();
        // Read and owner-check every entry before applying the first update.
        // Stale category reorder arrays may retain another account's IDs.
        const docs = await Promise.all(order.map(async ({ id }) => {
          try { return await db.categories.findOne(id).exec(); }
          catch (err) {
            console.error(`[useCategories] reorder lookup failed for ${id}:`, err);
            return null;
          }
        }));
        assertActiveOwner(uid);
        if (docs.some(doc => doc && doc.userId !== uid))
          throw new Error('[useCategories] Cannot reorder category for another account');
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          if (!doc || doc.order === i) continue;
          assertActiveOwner(uid);
          try {
            await doc.incrementalPatch({ order: i, updatedAt: new Date().toISOString() });
          } catch (err) {
            console.error(`[useCategories] reorder failed for ${order[i].id}:`, err);
          }
        }
      };

      // Framer Motion can report several orders during one drag. Serialize
      // them so a later (and usually final) order is never silently dropped.
      const queued = reorderQueue.current.then(applyOrder, applyOrder);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    [ownerId, assertActiveOwner]
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
