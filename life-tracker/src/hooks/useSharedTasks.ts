import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import {
  changeSharedTaskMembership, enqueueSharedCompletion, flushSharedCompletions,
  enqueueSharedMembership, flushSharedMemberships, pendingSharedMembership,
  listSharedTasks, pendingSharedCompletion, readSharedCompletionFailures,
  acknowledgeSharedCompletionFailures, subscribeSharedTaskQueue,
  subscribeSharedTaskSettlements,
  type SharedCommandResult, type SharedTaskItem,
} from '../lib/taskShareQueue';

export type SharedTaskScope = 'received' | 'owned';
const CACHE_PREFIX = 'mosaic_shared_tasks_cache_v1:';
const CACHE_MAX = 1000;
const inFlight = new Map<string, Promise<SharedTaskItem[]>>();
function listDeduped(userId: string, scope: SharedTaskScope): Promise<SharedTaskItem[]> {
  const key = cacheKey(userId, scope);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = listSharedTasks(scope).finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}


function cacheKey(userId: string, scope: SharedTaskScope): string {
  return CACHE_PREFIX + encodeURIComponent(userId) + ':' + scope;
}

// No full TaskDocument (which includes private memo/image/category) is ever cached.
function safeEntry(raw: unknown): raw is SharedTaskItem {
  if (!raw || typeof raw !== 'object') return false;
  const entry = raw as Partial<SharedTaskItem>;
  return typeof entry.id === 'string' && typeof entry.taskId === 'string' &&
    typeof entry.ownerId === 'string' && typeof entry.title === 'string' &&
    typeof entry.date === 'string' && typeof entry.completed === 'boolean' &&
    (entry.status === 'pending' || entry.status === 'accepted') &&
    typeof entry.grantEpoch === 'string' &&
    typeof entry.membershipRevision === 'string' &&
    typeof entry.completionRevision === 'string';
}

function minimalEntry(item: SharedTaskItem): SharedTaskItem {
  return {
    id: item.id, taskId: item.taskId, ownerId: item.ownerId,
    ...(typeof item.inviteeId === 'string' ? { inviteeId: item.inviteeId } : {}),
    status: item.status, grantEpoch: item.grantEpoch,
    membershipRevision: item.membershipRevision,
    title: item.title, date: item.date, completed: item.completed,
    completionRevision: item.completionRevision,
  };
}

export function readSharedTaskCache(userId: string, scope: SharedTaskScope): SharedTaskItem[] {
  try {
    const raw = localStorage.getItem(cacheKey(userId, scope));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) && data.length <= CACHE_MAX && data.every(safeEntry)
      ? data.map(minimalEntry) : [];
  } catch {
    return [];
  }
}

export function writeSharedTaskCache(
  userId: string, scope: SharedTaskScope, items: SharedTaskItem[]
): void {
  try {
    localStorage.setItem(cacheKey(userId, scope), JSON.stringify(items.slice(0, CACHE_MAX).map(minimalEntry)));
  } catch {
    // Live data remains available if local persistence is unavailable.
  }
}

export function clearSharedTaskCache(userId: string): void {
  try {
    localStorage.removeItem(cacheKey(userId, 'owned'));
    localStorage.removeItem(cacheKey(userId, 'received'));
  } catch {
    // Best effort; server access is always checked on every online read.
  }
}

