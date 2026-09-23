import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import type { TaskDocument } from '../db/schema';

export function useTasks(enabled = true) {
  const { user } = useAuth();

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
        'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'
      >
    ) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useTasks] Cannot add task: User not authenticated');
        return;
      }
      const db = getDatabase();
      const now = new Date().toISOString();
      const newTask: TaskDocument = {
        ...task,
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

  return {
    tasks,
    isLoading,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
  };
}
