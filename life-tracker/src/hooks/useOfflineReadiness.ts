import { useEffect, useState } from 'react';
import {
  getOfflineReadiness,
  subscribeToOfflineReadiness,
  type OfflineReadiness,
} from '../lib/offlineReadiness';

export function useOfflineReadiness(
  userId?: string | null
): OfflineReadiness {
  const [trackedUserId, setTrackedUserId] = useState(userId);
  const [state, setState] = useState(() => getOfflineReadiness(userId));

  if (trackedUserId !== userId) {
    setTrackedUserId(userId);
    setState(getOfflineReadiness(userId));
  }

  useEffect(
    () =>
      subscribeToOfflineReadiness(() => {
        setState(getOfflineReadiness(userId));
      }),
    [userId]
  );

  return state;
}
