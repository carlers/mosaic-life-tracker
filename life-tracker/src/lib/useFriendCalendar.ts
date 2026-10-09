import { useState, useEffect, useCallback, useRef } from 'react';
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
  ownerUserId: string,
  friendUserId: string,
  force: boolean
): Promise<FetchOutcome> {
  try {
    const bundle = await fetchFriendCalendar(ownerUserId, friendUserId, {
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
  friendUserId: string | null,
  forceRefreshOnMount = false
): UseFriendCalendarReturn {
  const { user } = useAuth();
  const currentUserId = user?.$id;
  const viewKey =
    currentUserId && friendUserId
      ? JSON.stringify([currentUserId, friendUserId])
      : null;
  const requestIdRef = useRef(0);
  const [loadedViewKey, setLoadedViewKey] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(viewKey));
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<
    'forbidden' | 'offline' | 'server' | null
  >(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Keep the result associated with the viewing account and friend. A retained
  // route must not render old-owner data even for one render after a switch.
  const applyOutcome = useCallback((outcome: FetchOutcome, key: string) => {
    if (outcome.ok) {
      setTasks(outcome.bundle.tasks);
      setCategories(outcome.bundle.categories);
      setLastFetchedAt(outcome.bundle.fetchedAt);
      setError(null);
      setErrorKind(null);
    } else {
      // In particular, a newly signed-in viewer denied access must not
      // inherit the prior viewer's tasks from the retained hook instance.
      setTasks([]);
      setCategories([]);
      setLastFetchedAt(null);
      setError(outcome.message);
      setErrorKind(outcome.kind);
    }
    setLoadedViewKey(key);
    setIsLoading(false);
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!currentUserId || !friendUserId || !viewKey) return;
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      setErrorKind(null);
      const outcome = await runFetch(currentUserId, friendUserId, force);
      if (requestIdRef.current !== requestId) return;
      applyOutcome(outcome, viewKey);
    },
    [applyOutcome, currentUserId, friendUserId, viewKey]
  );

  useEffect(() => {
    if (!currentUserId || !friendUserId || !viewKey) return;
    let active = true;
    const requestId = ++requestIdRef.current;
    void runFetch(currentUserId, friendUserId, forceRefreshOnMount).then((outcome) => {
      if (!active || requestIdRef.current !== requestId) return;
      applyOutcome(outcome, viewKey);
    });
    return () => {
      active = false;
      // Also invalidates an imperative refetch started by this owner/view.
      requestIdRef.current += 1;
    };
  }, [applyOutcome, currentUserId, friendUserId, forceRefreshOnMount, viewKey]);

  const reactToTask = useCallback(
    async (taskId: string, emoji: string): Promise<'add' | 'remove'> => {
      const uid = currentUserId;
      if (!uid || !friendUserId || loadedViewKey !== viewKey) {
        throw new Error('Cannot react: calendar is not loaded for this account');
      }

      const mutationRequestId = requestIdRef.current;
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
        if (requestIdRef.current === mutationRequestId) {
          void patchCachedCalendarTask(uid, friendUserId, taskId, {
            reactions: serverReactions || nextStr,
          });
        }
        return op;
      } catch (err) {
        if (requestIdRef.current === mutationRequestId) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, reactions: original } : t
            )
          );
        }
        console.error('[useFriendCalendar] reactToTask failed:', err);
        throw err;
      }
    },
    [currentUserId, friendUserId, loadedViewKey, tasks, viewKey]
  );

  const isCurrentView = viewKey !== null && loadedViewKey === viewKey;
  return {
    tasks: isCurrentView ? tasks : [],
    categories: isCurrentView ? categories : [],
    isLoading: Boolean(viewKey) && (isLoading || !isCurrentView),
    error: isCurrentView ? error : null,
    errorKind: isCurrentView ? errorKind : null,
    refetch: load,
    lastFetchedAt: isCurrentView ? lastFetchedAt : null,
    reactToTask,
  };
}
