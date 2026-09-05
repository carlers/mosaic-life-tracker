import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import type { TaskDocument } from '../db/schema';
import { useAuth } from './useAuth';

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to all non-deleted tasks for the current user
  useEffect(() => {
    let subscription: any;

    async function init() {
      try {
        const db = getDatabase();
        const query = db.tasks.find({
          selector: {
            userId: user?.$id,
            isDeleted: false,
          },
          sort: [{ date: 'asc' }, { createdAt: 'desc' }],
        });

        subscription = query.$.subscribe((docs) => {
          setTasks(docs);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('[useTasks] Error loading tasks:', error);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const addTask = useCallback(async (task: Omit<TaskDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => {
    const db = getDatabase();
    const now = new Date().toISOString();

    const newTask: TaskDocument = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user?.$id || 'guest',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    await db.tasks.insert(newTask);
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<TaskDocument>) => {
    const db = getDatabase();
    const doc = await db.tasks.findOne(id).exec();
    if (doc) {
      await doc.patch({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    // Soft delete: never hard delete
    await updateTask(id, { isDeleted: true });
  }, [updateTask]);

  const toggleTaskCompletion = useCallback(async (id: string, completed: boolean) => {
    const updates: Partial<TaskDocument> = {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
    await updateTask(id, updates);
  }, [updateTask]);

  return { tasks, isLoading, addTask, updateTask, deleteTask, toggleTaskCompletion };
}