import { useSyncExternalStore } from 'react';
import {
  getConnectivitySnapshot,
  subscribeToConnectivity,
} from '../lib/connectivity';

export function useConnectivity() {
  return useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivitySnapshot
  );
}
