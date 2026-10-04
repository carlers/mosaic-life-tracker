import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  HardDrive,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { formatRelative } from '../../lib/format';
import {
  getSyncStatus,
  subscribeToSyncStatus,
  type SyncStatus,
} from '../../lib/syncStatus';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useOfflineReadiness } from '../../hooks/useOfflineReadiness';

interface SyncStatusSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncStatusSheet: React.FC<SyncStatusSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const connectivity = useConnectivity();
  const isOnline = connectivity.status === 'online';
  const isOffline = connectivity.status === 'offline';
  const readiness = useOfflineReadiness(user?.$id);
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [isManualSyncDisabled, setIsManualSyncDisabled] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    return subscribeToSyncStatus(setStatus);
  }, [isOpen]);

  useEffect(() => {
    if (!isManualSyncDisabled) return;
    const timer = setTimeout(() => setIsManualSyncDisabled(false), 2000);
    return () => clearTimeout(timer);
  }, [isManualSyncDisabled]);

  const errorCount = status.errors.length;
  const dataReady = Boolean(readiness.dataReadyAt);
  const shellReady = Boolean(readiness.shellReadyAt);

  const handleSyncNow = () => {
    const userId = user?.$id;
    if (
      !userId ||
      !isOnline ||
      isManualSyncDisabled ||
      status.isSyncing
    ) {
      return;
    }
    setIsManualSyncDisabled(true);
    void import('../../db/sync')
      .then(({ syncNow }) => syncNow(userId))
      .catch((err) => {
        console.error('[SyncStatusSheet] Manual sync failed:', err);
      });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Sync Status"
      height="auto"
    >
      <div className="pt-2 pb-8 px-4 space-y-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 flex items-center gap-3">
          {isOnline ? (
            <Wifi size={20} className="text-emerald-500 flex-shrink-0" />
          ) : isOffline ? (
            <WifiOff size={20} className="text-amber-400 flex-shrink-0" />
          ) : (
            <Wifi size={20} className="text-gray-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {isOnline
                ? 'Online'
                : isOffline
                  ? 'Offline'
                  : 'Checking connection'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isOnline
                ? 'Mosaic has confirmed Appwrite is reachable.'
                : isOffline
                  ? 'Personal data stays available locally. Sync resumes when Mosaic can reach Appwrite again.'
                  : 'Mosaic is verifying sync reachability in the background.'}
            </p>
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-4 flex items-center gap-3">
          {status.isSyncing ? (
            <RefreshCw
              size={20}
              className="animate-spin text-gray-300 flex-shrink-0"
            />
          ) : errorCount > 0 ? (
            <AlertCircle
              size={20}
              className="text-amber-500 flex-shrink-0"
            />
          ) : status.lastSync ? (
            <CheckCircle2
              size={20}
              className="text-emerald-500 flex-shrink-0"
            />
          ) : (
            <Cloud size={20} className="text-gray-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {connectivity.status === 'checking'
                ? 'Waiting for connection check'
                : isOffline
                  ? 'Sync paused'
                : status.isSyncing
                  ? status.progress
                    ? `Syncing · ${status.progress.percent}%`
                    : 'Syncing…'
                  : errorCount > 0
                    ? `${errorCount} error${errorCount === 1 ? '' : 's'}`
                    : status.notice
                      ? 'Sync still finishing'
                      : status.lastSync
                        ? 'Up to date'
                        : 'Waiting for first sync'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {status.isSyncing && status.progress
                ? status.progress.label
                : status.notice
                  ? status.notice
                  : status.lastSync
                    ? `Last synced ${formatRelative(status.lastSync, ' ago')}`
                    : 'This device has not completed a sync yet.'}
            </p>
            {status.isSyncing && status.progress && (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2A2A2A]"
                role="progressbar"
                aria-label="Sync progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={status.progress.percent}
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                  style={{ width: status.progress.percent + '%' }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-4 flex items-center gap-3">
          <HardDrive
            size={20}
            className={
              readiness.isReady
                ? 'text-emerald-500 flex-shrink-0'
                : 'text-gray-400 flex-shrink-0'
            }
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {readiness.isReady
                ? 'Ready for offline use'
                : 'Preparing offline access'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {readiness.isReady
                ? 'Local data and the app shell are prepared on this device.'
                : !dataReady && !shellReady
                  ? 'Waiting for the first complete sync and app-shell cache.'
                  : !dataReady
                    ? 'App shell cached. Waiting for the first complete data sync.'
                    : 'Data synced. Finishing the app-shell cache.'}
            </p>
          </div>
        </div>

        {errorCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              Errors
            </p>
            {status.errors.map((err, index) => (
              <div
                key={index}
                className="bg-[#1A1A1A] border border-red-900/30 rounded-lg p-3"
              >
                <p className="text-xs text-red-400 break-words whitespace-pre-wrap">
                  {err}
                </p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleSyncNow}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={
            !isOnline ||
            !user?.$id ||
            isManualSyncDisabled ||
            status.isSyncing
          }
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#2A2A2A] hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-colors"
        >
          <RefreshCw
            size={16}
            className={status.isSyncing ? 'animate-spin' : ''}
          />
          {connectivity.status === 'checking'
            ? 'Checking connection…'
            : isOffline
              ? 'Sync resumes when online'
            : status.isSyncing
              ? 'Syncing…'
              : 'Sync Now'}
        </button>
      </div>
    </BottomSheet>
  );
};
