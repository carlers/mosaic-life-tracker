import { useSyncExternalStore } from 'react';
import {
  applyPwaUpdate,
  dismissPwaInstall,
  dismissPwaUpdate,
  deferPwaUpdate,
  openPwaUpdatePrompt,
  getPwaLifecycleSnapshot,
  checkForPwaUpdate,
  requestPwaInstall,
  subscribeToPwaLifecycle,
} from '../lib/pwaLifecycle';

export function usePwaLifecycle() {
  const snapshot = useSyncExternalStore(
    subscribeToPwaLifecycle,
    getPwaLifecycleSnapshot,
    getPwaLifecycleSnapshot
  );

  return {
    ...snapshot,
    applyUpdate: applyPwaUpdate,
    checkForUpdate: checkForPwaUpdate,
    dismissInstall: dismissPwaInstall,
    dismissUpdate: dismissPwaUpdate,
    deferUpdate: deferPwaUpdate,
    openUpdatePrompt: openPwaUpdatePrompt,
    requestInstall: requestPwaInstall,
  };
}
