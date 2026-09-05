import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import type { TaskDocument } from '../db/schema';
import { useAuth } from './useAuth';

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userId = user?.$id;
    
    if (!userId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    let subscription: any;

    async function init() {
      try {
        const db = getDatabase();
        const query = db.tasks.find({
          selector: {
            userId: userId,
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
  }, [user?.$id]);

  const addTask = useCallback(async (task: Omit<TaskDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => {
    const userId = user?.$id;
    if (!userId) {
      console.error('[useTasks] Cannot add task: User not authenticated');
      return;
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const newTask: TaskDocument = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    await db.tasks.insert(newTask);
  }, [user?.$id]);

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
    await updateTask(id, { isDeleted: true });
  }, [updateTask]);

  // FIX: Conditionally add completedAt to avoid RxDB patching with 'undefined'
  const toggleTaskCompletion = useCallback(async (id: string, completed: boolean) => {
    const updates: Partial<TaskDocument> = {
      completed,
    };
    
    if (completed) {
      updates.completedAt = new Date().toISOString();
    }
    
    await updateTask(id, updates);
  }, [updateTask]);

  return { tasks, isLoading, addTask, updateTask, deleteTask, toggleTaskCompletion };
}