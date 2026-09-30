import { useCallback, useRef } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { TaskDocument } from '../db/schema';

export function useTasks(enabled = true) {
  const { user } = useAuth();
  const reorderQueue = useRef(Promise.resolve());

  const { data: tasks, isLoading } = useRxCollection<TaskDocument>({
    collection: 'tasks',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    sort: [{ date: 'asc' }, { categoryId: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
      const siblings = tasks.filter(
        (candidate) => candidate.date === task.date && candidate.categoryId === task.categoryId
      );
      const newTask: TaskDocument = {
        ...task,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: uid,
        order: siblings.reduce((maximum, candidate) => Math.max(maximum, candidate.order), -1) + 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };
      await db.tasks.insert(newTask);
    },
    [tasks, user?.$id]
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

  const reorderTask = useCallback(
    (draggedTask: TaskDocument, targetCategoryId: string, ordering: TaskDocument[]) => {
      const snapshot = ordering.map((task) => ({ ...task }));
      const apply = async () => {
        const db = getDatabase();
        const updatedAt = new Date().toISOString();
        const normalized = new Map<string, number>();
        for (const task of snapshot) {
          const categoryId = task.id === draggedTask.id ? targetCategoryId : task.categoryId;
          const nextOrder = normalized.get(categoryId) ?? 0;
          normalized.set(categoryId, nextOrder + 1);
          const doc = await db.tasks.findOne(task.id).exec();
          if (!doc || (doc.categoryId === categoryId && doc.order === nextOrder)) continue;
          await doc.incrementalPatch({ categoryId, order: nextOrder, updatedAt });
        }
      };
      const result = reorderQueue.current.then(apply);
      reorderQueue.current = result.catch(() => undefined);
      return result;
    },
    []
  );

  return {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    reorderTask,
  };
}
