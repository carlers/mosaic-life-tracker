import { useCallback, useRef } from 'react';
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
  const { user } = useAuth();
  const reorderQueue = useRef(Promise.resolve());

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
    ¶»§q«^