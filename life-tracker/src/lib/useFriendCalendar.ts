import { useState, useEffect, useCallback } from 'react';
import {
  fetchFriendCalendar,
  FriendAccessError,
} from '../lib/friendData';
import { reactToTaskOnRemote } from '../lib/messageDelivery';
import { patchCachedCalendarTask } from '../lib/friendCache';
import { parseReactions, stringifyReactions, applyReactionDelta, hasUserReacted } from '../lib/reactionUtils';
import { useAuth } from '../hooks/useAuth';
import type { TaskDocument, CategoryDocument } from '../db/schema';

export interface UseFriendCalendarReturn {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  isLoading: boolean;
  error: string | null;
  errorKind: 'forbidden' | 'offline' | 'server' | null;
  refetch: (force?: boolean) => Promise<void>;
  lastFetchedAt: string | null;
  reactToTask: (taskId: string, emoji: string) => Promise<'add' | 'remove'>;
}

export function useFriendCalendar(
  friendUserId: string | null
): UseFriendCalendarReturn {
  const { user } = useAuth();
  const currentUserId = user?.$id;
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<
    'forbidden' | 'offline' | 'server' | null
  >(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [trackedFriendId, setTrackedFriendId] = useState<string | null>(
    friendUserId
  );

  if (friendUserId !== trackedFriendId) {
    setTrackedFriendId(friendUserId);
    setTasks([]);
    setCategories([]);
    setError(null);
    setErrorKind(null);
    setLastFetchedAt(null);
    setIsLoading(!!friendUserId);
  }

  const load = useCallback(
    async (force = false) => {
      if (!friendUserId) return;
      setIsLoading(true);
      setError(null);
      setErrorKind(null);
      try {
        const bundle = await fetchFriendCalendar(friendUserId, {
          forceRefresh: force,
        });
        setTasks(bundle.tasks);
        setCategories(bundle.categories);
        setLastFetchedAt(bundle.fetchedAt);
      } catch (err) {
        if (err instanceof FriendAccessError) {
          setError(err.message);
          setErrorKind(err.kind);
        } else {
          console.error('[useFriendCalendar] unexpected error:', err);
          setError('Something went wrong.');
          setErrorKind('server');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [friendUserId]
  );

  useEffect(() => {
    if (!friendUserId) return;
    let effectIsActive = true;
    (async () => {
      try {
        const bundle = await fetchFriendCalendar(friendUserId);
        if (!effectIsActive) return;
        setTasks(bundle.tasks);
        setCategories(bundle.categories);
        setLastFetchedAt(bundle.fetchedAt);
        setError(null);
        setErrorKind(null);
      } catch (err) {
        if (!effectIsActive) return;
        if (err instanceof FriendAccessError) {
          setError(err.message);
          setErrorKind(err.kind);
        } else {
          console.error('[useFriendCalendar] unexpected error:', err);
          setError('Something went wrong.');
          setErrorKind('server');
        }
      } finally {
        if (effectIsActive) setIsLoading(false);
      }
    })();
    return () => {
      effectIsActive = false;
    };
  }, [friendUserId]);

  const reactToTask = useCallback(
    async (taskId: string, emoji: string): Promise<'add' | 'remove'> => {
      const uid = currentUserId;
      if (!uid || !friendUserId) {
        throw new Error('Cannot react: not authenticated or no friend');
      }

      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const current = parseReactions(task.reactions);
      const op: 'add' | 'remove' = hasUserReacted(current, emoji, uid)
        ? 'remove'
        : 'add';
      const next = applyReactionDelta(current, emoji, uid, op);
      const nextStr = stringifyReactions(next);
      const original = task.reactions ?? '';

      // Optimistic local update.
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, reactions: nextStr } : t))
      );

      try {
        const serverReactions = await reactToTaskOnRemote(
          taskId,
          friendUserId,
          emoji,
          op
        );
        // Patch the cache with the server-confirmed value (falls back to the
        // optimistic value if the server didn't echo one back).
        patchCachedCalendarTask(friendUserId, taskId, {
          reactions: serverReactions || nextStr,
        });
        return op;
      } catch (err) {
        // Revert.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, reactions: original } : t
          )
        );
        console.error('[useFriendCalendar] reactToTask failed:', err);
        throw err;
      }
    },
    [currentUserId, friendUserId, tasks]
  );

  return {
    tasks,
    categories,
    isLoading,
    error,
    errorKind,
    refetch: load,
    lastFetchedAt,
    reactToTask,
  };
}