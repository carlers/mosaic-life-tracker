import { useSyncExternalStore } from 'react';
import { getSyncConflicts, resolveSyncConflict, subscribeSyncConflicts,
  type SyncConflict } from '../lib/syncConflictReview';

export function useSyncConflicts(ownerId: string | undefined) {
  const conflicts = useSyncExternalStore(subscribeSyncConflicts,
    () => getSyncConflicts(ownerId), () => getSyncConflicts(undefined));
  return {
    conflicts,
    async resolve(conflict: SyncConflict, action: 'refresh' | 'keepLocal') {
      if (!ownerId) throw new Error('Sign in to review your changes');
      await resolveSyncConflict(ownerId, conflict, action);
    },
  };
}
