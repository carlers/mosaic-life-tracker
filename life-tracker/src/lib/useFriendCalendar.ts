import { useState, useEffect, useCallback } from 'react';
import {
  fetchFriendCalendar,
  FriendAccessError,
} from '../lib/friendData';
import type { TaskDocument, CategoryDocument } from '../db/schema';

export interface UseFriendCalendarReturn {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  isLoading: boolean;
  error: string | null;
  errorKind: 'forbidden' | 'offline' | 'server' | null;
  refetch: (force?: boolean) => Promise<void>;
  lastFetchedAt: string | null;
}

export function useFriendCalendar(
  friendUserId: string | null
): UseFriendCalendarReturn {
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [categories, setCategories] = useState<CategoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<
    'forbidden' | 'offline' | 'server' | null
  >(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  // Render-body reset when the target friend changes.
  // Replaces the previous sync setState-in-effect guard.
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

  return {
    tasks,
    categories,
    isLoading,
    error,
    errorKind,
    refetch: load,
    lastFetchedAt,
  };
}