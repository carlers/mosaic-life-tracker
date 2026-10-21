import { useCallback, useLayoutEffect, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { CategoryDocument } from '../db/schema';

export function useCategories(enabled = true) {
  const { user, isLocalOwnerCurrent } = useAuth();
  const reorderQueue = useRef(Promise.resolve());
  const ownerId = user?.$id;
  const activeOwnerRef = useRef(ownerId);
  useLayoutEffect(() => {
    activeOwnerRef.current = ownerId;
    return () => { activeOwnerRef.current = undefined; };
  }, [ownerId]);
  const assertActiveOwner = useCallback((expectedOwner: string | undefined) => {
    if (!expectedOwner || activeOwnerRef.current !== expectedOwner ||
        (isLocalOwnerCurrent && !isLocalOwnerCurrent(expectedOwner)))
      throw new Error('[useCategories] Account changed during category mutation');
  }, [isLocalOwnerCurrent]);

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

  const deleteCategory = useCallback(
    async (id: string) => {
      const uid = ownerId;
      assertActiveOwner(uid);
      if (!uid) throw new Error('[useCategories] Cannot delete without an account');
      const db = getDatabase();
      // Reject a stale/foreign category ID before any sibling task lookup.
      const source = await db.categories.findOne(id).exec();
      assertActiveOwner(uid);
      if (source && source.userId !== uid)
        throw new Error('[useCategories] Cannot delete category for another account');
      if (!source || source.isDeleted)
        throw new Error('[useCategories] Category no longer exists for this account');
      const [categories, assignedTasks] = await Promise.all([
        db.categories.find({ selector: { userId: uid, isDeleted: false } }).exec(),
        db.tasks.find({ selector: { userId: uid, categoryId: id, isDeleted: false } }).exec(),
      ]);
      assertActiveOwner(uid);
      const destination = categories
        .filter(category => category.userId === uid && !category.isDeleted && category.id !== id)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))[0];
      if (assignedTasks.length && !destination)
        throw new Error('Create another category before deleting one that contains tasks');

      // Deleting the category first makes its still-live tasks disappear from
      // Day View while Calendar continues showing their orphaned TaskBlocks.
      // Transfer owner-scoped tasks first, keeping their original IDs, dates,
      // completion state and tombstone history. A failed move leaves the
      // category visible and a retry can finish only the remaining tasks.
      for (const task of assignedTasks) {
        assertActiveOwner(uid);
        const current = await db.tasks.findOne(task.id).exec();
        assertActiveOwner(uid);
        if (!current || current.userId !== uid)
          throw new Error('[useCategories] Task owner changed during category deletion');
        if (current.isDeleted || current.categoryId !== id) continue;
        await current.incrementalPatch({
          categoryId: destination!.id,
          updatedAt: new Date().toISOString(),
        });
      }

      // A task created during the transfer must not be stranded by the
      // category tombstone. Refuse to finish and allow an idempotent retry.
      const remaining = await db.tasks.find({
        selector: { userId: uid, categoryId: id, isDeleted: false },
      }).exec();
      assertActiveOwner(uid);
      if (remaining.length)
        throw new Error('Tasks changed during category deletion. Try again.');
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
    deleteCategory,
    reorderCategories,
  };
}
