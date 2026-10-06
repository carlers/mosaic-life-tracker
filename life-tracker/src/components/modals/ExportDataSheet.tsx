import React, { useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { Spinner } from '../ui/Spinner';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { useSheetReset } from '../../hooks/useSheetReset';
import { FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { exportUserData, triggerDownload } from '../../lib/exportData';
import {
  inspectBackupFile,
  restoreUserData,
  type BackupPreview,
  type RestoreMode,
} from '../../lib/restoreData';

interface ExportDataSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onBackupComplete?: (completedAt: string) => void;
  onRestoreComplete?: (completedAt: string) => void;
}

export const ExportDataSheet: React.FC<ExportDataSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onBackupComplete,
  onRestoreComplete,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInFlightRef = useRef(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSheetReset(isOpen, () => {
    setIncludeImages(false);
    setIsExporting(false);
    setExportProgress('');
    setRestoreFile(null);
    setRestorePreview(null);
    setRestoreMode('merge');
    setIsInspecting(false);
    setIsRestoring(false);
    setIsReplaceConfirmOpen(false);
    restoreInFlightRef.current = false;
    setRestoreProgress('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  });

  const currentUser = user
    ? { id: user.$id, email: user.email, name: user.name || '' }
    : null;

  const handleExport = async () => {
    if (!currentUser || isExporting || isRestoring) return;
    setIsExporting(true);
    setError(null);
    setExportProgress('Preparing…');
    try {
      const result = await exportUserData(currentUser, {
        includeImages,
        onProgress: setExportProgress,
      });
      triggerDownload(result.blob, result.filename);
      onBackupComplete?.(new Date().toISOString());
      setIsExporting(false);
      const missing = result.counts.missingImages;
      onSuccess?.(
        missing > 0
          ? `Backup ready (${missing} photo${missing === 1 ? '' : 's'} could not be fetched)`
          : 'Backup ready'
      );
    } catch (err) {
      console.error('[BackupRestoreSheet] Backup failed:', err);
      setError(
        err instanceof Error ? err.message : 'Backup failed. Please try again.'
      );
      setIsExporting(false);
    }
  };

  const handleChooseRestore = () => {
    if (isExporting || isRestoring || isInspecting) return;
    fileInputRef.current?.click();
  };

  const handleRestoreFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    setRestoreFile(null);
    setRestorePreview(null);
    setRestoreMode('merge');
    setIsReplaceConfirmOpen(false);
    setError(null);
    if (!file) return;

    setIsInspecting(true);
    setRestoreProgress('Validating backup…');
    try {
      const preview = await inspectBackupFile(file, currentUser?.id);
      setRestoreFile(file);
      setRestorePreview(preview);
      setRestoreProgress('');
    } catch (err) {
      setRestoreProgress('');
      setError(
        err instanceof Error ? err.message : 'Could not read this backup.'
      );
      event.target.value = '';
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRestore = async () => {
    if (
      !currentUser ||
      !restoreFile ||
      !restorePreview ||
      isRestoring ||
      isExporting ||
      restoreInFlightRef.current
    ) {
      return;
    }

    restoreInFlightRef.current = true;
    setIsRestoring(true);
    setError(null);
    setRestoreProgress('Preparing restore…');
    try {
      const result = await restoreUserData(restoreFile, currentUser, {
        mode: restoreMode,
        onProgressDetail: ({ message }) => setRestoreProgress(message),
      });
      const restoredTotal = Object.values(result.restored).reduce(
        (sum, count) => sum + count,
        0
      );
      const notes = [
        `${restoredTotal} restored`,
        result.skippedNewer > 0 ? `${result.skippedNewer} newer kept` : '',
        result.tombstoned > 0 ? `${result.tombstoned} replaced` : '',
        result.imagesMissing > 0 ? `${result.imagesMissing} photos missing` : '',
      ].filter(Boolean);
      onRestoreComplete?.(new Date().toISOString());
      onSuccess?.(
        result.syncState === 'synced'
          ? `Restore complete · ${notes.join(' · ')}`
          : `Restore saved locally · Sync pending · ${notes.join(' · ')}`
      );
      setIsRestoring(false);
      setIsReplaceConfirmOpen(false);
      setRestoreProgress('');
      restoreInFlightRef.current = false;
      onClose();
    } catch (err) {
      console.error('[BackupRestoreSheet] Restore failed:', err);
      setError(
        err instanceof Error ? err.message : 'Restore failed. Please try again.'
      );
      setIsRestoring(false);
      setIsReplaceConfirmOpen(false);
      setRestoreProgress('');
      restoreInFlightRef.current = false;
    }
  };

  const busy = isExporting || isInspecting || isRestoring;
  const sourceLabel =
    restorePreview?.sourceUser.email ||
    restorePreview?.sourceUser.name ||
    restorePreview?.sourceUser.id ||
    '';

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Backup & Restore"
        height="full"
        isLocked={isReplaceConfirmOpen || isRestoring}
        preventDismiss={isRestoring}
        suspendInteraction={isReplaceConfirmOpen}
      >
      <div className="px-4 pt-2 pb-8 space-y-6">
        <SheetErrorBanner message={error} />

        <section aria-labelledby="backup-heading" className="space-y-4">
          <div>
            <h3 id="backup-heading" className="text-base font-semibold text-white">
              Create backup
            </h3>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Download your tasks, categories, diary, preferences, and friendship
              reference data. Friendships are not restorable.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIncludeImages(!includeImages)}
            disabled={busy}
            aria-pressed={includeImages}
            className="w-full flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 hover:bg-[#222222] transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <ImageIcon size={16} className="text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Include photos</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Creates a ZIP. Uncached photos require internet.
                </p>
              </div>
            </div>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                includeImages ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
              aria-hidden="true"
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  includeImages ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </div>
          </button>

          {isExporting && exportProgress && (
            <div className="flex items-center gap-3 px-2 py-1" role="status">
              <Spinner size="w-4 h-4" className="flex-shrink-0" />
              <span className="text-sm text-gray-300">{exportProgress}</span>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full gap-2 py-3"
            onClick={handleExport}
            disabled={busy || !currentUser}
          >
            {isExporting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Creating backup…
              </>
            ) : (
              <>
                <FileDown size={18} aria-hidden="true" />
                Download Backup
              </>
            )}
          </Button>
        </section>

        <section
          aria-labelledby="restore-heading"
          className="border-t border-[#333333] pt-6 space-y-4"
        >
          <div>
            <h3 id="restore-heading" className="text-base font-semibold text-white">
              Restore backup
            </h3>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Mosaic validates the file before changing data. Messages, friendships,
              and your login account are never restored or replaced.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,.mosaicbackup,application/json,application/zip"
            className="sr-only"
            onChange={handleRestoreFile}
            disabled={busy}
            aria-label="Choose Mosaic backup file"
          />

          <Button
            variant="primary"
            className="w-full"
            onClick={handleChooseRestore}
            disabled={busy || !currentUser}
          >
            {isInspecting ? 'Validating backup…' : 'Choose Backup File'}
          </Button>

          {restorePreview && (
            <div className="rounded-xl border border-[#333333] bg-[#1A1A1A] p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{restoreFile?.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(restorePreview.exportedAt).toLocaleString()}
                    {sourceLabel ? ` · ${sourceLabel}` : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  v{restorePreview.version}
                </span>
              </div>

              <p className="text-sm text-gray-300">
                {restorePreview.counts.tasks} tasks ·{' '}
                {restorePreview.counts.categories} categories ·{' '}
                {restorePreview.counts.diary} diary ·{' '}
                {restorePreview.counts.settings} preferences
              </p>

              {(restorePreview.counts.images > 0 ||
                restorePreview.friendshipsReferenceOnly > 0) && (
                <p className="text-xs text-gray-400">
                  {restorePreview.counts.images > 0
                    ? `${restorePreview.counts.images} bundled photo${
                        restorePreview.counts.images === 1 ? '' : 's'
                      }`
                    : 'No bundled photos'}
                  {restorePreview.friendshipsReferenceOnly > 0
                    ? ` · ${restorePreview.friendshipsReferenceOnly} friendship reference${
                        restorePreview.friendshipsReferenceOnly === 1 ? '' : 's'
                      } ignored during restore`
                    : ''}
                </p>
              )}
            </div>
          )}

          {restorePreview && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-white mb-2">
                Restore mode
              </legend>
              <label className="flex gap-3 rounded-xl border border-[#333333] bg-[#1A1A1A] p-3 cursor-pointer">
                <input
                  type="radio"
                  name="restore-mode"
                  value="merge"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-white">
                    Merge with current data
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Keeps current-only data and preserves newer current versions.
                  </span>
                </span>
              </label>
              <label className="flex gap-3 rounded-xl border border-[#333333] bg-[#1A1A1A] p-3 cursor-pointer">
                <input
                  type="radio"
                  name="restore-mode"
                  value="replace"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-white">
                    Replace personal data with backup
                  </span>
                  <span className="block text-xs text-gray-400 mt-0.5">
                    Makes tasks, categories, diary, and preferences match the
                    backup. Mosaic downloads a safety backup first.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          {isRestoring && restoreProgress && (
            <div className="flex items-center gap-3 px-2 py-1" role="status">
              <Spinner size="w-4 h-4" className="flex-shrink-0" />
              <span className="text-sm text-gray-300">{restoreProgress}</span>
            </div>
          )}

          {restorePreview && (
            <Button
              variant={restoreMode === 'replace' ? 'danger' : 'primary'}
              className="w-full py-3"
              onClick={() => {
                if (restoreMode === 'replace') {
                  setIsReplaceConfirmOpen(true);
                  return;
                }
                void handleRestore();
              }}
              disabled={busy || !currentUser}
            >
              {isRestoring
                ? 'Restoring…'
                : restoreMode === 'replace'
                  ? 'Replace Personal Data'
                  : 'Merge Backup'}
            </Button>
          )}
        </section>
      </div>
      </BottomSheet>

      <ConfirmSheet
        isOpen={isReplaceConfirmOpen}
        onClose={() => setIsReplaceConfirmOpen(false)}
        title="Replace personal data?"
        message="This will make your tasks, categories, diary, and preferences match this backup. Current-only personal data will be deleted from sync. Friends, messages, and your login account are not affected. Mosaic downloads a safety backup first."
        confirmLabel="Replace Data"
        destructive
        isProcessing={isRestoring}
        processingLabel="Replacing…"
        onConfirm={() => {
          void handleRestore();
        }}
      />
    </>
  );
};
