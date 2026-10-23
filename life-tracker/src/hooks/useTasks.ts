import { useCallback, useLayoutEffect, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { TaskDocument } from '../db/schema';

import { hasCachedOwnedSharedTask, markOwnerCompletionPending, restoreOwnerCompletionPending } from '../lib/ownerCompletionPending';
import {
  buildBulkMoveTaskOrderGroups,
  buildTaskOrderAssignments,
  getNewTaskOrder,
  type NewTaskPosition,
  type TaskOrderGroup,
} from '../lib/taskOrder';

export function useTasks(enabled = true) {
  const { user, isLocalOwnerCurrent } = useAuth();
  const reorderQueue = useRef(Promise.resolve());
  const activeOwnerRef = useRef(user?.$id);
  useLayoutEffect(() => {
    activeOwnerRef.current = user?.$id;
    return () => { activeOwnerRef.current = undefined; };
  }, [user?.$id]);
  const assertActiveOwner = useCallback((expectedOwner: string | undefined) => {
    // In-flight reads and queued drag callbacks can outlive their account.
    // Unmount also revokes the local mutation permission.
    if (!expectedOwner || activeOwnerRef.current !== expectedOwner ||
        (isLocalOwnerCurrent && !isLocalOwnerCurrent(expectedOwner)))
      throw new Error('[useTasks] Account changed during task mutation');
  }, [isLocalOwnerCurrent]);

  const { data: tasks, isLoading } = useRxCollection<TaskDocument>({
    collection: 'tasks',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'asc' }, { createdAt: 'desc' }],
    logPrefix: '[useTasks]',
    enabled,
    startupMark: 'home:tasks-ready',
  });

  const addTask = useCallback(
    async (
      task: Omit<
        TaskDocument,
        'id' | 'userId' | 'order' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >,
      position: NewTaskPosition = 'bottom'
    ) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useTasks] Cannot add task: User not authenticated');
        return;
      }
      const db = getDatabase();
      const now = new Date().toISOString();
      const siblingDocs = await db.tasks
        .find({
          selector: {
            userId: uid,
            date: task.date,
            categoryId: task.categoryId,
            isDeleted: false,
          },
        })
        .exec();
      assertActiveOwner(uid);
      const order = getNewTaskOrder(siblingDocs, position);
      const newTask: TaskDocument = {
        ...task,
        order,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      await db.tasks.insert(newTask);
      return newTask.id;
    },
    [user?.$id, assertActiveOwner]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<TaskDocument>) => {
      const db = getDatabase();
      const doc = await db.tasks.findOne(id).exec();
      const uid = user?.$id;
      assertActiveOwner(uid);
      if (doc) {
        // An ID retained by a stale view must never mutate another owner's
        // offline document, even if that document is cached in this RxDB.
        if (doc.userId !== uid)
          throw new Error('[useTasks] Cannot update task for another account');
        if ((updates.userId !== undefined && updates.userId !== uid) ||
            (updates.id !== undefined && updates.id !== id))
          throw new Error('[useTasks] Cannot reassign task identity');
        const now = new Date().toISOString();
        const isSharedCompletion = Boolean(uid && doc.userId === uid &&
          typeof updates.completed === 'boolean' && updates.completed !== doc.completed &&
          hasCachedOwnedSharedTask(uid, id));
        let marked = false;
        let previous: ReturnType<typeof markOwnerCompletionPending>;
        if (isSharedCompletion && uid) {
          try {
            previous = markOwnerCompletionPending(uid, id, updates.completed as boolean, now);
            marked = true;
          } catch {
            // The RxDB task itself still persists the durable offline write.
          }
        }
        try {
          await doc.patch({ ...updates, updatedAt: now });
        } catch (error) {
          if (marked && uid) {
            try { restoreOwnerCompletionPending(uid, id, previous); }
            catch { /* Failed local writes must still surface their original error. */ }
          }
          throw error;
        }
      }
    },
    [user?.$id, assertActiveOwner]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await updateTask(id, { isDeleted: true });
    },
    [updateTask]
  );

  const toggleTaskCompletion = useCallback(
    async (id: string, completed: boolean) => {
      const updates: Partial<TaskDocument> = {
        completed,
        completedAt: completed ? new Date().toISOString() : '',
      };
      await updateTask(id, updates);
    },
    [updateTask]
  );

  const reorderTasks = useCallback(
    (date: string, groups: readonly TaskOrderGroup[]) => {
      const uid = user?.$id;
      const snapshot = groups.map((group) => ({
        categoryId: group.categoryId,
        taskIds: [...group.taskIds],
      }));

      const applyOrder = async () => {
        if (!uid || snapshot.length === 0) return;
        assertActiveOwner(uid);

        const categoryIds = Array.from(
          new Set(snapshot.map((group) => group.categoryId))
        );
        if (categoryIds.length !== snapshot.length || categoryIds.length > 2) {
          throw new Error('[useTasks] Invalid task reorder groups');
        }

        const db = getDatabase();
        const categoryDocs = await Promise.all(
          categoryIds.map((categoryId) =>
            db.categories.findOne(categoryId).exec()
          )
        );
        assertActiveOwner(uid);
        if (
          categoryDocs.some(
            (category) =>
              !category ||
              category.isDeleted ||
              category.userId !== uid
          )
        ) {
          throw new Error('[useTasks] Category changed while reordering');
        }

        const affectedDayTasks = await db.tasks
          .find({
            selector: {
              userId: uid,
              date,
              isDeleted: false,
            },
          })
          .exec();
        assertActiveOwner(uid);
        const assignments = buildTaskOrderAssignments(
          affectedDayTasks,
          uid,
          date,
          snapshot
        );
        const docsById = new Map(
          affectedDayTasks.map((task) => [task.id, task])
        );
        const updatedAt = new Date().toISOString();

        await Promise.all(
          assignments.map(({ id, categoryId, order }) => {
            const doc = docsById.get(id);
            if (!doc) {
              throw new Error('[useTasks] Task disappeared while reordering');
            }
            if (doc.categoryId === categoryId && doc.order === order) {
              return Promise.resolve();
            }
            return doc.incrementalPatch({
              categoryId,
              order,
              updatedAt,
            });
          })
        );
      };

      const queued = reorderQueue.current.then(applyOrder, applyOrder);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    [user?.$id, assertActiveOwner]
  );

  const moveTaskAcrossDays = useCallback(
    (taskId: string, expectedDate: string, date: string, categoryId: string, proposedIndex: number) => {
      const uid = user?.$id;
      const applyMove = async () => {
        assertActiveOwner(uid);
        if (!uid || !date || !categoryId) throw new Error('Invalid task destination');
        const db = getDatabase();
        const task = await db.tasks.findOne(taskId).exec();
        const category = await db.categories.findOne(categoryId).exec();
        assertActiveOwner(uid);
        if (!task || task.isDeleted || task.userId !== uid || task.date !== expectedDate ||
            !category || category.isDeleted || category.userId !== uid) {
          throw new Error('Task or category changed while dragging');
        }
        const siblings = await db.tasks.find({ selector: {
          userId: uid, date, categoryId, isDeleted: false,
        } }).exec();
        assertActiveOwner(uid);
        const sorted = siblings.filter(row => row.id !== taskId).sort((a, b) =>
          (a.order ?? 0) - (b.order ?? 0) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
        const index = Number.isFinite(proposedIndex)
          ? Math.max(0, Math.min(Math.trunc(proposedIndex), sorted.length)) : sorted.length;
        const ordered = [...sorted];
        ordered.splice(index, 0, task);
        if (ordered.length > 999999) throw new Error('Destination category is full');
        const changes = ordered.map((row, order) => ({ row, order }))
          .filter(({ row, order }) => row.order !== order && row.id !== taskId);
        const modified: { row: typeof task; order: number }[] = [];
        const now = new Date().toISOString();
        try {
          // Keep the source on its old day until the destination ordering is
          // valid. Restore sibling orders if the final source patch fails.
          for (const { row, order } of changes) {
            assertActiveOwner(uid);
            const oldOrder = row.order;
            await row.incrementalPatch({ order, updatedAt: now });
            modified.push({ row, order: oldOrder });
          }
          assertActiveOwner(uid);
          if (task.date !== date || task.categoryId !== categoryId || task.order !== index) {
            await task.incrementalPatch({ date, categoryId, order: index, updatedAt: now });
          }
        } catch (error) {
          await Promise.allSettled(modified.map(({ row, order }) => row.incrementalPatch({
            order, updatedAt: new Date().toISOString(),
          })));
          throw error;
        }
      };
      const queued = reorderQueue.current.then(applyMove, applyMove);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    [user?.$id, assertActiveOwner]
  );

  const moveTasksToCategory = useCallback(
    (
      date: string,
      taskIds: readonly string[],
      destinationCategoryId: string
    ) => {
      const uid = user?.$id;
      const selectedTaskIds = [...taskIds];

      const applyMove = async () => {
        if (!uid || selectedTaskIds.length === 0) return;
        assertActiveOwner(uid);

        const db = getDatabase();
        const categoryDocs = await db.categories
          .find({
            selector: {
              userId: uid,
              isDeleted: false,
            },
          })
          .exec();
        assertActiveOwner(uid);
        const orderedCategories = categoryDocs
          .slice()
          .sort(
            (a, b) =>
              (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
          );
        if (
          !orderedCategories.some(
            (category) => category.id === destinationCategoryId
          )
        ) {
          throw new Error('[useTasks] Destination category changed while moving');
        }

        const affectedDayTasks = await db.tasks
          .find({
            selector: {
              userId: uid,
              date,
              isDeleted: false,
            },
          })
          .exec();
        assertActiveOwner(uid);
        const groups = buildBulkMoveTaskOrderGroups(
          affectedDayTasks,
          selectedTaskIds,
          destinationCategoryId,
          orderedCategories.map((category) => category.id)
        );
        if (groups.length === 0) return;

        const assignments = buildTaskOrderAssignments(
          affectedDayTasks,
          uid,
          date,
          groups
        );
        const docsById = new Map(
          affectedDayTasks.map((task) => [task.id, task])
        );
        const updatedAt = new Date().toISOString();

        await Promise.all(
          assignments.map(({ id, categoryId, order }) => {
            const doc = docsById.get(id);
            if (!doc) {
              throw new Error('[useTasks] Task disappeared while moving');
            }
            if (doc.categoryId === categoryId && doc.order === order) {
              return Promise.resolve();
            }
            return doc.incrementalPatch({
              categoryId,
              order,
              updatedAt,
            });
          })
        );
      };

      const queued = reorderQueue.current.then(applyMove, applyMove);
      reorderQueue.current = queued.catch(() => undefined);
      return queued;
    },
    [user?.$id, assertActiveOwner]
  );

  return {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    reorderTasks,
    moveTasksToCategory,
    moveTaskAcrossDays,
  };
}
