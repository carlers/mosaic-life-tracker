import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { isDiscoveryNotEnabledError, listFriendConnections, type FriendConnection } from '../lib/friendDiscovery';

type ConnectionState = {
  scope: string;
  items: FriendConnection[];
  nextCursor: string;
  loading: boolean;
  error: string;
  errorKind: 'disabled' | 'retryable' | '';
};
export function useFriendConnections(viaFriendId: string | null, enabled: boolean) {
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const uid = user?.$id || '';
  const scope = uid && viaFriendId && enabled ? uid + ':' + viaFriendId : '';
  const [state, setState] = useState<ConnectionState>({
    scope: '', items: [], nextCursor: '', loading: false, error: '', errorKind: '',
  });
  const generation = useRef(0);
  const load = useCallback(async (cursor = '') => {
    if (!scope || !viaFriendId) return;
    const token = ++generation.current;
    if (connectivity.status !== 'online') {
      setState({ scope, items: [], nextCursor: '', loading: false, error: 'Connect to browse friends.', errorKind: 'retryable' });
      return;
    }
    setState(prev => ({
      scope, items: cursor && prev.scope === scope ? prev.items : [],
      nextCursor: cursor, loading: true, error: '', errorKind: '',
    }));
    try {
      const page = await listFriendConnections(viaFriendId, cursor);
      if (generation.current !== token) return;
      setState(prev => ({
        scope,
        items: [...(cursor && prev.scope === scope ? prev.items : []),
          ...page.items.filter(item => !cursor || !prev.items.some(p => p.profile.user_id === item.profile.user_id))],
        nextCursor: page.nextCursor,
        loading: false, error: '', errorKind: '',
      }));
    } catch (cause) {
      if (generation.current !== token) return;
      const disabled = isDiscoveryNotEnabledError(cause);
      // On permission loss, revocation or server disablement, never keep
      // previously returned pages visible after any failed refresh/page load.
      setState({
        scope, items: [], nextCursor: '', loading: false,
        error: disabled ? "Friends discovery isn't enabled yet." : 'Friends list unavailable. Try again.',
        errorKind: disabled ? 'disabled' : 'retryable',
      });
    }
  }, [scope, viaFriendId, connectivity.status]);
  useEffect(() => {
    const revision = generation;
    if (!scope) {
      revision.current++;
      // Closing the sheet/signing out clears cached candidates, so opening
      // the same friend again cannot briefly reveal prior discovery results.
      queueMicrotask(() => {
        setState({ scope: '', items: [], nextCursor: '', loading: false, error: '', errorKind: '' });
      });
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
    errorKind: visible ? state.errorKind : '',
    loadMore: () => { if (visible && state.nextCursor && !state.loading) void load(state.nextCursor); },
    retry: () => void load(),
  };
}
