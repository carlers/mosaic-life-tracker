import { useEffect, useState } from 'react';
import {
  getSyncStatus,
  subscribeToSyncStatus,
  type SyncStatus,
} from '../lib/syncStatus';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());

  useEffect(() => subscribeToSyncStatus(setStatus), []);

  return status;
}
