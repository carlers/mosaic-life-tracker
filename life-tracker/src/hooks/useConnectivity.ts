import { useEffect, useSyncExternalStore } from 'react';
import {
  getConnectivitySnapshot,
  initializeConnectivity,
  subscribeToConnectivity,
} from '../lib/connectivity';

export function useConnectivity() {
  useEffect(() => {
    if (typeof window !== 'undefined') initializeConnectivity(window);
  }, []);

  return useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivitySnapshot
  );
}
