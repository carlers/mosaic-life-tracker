import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { listFriendConnections, type FriendConnection } from '../lib/friendDiscovery';

type ConnectionState = {
  scope: string;
  items: FriendConnection[];
  nextCursor: string;
  loading: boolean;
  error: string;
};
export function useFriendConnections(viaFriendId: string | null, enabled: boolean) {
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const uid = user?.$id || '';
  const scope = uid && viaFriendId && enabled ? uid + ':' + viaFriendId : '';
  const [state, setState] = useState<ConnectionState>({
    scope: '', items: [], nextCursor: '', loading: false, error: '',
  });
  const generation = useRef(0);
  const load = useCallback(async (cursor = '') => {
    if (!scope || !viaFriendId) return;
    const token = ++generation.current;
    if (connectivity.status !== 'online') {
      setState({ scope, items: [], nextCursor: '', loading: false, error: 'Connect to browse friends.' });
      return;
    }
    setState(prev => ({
      scope, items: cursor && prev.scope === scope ? prev.items : [],
      nextCursor: cursor, loading: true, error: '',
    }));
    try {
      const page = await listFriendConnections(viaFriendId, cursor);
      if (generation.current !== token) return;
      setState(prev => ({
        scope,
        items: [...(cursor && prev.scope === scope ? prev.items : []),
          ...page.items.filter(item => !cursor || !prev.items.some(p => p.profile.user_id === item.profile.user_id))],
        nextCursor: page.nextCursor,
        loading: false, error: '',
      }));
    } catch {
      if (generation.current !== token) return;
      setState(prev => ({
        ...prev, scope, loading: false, nextCursor: '',
        error: 'Friends list unavailable. Try again.',
      }));
    }
  }, [scope, viaFriendId, connectivity.status]);
  useEffect(() => {
    const revision = generation;
    if (!scope) {
      revision.current++;
      return;
    }
    let alive = true;
    // Run the initial network synchronization after this render's effect setup.
    queueMicrotask(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
      revision.current++;
    };
  }, [scope, load]);
  const visible = state.scope === scope && !!scope;
  return {
    items: visible ? state.items : [],
    nextCursor: visible ? state.nextCursor : '',
    isLoading: visible && state.loading,
    error: visible ? state.error : '',
    loadMore: () => { if (visible && state.nextCursor && !state.loading) void load(state.nextCursor); },
    retry: () => void load(),
  };
}
