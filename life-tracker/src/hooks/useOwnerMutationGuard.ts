import { useCallback, useLayoutEffect, useRef } from 'react';
import { useAuth } from './useAuth';

/** Recheck after every asynchronous read and before dispatching an owner write. */
export function useOwnerMutationGuard() {
  const { user, isLocalOwnerCurrent } = useAuth();
  const current = useRef(user?.$id);
  useLayoutEffect(() => {
    current.current = user?.$id;
    return () => { current.current = undefined; };
  }, [user?.$id]);
  return useCallback((owner: string | undefined) => {
    if (!owner || current.current !== owner ||
        (isLocalOwnerCurrent && !isLocalOwnerCurrent(owner)))
      throw new Error('Account changed during personal data mutation');
  }, [isLocalOwnerCurrent]);
}
