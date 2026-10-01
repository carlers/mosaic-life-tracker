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

  const reorderTasks = useCallback((orderedTasks: readonly TaskDocument[]) => {
    const snapshot = orderedTasks.map((task) => ({ ...task }));
    const applyOrder = async () => {
      if (snapshot.length < 2) return;
      const [first] = snapshot;
      const sameGroup = snapshot.every(
        (task) =>
          task.userId === first.userId &&
          task.date === first.date &&
          task.categoryId === first.categoryId
      );
      if (!sameGroup) {
        throw new Error('[useTasks] reorderTasks only accepts one date/category group');
      }

      const db = getDatabase();
      const docs = await Promise.all(
        snapshot.map((task) => db.tasks.findOne(task.id).exec())
      );
      const stillSameGroup = docs.every(
        (doc) =>
          doc &&
          !doc.isDeleted &&
          doc.userId === first.userId &&
          doc.date === first.date &&
          doc.categoryId === first.categoryId
      );
      if (!stillSameGroup) {
        throw new Error('[useTasks] Task group changed while reordering');
      }

      const updatedAt = new Date().toISOString();
      await Promise.all(
        docs.map((doc, index) => {
          if (!doc || doc.order === index) return Promise.resolve();
          return doc.incrementalPatch({ order: index, updatedAt });
        })
      );
    };

    const queued = reorderQueue.current.then(applyOrder, applyOrder);
    reorderQueue.current = queued.catch(() => undefined);
    return queued;
  }, []);

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
