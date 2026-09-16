import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  getSyncStatus,
  subscribeToSyncStatus,
  forceSync,
  type SyncStatus,
} from '../../db/sync';
interface SyncStatusSheetProps {
  isOpen: boolean;
  onClose: () => void;
}
function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
export const SyncStatusSheet: React.FC<SyncStatusSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [isManualSyncDisabled, setIsManualSyncDisabled] = useState(false);
  // subscribeToSyncStatus invokes the listener synchronously with the
  // current status, so the initial state is delivered by the subscriber
  // itself. No direct setState call in the effect body.
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeToSyncStatus((next) => setStatus(next));
    return unsubscribe;
  }, [isOpen]);
  useEffect(() => {
    if (!isManualSyncDisabled) return;
    const t = setTimeout(() => setIsManualSyncDisabled(false), 2000);
    return () => clearTimeout(t);
  }, [isManualSyncDisabled]);
  const errorCount = status.errors.length;
  const handleSyncNow = () => {
    if (isManualSyncDisabled) return;
    setIsManualSyncDisabled(true);
    forceSync().catch((err) => {
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
      <div className="pt-2 pb-8 px-4 space-y-4">
        <div className="bg-[#1A1A1A] rounded-xl p-4 flex items-center gap-3">
          {status.isSyncing ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
          ) : errorCount === 0 ? (
            <CheckCircle2
              size={20}
              className="text-emerald-500 flex-shrink-0"
            />
          ) : (
            <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {status.isSyncing
                ? 'Syncing…'
                : errorCount === 0
                ? 'Up to date'
                : `${errorCount} error${errorCount === 1 ? '' : 's'}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Last synced {formatRelative(status.lastSync)}
            </p>
          </div>
        </div>
        {errorCount > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Errors
            </p>
            {status.errors.map((err, i) => (
              <div
                key={i}
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
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isManualSyncDisabled || status.isSyncing}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#2A2A2A] hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-colors"
        >
          <RefreshCw
            size={16}
            className={status.isSyncing ? 'animate-spin' : ''}
          />
          {status.isSyncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>
    </BottomSheet>
  );
};
