import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSheetReset } from '../../hooks/useSheetReset';
import { usePropSync } from '../../hooks/usePropSync';
import { restoreUserData } from '../../lib/restoreData';
import { CORE_BACKEND } from '../../lib/coreBackendConfig';
import { MOSAIC_FEATURE_PROFILE } from '../../lib/backendCapabilities';
import { triggerDownload } from '../../lib/exportData';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import {
  prepareTodoMateTransfer,
  type PreparedTodoMateTransfer,
} from '../../lib/todomateImport';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { Spinner } from '../ui/Spinner';
import {
  beginTodoMateImport,
  clearTodoMateImportMarker,
  markTodoMateImportApplied,
  readTodoMateImportMarker,
} from '../../lib/todomateImportState';

interface TodoMateImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const TodoMateImportSheet: React.FC<TodoMateImportSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [prepared, setPrepared] = useState<PreparedTodoMateTransfer | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'todomate-replace'>('merge');
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const previewGenerationRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewInFlightRef = useRef(false);
  const importInFlightRef = useRef(false);
  const previewUserIdRef = useRef<string | null>(null);

  useSheetReset(isOpen, () => {
    previewGenerationRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewInFlightRef.current = false;
    importInFlightRef.current = false;
    setEmail('');
    setPassword('');
    setPrepared(null);
    setImportMode('merge');
    setIsReplaceConfirmOpen(false);
    setIsPreparing(false);
    setIsImporting(false);
    setProgress('');
    setProgressPercent(null);
    setError(null);
    const marker = user?.$id ? readTodoMateImportMarker(user.$id) : null;
    if (marker?.phase === 'applying') {
      setRecoveryNotice(
        'A previous TodoMate import was interrupted. Preview it again and rerun Import; already-applied rows will not duplicate.'
      );
    } else if (marker?.phase === 'applied') {
      setRecoveryNotice(
        'A previous TodoMate import finished locally and may still be syncing to your other devices.'
      );
      if (user?.$id) clearTodoMateImportMarker(user.$id);
    } else {
      setRecoveryNotice(null);
    }
  });

  usePropSync(isOpen, () => {
    if (isOpen) return;
    previewGenerationRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewInFlightRef.current = false;
    setPassword('');
    setIsPreparing(false);
    setProgressPercent(null);
  });

  useEffect(
    () => () => {
      previewGenerationRef.current += 1;
      previewAbortRef.current?.abort();
    },
    []
  );

  const currentUser = user
    ? { id: user.$id, email: user.email, name: user.name || '' }
    : null;

  const handlePreview = async () => {
    if (
      !currentUser ||
      !email.trim() ||
      !password ||
      isPreparing ||
      isImporting ||
      previewInFlightRef.current
    ) {
      return;
    }

    previewInFlightRef.current = true;
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const generation = ++previewGenerationRef.current;

    setIsPreparing(true);
    setPrepared(null);
    setIsReplaceConfirmOpen(false);
    setRecoveryNotice(null);
    setError(null);
    setProgress('Connecting to TodoMate…');
    setProgressPercent(0);
    try {
      const result = await prepareTodoMateTransfer(
        { email, password },
        {
          signal: controller.signal,
          onProgressDetail: (detail) => {
            if (generation === previewGenerationRef.current) {
              setProgress(detail.message);
              setProgressPercent(detail.percent);
            }
          },
        }
      );
      if (generation !== previewGenerationRef.current) return;
      previewUserIdRef.current = currentUser.id;
      setPrepared(result);
      setProgress('');
      setProgressPercent(null);
    } catch (err) {
      if (generation !== previewGenerationRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read TodoMate data. Please try again.'
      );
      setProgress('');
      setProgressPercent(null);
    } finally {
      if (generation === previewGenerationRef.current) {
        previewAbortRef.current = null;
        previewInFlightRef.current = false;
        setPassword('');
        setIsPreparing(false);
      }
    }
  };

  const handleImport = async () => {
    if (
      !currentUser ||
      !prepared ||
      isPreparing ||
      isImporting ||
      importInFlightRef.current
    ) {
      return;
    }
    if (previewUserIdRef.current !== currentUser.id) return setPrepared(null);

    importInFlightRef.current = true;
    setRecoveryNotice(null);
    setIsImporting(true);
    setError(null);
    setProgress('Preparing Mosaic import…');
    setProgressPercent(0);
    beginTodoMateImport(currentUser.id, {
      tasks: prepared.preview.tasks,
      categories: prepared.preview.categories,
      diary: prepared.preview.diary,
      photos: prepared.preview.photosReady,
    });
    try {
      if (CORE_BACKEND.driver === 'supabase' && prepared.preview.photosReady > 0) {
        // Supabase core has no authorized media storage yet. Keep the prepared
        // TodoMate photo archive independently downloadable before local apply.
        triggerDownload(prepared.file, prepared.file.name);
      }
      const result = await restoreUserData(prepared.file, currentUser, {
        mode: importMode,
        onProgressDetail: (detail) => {
          setProgress(detail.message);
          setProgressPercent(detail.percent);
        },
        onLocalApplyComplete: () => markTodoMateImportApplied(currentUser.id),
      }, true);
      const restored = Object.values(result.restored).reduce(
        (total, count) => total + count,
        0
      );
      const notes = [
        `${restored} restored`,
        result.imagesRestored > 0
          ? `${result.imagesRestored} photo${result.imagesRestored === 1 ? '' : 's'} copied`
          : '',
        result.imagesMissing > 0
          ? `${result.imagesMissing} photo${result.imagesMissing === 1 ? '' : 's'} not copied`
          : '',
        result.skippedNewer > 0 ? `${result.skippedNewer} newer Mosaic item${result.skippedNewer === 1 ? '' : 's'} kept` : '',
        result.tombstoned > 0 ? `${result.tombstoned} prior task/category item${result.tombstoned === 1 ? '' : 's'} replaced` : '',
      ].filter(Boolean);

      if (result.syncState === 'synced') {
        clearTodoMateImportMarker(currentUser.id);
        onSuccess?.(`TodoMate import complete · ${notes.join(' · ')}`);
      } else {
        onSuccess?.(
          `TodoMate imported locally · Sync pending · ${notes.join(' · ')}`
        );
      }
      importInFlightRef.current = false;
      setIsImporting(false);
      setIsReplaceConfirmOpen(false);
      setProgress('');
      setProgressPercent(null);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'TodoMate import failed. Please try again.'
      );
      importInFlightRef.current = false;
      setIsImporting(false);
      setIsReplaceConfirmOpen(false);
      setProgress('');
      setProgressPercent(null);
    }
  };

  const busy = isPreparing || isImporting;
  const preview = prepared?.preview;
  const progressPanel =
    busy && progress ? (
      <div className="space-y-2 px-1" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <Spinner size="w-4 h-4" className="flex-shrink-0" />
          <span className="min-w-0 flex-1 text-sm text-gray-300">
            {progress}
          </span>
          {progressPercent !== null && (
            <span className="text-xs tabular-nums text-gray-400">
              {progressPercent}%
            </span>
          )}
        </div>
        {progressPercent !== null && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[#2A2A2A]"
            role="progressbar"
            aria-label={
              isPreparing
                ? 'TodoMate preview progress'
                : 'TodoMate import progress'
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
              style={{ width: progressPercent + '%' }}
            />
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Import from TodoMate"
      height="full"
      isLocked={isImporting || isReplaceConfirmOpen}
      suspendInteraction={isReplaceConfirmOpen}
      preventDismiss={isImporting}
    >
      <div className="px-4 pt-2 pb-8 space-y-5">
        <SheetErrorBanner message={error} />

        {recoveryNotice && (
          <div
            role="status"
            className="rounded-xl border border-amber-900/50 bg-amber-900/15 px-3.5 py-3 text-sm text-amber-200"
          >
            {recoveryNotice}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-gray-300 leading-relaxed">
            Transfer your TodoMate groups, task history, photos, memos, completion state,
            reminders, and diary entries into Mosaic without TodoMate&apos;s paid export.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Your TodoMate login is sent directly from this browser to TodoMate&apos;s
            Firebase/Google login service. Mosaic does not save your password or send it
            through a third-party migration server.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-white mb-1.5">
              TodoMate email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setPrepared(null);
              }}
              autoComplete="username"
              disabled={busy}
              className="w-full rounded-xl border border-[#333333] bg-[#1A1A1A] px-3.5 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-white mb-1.5">
              TodoMate password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPrepared(null);
              }}
              autoComplete="current-password"
              disabled={busy}
              className="w-full rounded-xl border border-[#333333] bg-[#1A1A1A] px-3.5 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            />
          </label>
        </div>

        {isPreparing && progressPanel}

        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          disabled={busy || !currentUser || !email.trim() || !password}
          onClick={() => void handlePreview()}
        >
          {isPreparing ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Reading TodoMate…
            </>
          ) : (
            <>
              <Download size={18} aria-hidden="true" />
              Preview Transfer
            </>
          )}
        </Button>

        {preview && (
          <section
            aria-labelledby="todomate-preview-heading"
            className="rounded-xl border border-[#333333] bg-[#1A1A1A] p-4 space-y-3"
          >
            <div>
              <h3
                id="todomate-preview-heading"
                className="text-sm font-semibold text-white"
              >
                Ready to import
              </h3>
              <p className="mt-1 text-sm text-gray-300">
                {preview.tasks} tasks · {preview.categories} categories ·{' '}
                {preview.diary} diary entries
              </p>
            </div>

            <div className="space-y-1 text-xs text-gray-400 leading-relaxed">
              {CORE_BACKEND.driver === 'supabase' && (
                <p role="status">Supabase currently imports tasks and categories
                  {['core-diary', 'personal'].includes(MOSAIC_FEATURE_PROFILE) ? ' plus Diary entries' : ' only (Diary remains in TodoMate)'}.
                  Keep your existing Mosaic ZIP and any downloaded TodoMate photo ZIP.
                  Import requires an active signed Supabase sync connection.</p>
              )}
              {preview.unscheduledMovedToToday > 0 && (
                <p>
                  {preview.unscheduledMovedToToday} unscheduled task
                  {preview.unscheduledMovedToToday === 1 ? '' : 's'} will be
                  placed on today because Mosaic currently requires task dates.
                </p>
              )}
              {preview.photosReady > 0 && (
                <p>
                  {preview.photosReady} of {preview.photosFound} TodoMate photo
                  attachment{preview.photosFound === 1 ? '' : 's'} are ready
                  {CORE_BACKEND.driver === 'supabase' ? ' in a separate ZIP download, but cannot be uploaded to Supabase yet.' : ' to copy into Mosaic Storage.'}
                </p>
              )}
              {preview.photosUnavailable > 0 && (
                <p>
                  {preview.photosUnavailable} TodoMate photo attachment
                  {preview.photosUnavailable === 1 ? '' : 's'} could not be
                  downloaded and will be skipped. You can retry the import later.
                </p>
              )}
              {preview.routinesReferenced > 0 && (
                <p>
                  {preview.routinesReferenced} TodoMate routine reference
                  {preview.routinesReferenced === 1 ? '' : 's'} will stay linked
                  on imported tasks, but recurring routine rules are not recreated.
                </p>
              )}
              {importMode === 'merge' ? (
                <p>Existing newer Mosaic data wins in Merge mode, and current-only records are left untouched.</p>
              ) : (
                <p>Replace makes TodoMate tasks and categories authoritative.
                  Other Mosaic personal data is preserved; supported Diary entries merge without deletion.</p>
              )}
            </div>
          </section>
        )}

        {prepared && (
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-sm font-medium text-white">TodoMate import mode</legend>
            <label className="flex items-start gap-3 rounded-xl border border-[#333333] bg-[#1A1A1A] p-3 cursor-pointer">
              <input type="radio" name="todomate-mode" value="merge"
                checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-1" />
              <span className="text-sm text-gray-300"><strong className="block text-white">Merge (recommended)</strong>
                Keep newer Mosaic records and everything missing from TodoMate.</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-red-900/40 bg-[#1A1A1A] p-3 cursor-pointer">
              <input type="radio" name="todomate-mode" value="todomate-replace"
                checked={importMode === 'todomate-replace'} onChange={() => setImportMode('todomate-replace')} className="mt-1" />
              <span className="text-sm text-gray-300"><strong className="block text-white">Replace tasks &amp; categories</strong>
                Current-only Mosaic tasks/categories are marked deleted. Diary, settings,
                Bucket List and social records remain.</span>
            </label>
          </fieldset>
        )}

        {isImporting && progressPanel}

        {prepared && (
          <Button
            variant={importMode === 'todomate-replace' ? 'danger' : 'primary'}
            className="w-full py-3"
            disabled={busy || !currentUser}
            onClick={() => importMode === 'todomate-replace' ? setIsReplaceConfirmOpen(true) : void handleImport()}
          >
            {isImporting ? 'Importing…' : importMode === 'todomate-replace' ? 'Replace with TodoMate' : 'Import into Mosaic'}
          </Button>
        )}
      </div>
    </BottomSheet>
    <ConfirmSheet
      isOpen={isReplaceConfirmOpen}
      onClose={() => setIsReplaceConfirmOpen(false)}
      title="Replace Mosaic tasks and categories?"
      message="TodoMate will replace all current Mosaic tasks and categories, including newer Mosaic edits. Tasks and categories missing from TodoMate will be marked deleted on sync. Your Diary entries, settings, Bucket List and social data are preserved. Mosaic downloads a safety backup before changing anything. Keep your original offline ZIP."
      confirmLabel="Replace tasks"
      destructive
      isProcessing={isImporting}
      processingLabel="Replacing…"
      onConfirm={() => void handleImport()}
    />
    </>
  );
};
