import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { TaskDocument } from '../db/schema';
import {
  buildTaskOrderAssignments,
  type TaskOrderGroup,
} from '../lib/taskOrder';

export function useTasks(enabled = true) {
  const { user } = useAuth();
  const reorderQueue = useRef(Promise.resolve());

  const { data: tasks, isLoading } = useRxCollection<TaskDocument>({
    collection: 'tasks',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'asc' }, { createdAt: 'desc' }],
    logPrefix: '[useTasks]',
    enabled,
  });

  const addTask = useCallback(
    async (
      task: Omit<
        TaskDocument,
        'id' | 'userId' | 'order' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    ) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useTasks] Cannot add task: User not authenticated');
        return;
      }
      const db = getDatabase();
      const now = new Date().toISOString();
      const siblingDocs = await db.tasks.find().exec();
      const order =
        siblingDocs
          .filter(
            (candidate) =>
              !candidate.isDeleted &&
              candidate.userId === uid &&
              candidate.date === task.date &&
              candidate.categoryId === task.categoryId
          )
          .reduce((maximum, candidate) => Math.max(maximum, candidate.order), -1) + 1;
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
    },
    [user?.$id]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<TaskDocument>) => {
      const db = getDatabase();
      const doc = await db.tasks.findOne(id).exec();
      if (doc) {
        await doc.patch({
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    []
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

        const allTasks = await db.tasks.find().exec();
        const assignments = buildTaskOrderAssignments(
          allTasks,
          uid,
          date,
          snapshot
        );
        const docsById = new Map(
          allTasks.map((task) => [task.id, task])
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
    [user?.$id]
  );

  return {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    reorderTasks,
  };
}
