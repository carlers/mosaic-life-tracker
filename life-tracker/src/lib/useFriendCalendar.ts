import { useState, useEffect, useCallback } from 'react';
import {
  fetchFriendCalendar,
  FriendAccessError,
} from '../lib/friendData';
import type { FriendCalendarBundle } from '../lib/friendCache';
import { reactToTaskOnRemote } from '../lib/messageDelivery';
import { patchCachedCalendarTask } from '../lib/friendCache';
import {
  parseReactions,
  stringifyReactions,
  applyReactionDelta,
  hasUserReacted,
} from '../lib/reactionUtils';
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

/**
 * HB-4: the fetch + error-classify logic was duplicated between the
 * mount effect and `load`. Both now funnel through `runFetch`, which
 * returns a discriminated result instead of setState-ing directly.
 */
type FetchOutcome =
  | { ok: true; bundle: FriendCalendarBundle }
  | { ok: false; message: string; kind: 'forbidden' | 'offline' | 'server' };

async function runFetch(
  friendUserId: string,
  force: boolean
): Promise<FetchOutcome> {
  try {
    const bundle = await fetchFriendCalendar(friendUserId, {
      forceRefresh: force,
    });
    return { ok: true, bundle };
  } catch (err) {
    if (err instanceof FriendAccessError) {
      return { ok: false, message: err.message, kind: err.kind };
    }
    console.error('[useFriendCalendar] unexpected error:', err);
    return { ok: false, message: 'Something went wrong.', kind: 'server' };
  }
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
      const outcome = await runFetch(friendUserId, force);
      if (outcome.ok) {
        setTasks(outcome.bundle.tasks);
        setCategories(outcome.bundle.categories);
        setLastFetchedAt(outcome.bundle.fetchedAt);
      } else {
        setError(outcome.message);
        setErrorKind(outcome.kind);
      }
      setIsLoading(false);
    },
    [friendUserId]
  );

  useEffect(() => {
    if (!friendUserId) return;
    let effectIsActive = true;
    (async () => {
      const outcome = await runFetch(friendUserId, false);
      if (!effectIsActive) return;
      if (outcome.ok) {
        setTasks(outcome.bundle.tasks);
        setCategories(outcome.bundle.categories);
        setLastFetchedAt(outcome.bundle.fetchedAt);
        setError(null);
        setErrorKind(null);
      } else {
        setError(outcome.message);
        setErrorKind(outcome.kind);
      }
      setIsLoading(false);
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
        patchCachedCalendarTask(friendUserId, taskId, {
          reactions: serverReactions || nextStr,
        });
        return op;
      } catch (err) {
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
