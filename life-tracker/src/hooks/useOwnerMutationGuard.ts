import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';

/** Recheck after every asynchronous read and before dispatching an owner write. */
export function useOwnerMutationGuard() {
  const { user, isLocalOwnerCurrent } = useAuth();
  const token = useMemo(() => ({ owner: user?.$id }), [user?.$id]);
  const current = useRef<typeof token | null>(token);
  useLayoutEffect(() => {
    current.current = token;
    return () => { current.current = null; };
  }, [token]);
  return useCallback((owner: string | undefined) => {
    if (!owner || current.current !== token || token.owner !== owner ||
        (isLocalOwnerCurrent && !isLocalOwnerCurrent(owner)))
      throw new Error('Account changed during personal data mutation');
  }, [isLocalOwnerCurrent, token]);
}
