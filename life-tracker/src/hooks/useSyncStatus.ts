import { useSyncExternalStore } from 'react';
import {
  getSyncStatus,
  subscribeToSyncStatus,
} from '../lib/syncStatus';

export function useSyncStatus() {
  return useSyncExternalStore(
    subscribeToSyncStatus,
    getSyncStatus,
    getSyncStatus
  );
}
