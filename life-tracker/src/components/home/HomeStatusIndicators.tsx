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
  const isOnline = useConnectivity();
  const sync = useSyncStatus();
  const readiness = useOfflineReadiness(user?.$id);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const syncLabel = !isOnline
    ? 'Sync paused while offline'
    : sync.isSyncing
      ? 'Syncing'
      : sync.errors.length > 0
        ? 'Sync issue'
        : readiness.isReady
          ? 'Synced and ready offline'
          : sync.lastSync
            ? 'Preparing offline access'
            : 'Waiting for first sync';

  const syncIcon = !isOnline ? (
    <Cloud size={16} aria-hidden="true" />
  ) : sync.isSyncing ? (
    <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
  ) : sync.errors.length > 0 ? (
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
          aria-label={isOnline ? 'Online' : 'Offline'}
          title={isOnline ? 'Online' : 'Offline'}
          className={
            isOnline
              ? 'rounded-lg p-1.5 text-emerald-500/80 transition-colors hover:bg-[#1E1E1E] hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
              : 'rounded-lg p-1.5 text-amber-400 transition-colors hover:bg-[#1E1E1E] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60'
          }
        >
          {isOnline ? (
            <Wifi size={16} aria-hidden="true" />
          ) : (
            <WifiOff size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={openStatus}
          aria-label={syncLabel}
          title={syncLabel}
          className={
            sync.errors.length > 0
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
