import { useEffect, useState } from 'react';
import {
  getOfflineReadiness,
  subscribeToOfflineReadiness,
  type OfflineReadiness,
} from '../lib/offlineReadiness';

export function useOfflineReadiness(
  userId?: string | null
): OfflineReadiness {
  const [state, setState] = useState(() => getOfflineReadiness(userId));

  useEffect(() => {
    const refresh = () => setState(getOfflineReadiness(userId));
    refresh();
    return subscribeToOfflineReadiness(refresh);
  }, [userId]);

  return state;
}