export function useSharedTasks(scope: SharedTaskScope, enabled = true) {
  const { user } = useAuth();
  const userId = user?.$id ?? null;
  const connectivity = useConnectivity();
  const online = connectivity.status === 'online';
  const key = userId ? cacheKey(userId, scope) : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [attemptedKey, setAttemptedKey] = useState<string | null>(null);
  const [state, setState] = useState<SharedTaskItem[]>([]);
  const [error, setError] = useState('');
  const [lastMutation, setLastMutation] = useState<SharedCommandResult | null>(null);
  const [queueRevision, setQueueRevision] = useState(0);

  useEffect(() => subscribeSharedTaskQueue(
    () => setQueueRevision(n => n + 1)
  ), []);

  const reload = useCallback(async () => {
    if (!userId) return;
    const list = await listDeduped(userId, scope);
    writeSharedTaskCache(userId, scope, list);
    setState(list);
    setLoadedKey(cacheKey(userId, scope));
    setError('');
  }, [scope, userId]);

  useEffect(() => {
    if (!userId || !key || !enabled) return;
    let active = true;
    if (!online) return () => { active = false; };
    void listDeduped(userId, scope).then(items => {
      if (!active) return;
      writeSharedTaskCache(userId, scope, items);
      setState(items);
      setLoadedKey(key);
      setError('');
    }).catch(cause => {
      if (!active) return;
      // Keep reference-only cached data visible until the next authorized online read.
      setError(cause instanceof Error ? cause.message : 'Shared tasks unavailable');
      setAttemptedKey(key);
    });
    return () => { active = false; };
  }, [userId, key, scope, online, enabled]);

  // Peer actions change membership outside this tab; revalidate on return.
  useEffect(() => {
    if (!userId || !online || !enabled) return;
    let lastCheck = 0;
    const recheck = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastCheck < 15_000) return;
      lastCheck = Date.now();
      void reload().catch(() => {});
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [enabled, online, reload, userId]);

  useEffect(() => subscribeSharedTaskSettlements(result => {
    if (!userId || result.userId !== userId) return;
    if (result.status === 'rejected') {
      setError(result.reason || 'Shared completion failed.');
    } else if (result.status === 'confirmed') {
      void reload().catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Could not refresh shared task.');
      });
    }
  }), [reload, userId]);

  const updateCompletion = useCallback(async (item: SharedTaskItem, desired: boolean) => {
    if (!userId || !key || item.status !== 'accepted') {
      throw new Error('Shared-task membership unavailable');
    }
    enqueueSharedCompletion(userId, item, desired);
    setQueueRevision(n => n + 1);
    if (!online) {
      setLastMutation(null);
      return { status: 'pending' } as const;
    }
    const results = await flushSharedCompletions(userId);
    const latest = results.at(-1);
    if (latest) {
      setLastMutation(latest);
      if (latest.status === 'rejected') setError(latest.reason || 'Shared completion failed');
      // The settlement subscription refreshes both foreground and background replay.
    }
    return latest ?? { status: 'pending' } as const;
  }, [key, userId, online, reload]);

  const updateMembership = useCallback(async (
    item: SharedTaskItem, operation: 'accept' | 'decline' | 'leave' | 'revoke'
  ): Promise<SharedCommandResult | { status: 'pending' }> => {
    if (!userId) throw new Error('Not authenticated');
    if (operation === 'revoke') {
      if (!online) throw new Error('Connect to remove a collaborator');
      await changeSharedTaskMembership({
        taskId: item.taskId, ownerId: item.ownerId,
        friendUserId: item.inviteeId, grantEpoch: item.grantEpoch, operation,
      });
      await reload();
      return { status: 'confirmed', operationId: '' };
    }
    const command = enqueueSharedMembership(userId, item, operation);
    setQueueRevision(n => n + 1);
    if (!online) return { status: 'pending' };
    const results = await flushSharedMemberships(userId);
    const outcome = results.find(result => result.operationId === command.operationId) ||
      { status: 'pending' } as const;
    if (outcome.status === 'confirmed') await reload();
    return outcome;
  }, [online, reload, userId]);

  const invite = useCallback(async (taskId: string, friendUserId: string) => {
    await changeSharedTaskMembership({ operation: 'invite', taskId, friendUserId });
    await reload();
  }, [reload]);

  // The account-scoped key prevents a retained view showing a prior user's data.
  const cachedItems = useMemo(() => userId ? readSharedTaskCache(userId, scope) : [],
    [userId, scope]);
  const items = useMemo(() => loadedKey === key ? state : cachedItems,
    [loadedKey, key, state, cachedItems]);
  const activeItems = useMemo(() => items.filter(item => item.status === 'accepted'), [items]);
  const failure = useMemo(() => {
    void queueRevision;
    return userId ? readSharedCompletionFailures(userId).at(-1)?.reason ?? '' : '';
  }, [userId, queueRevision]);
  const clearFailure = useCallback(() => {
    if (userId) acknowledgeSharedCompletionFailures(userId);
    setError('');
  }, [userId]);
  const pendingFor = useCallback((taskId: string) => {
    void queueRevision;
    return userId ? pendingSharedCompletion(userId, taskId) : undefined;
  }, [queueRevision, userId]);
  const pendingMembershipFor = useCallback((taskId: string) => {
    void queueRevision;
    return userId ? pendingSharedMembership(userId, taskId) : undefined;
  }, [queueRevision, userId]);

  return {
    items, activeItems, isLoading: Boolean(online && enabled && key && loadedKey !== key && attemptedKey !== key), error: error || failure, clearFailure, online, pendingFor,
    lastMutation, invite, updateCompletion, updateMembership, pendingMembershipFor, reload,
  };
}
