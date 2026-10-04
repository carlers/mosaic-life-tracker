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

  const syncIcon = connectivity.status === 'checking' ? (
    <Cloud size={16} aria-hidden="true" />
  ) : isOffline ? (
    <Cloud size={16} aria-hidden="true" />
  ) : sync.isSyncing ? (
    <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
  ) : sync.errors.length > 0 || sync.notice ? (
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
          aria-label={
            isOnline
              ? 'Online'
              : isOffline
                ? 'Offline'
                : 'Checking connection'
          }
          title={
            isOnline
              ? 'Online'
              : isOffline
                ? 'Offline'
                : 'Checking connection'
          }
          className={
            isOnline
              ? 'rounded-lg p-1.5 text-emerald-500/80 transition-colors hover:bg-[#1E1E1E] hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
              : isOffline
                ? 'rounded-lg p-1.5 text-amber-400 transition-colors hover:bg-[#1E1E1E] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60'
                : 'rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[#1E1E1E] hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/60'
          }
        >
          {isOnline ? (
            <Wifi size={16} aria-hidden="true" />
          ) : isOffline ? (
            <WifiOff size={16} aria-hidden="true" />
          ) : (
            <Wifi size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={openStatus}
          aria-label={syncLabel}
          title={syncLabel}
          className={
            sync.errors.length > 0 || sync.notice
              ? 'rounded-lg p-1.5 text-amber-400 transition-colors hover:bg-[#1E1E1E] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60'
              : 'rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#1E1E1E] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
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
