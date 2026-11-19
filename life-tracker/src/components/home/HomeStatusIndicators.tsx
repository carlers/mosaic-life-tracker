import React, { Suspense, useState } from 'react';
import {
  Cloud,
  CloudAlert,
  CloudCheck,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useOfflineReadiness } from '../../hooks/useOfflineReadiness';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';

const LazySyncStatusSheet = React.lazy(() =>
  import('../modals/SyncStatusSheet').then((module) => ({
    default: module.SyncStatusSheet,
  }))
);

export const HomeStatusIndicators: React.FC = () => {
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const isOnline = connectivity.status === 'online';
  const isOffline = connectivity.status === 'offline';
  const sync = useSyncStatus();
  const readiness = useOfflineReadiness(user?.$id);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { updateAvailable, openUpdatePrompt } = usePwaLifecycle();
  const connectionLabel = isOnline ? 'Online' : isOffline ? 'Offline' : 'Checking connection';
  const syncProblem = sync.errors.length > 0 || Boolean(sync.notice);
  const buttonBaseClass = 'rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2';

  const syncLabel = connectivity.status === 'checking'
    ? 'Checking connection'
    : isOffline
      ? 'Sync paused while offline'
    : sync.isSyncing
      ? sync.progress
        ? 'Syncing ' + sync.progress.percent + '%'
        : 'Syncing'
      : sync.errors.length > 0
        ? 'Sync issue'
        : sync.notice
          ? 'Sync still finishing'
          : readiness.isReady
          ? 'Synced and ready offline'
          : sync.lastSync
            ? 'Preparing offline access'
            : 'Waiting for first sync';

  const syncIcon = connectivity.status === 'checking' || isOffline ? (
    <Cloud size={16} aria-hidden="true" />
  ) : sync.isSyncing ? (
    <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
  ) : syncProblem ? (
    <CloudAlert size={16} aria-hidden="true" />
  ) : readiness.isReady ? (
    <CloudCheck size={16} aria-hidden="true" />
  ) : (
    <Cloud size={16} aria-hidden="true" />
  );

  const openStatus = () => setIsSheetOpen(true);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={openStatus}
          aria-label={connectionLabel}
          title={connectionLabel}
          className={`${buttonBaseClass} hover:bg-[#1E1E1E] ${
            isOnline
              ? 'text-emerald-500/80 hover:text-emerald-400 focus-visible:ring-emerald-500/60'
              : isOffline
                ? 'text-amber-400 focus-visible:ring-amber-400/60'
                : 'text-gray-500 hover:text-gray-300 focus-visible:ring-gray-500/60'
          }`}
        >
          {isOffline ? <WifiOff size={16} aria-hidden="true" /> : <Wifi size={16} aria-hidden="true" />}
        </button>
        {updateAvailable && (
          <button type="button" onClick={() => openUpdatePrompt()}
            aria-label="App update ready" title="Mosaic update ready"
            className="flex h-10 w-9 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-400"
            data-home-update-trigger="true">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={openStatus}
          data-home-sync-trigger="true"
          aria-label={syncLabel}
          title={syncLabel}
          className={
            `${buttonBaseClass} hover:bg-[#1E1E1E] ${
              syncProblem
                ? 'text-amber-400 focus-visible:ring-amber-400/60'
                : 'text-gray-400 hover:text-white focus-visible:ring-emerald-500/60'
            }`
          }
        >
          {syncIcon}
        </button>
      </div>

      {isSheetOpen && (
        <Suspense fallback={null}>
          <LazySyncStatusSheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};
