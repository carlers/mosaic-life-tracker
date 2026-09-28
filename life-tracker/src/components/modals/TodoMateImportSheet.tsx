import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSheetReset } from '../../hooks/useSheetReset';
import { restoreUserData } from '../../lib/restoreData';
import {
  prepareTodoMateTransfer,
  type PreparedTodoMateTransfer,
} from '../../lib/todomateImport';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { Spinner } from '../ui/Spinner';

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
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSheetReset(isOpen, () => {
    setEmail('');
    setPassword('');
    setPrepared(null);
    setIsPreparing(false);
    setIsImporting(false);
    setProgress('');
    setError(null);
  });

  const currentUser = user
    ? { id: user.$id, email: user.email, name: user.name || '' }
    : null;

  const handlePreview = async () => {
    if (!email.trim() || !password || isPreparing || isImporting) return;
    setIsPreparing(true);
    setPrepared(null);
    setError(null);
    setProgress('Connecting to TodoMate…');
    try {
      const result = await prepareTodoMateTransfer(
        { email, password },
        { onProgress: setProgress }
      );
      setPrepared(result);
      setProgress('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read TodoMate data. Please try again.'
      );
      setProgress('');
    } finally {
      setPassword('');
      setIsPreparing(false);
    }
  };

  const handleImport = async () => {
    if (!currentUser || !prepared || isPreparing || isImporting) return;
    setIsImporting(true);
    setError(null);
    setProgress('Preparing Mosaic import…');
    try {
      const result = await restoreUserData(prepared.file, currentUser, {
        mode: 'merge',
        onProgress: setProgress,
      });
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
          ? `${result.imagesMissing} photo${result.imagesMissing === 1 ? '' : 's'} missing`
          : '',
        result.skippedNewer > 0 ? `${result.skippedNewer} newer Mosaic item${result.skippedNewer === 1 ? '' : 's'} kept` : '',
      ].filter(Boolean);

      onSuccess?.(`TodoMate import complete · ${notes.join(' · ')}`);
      setIsImporting(false);
      setProgress('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'TodoMate import failed. Please try again.'
      );
      setIsImporting(false);
      setProgress('');
    }
  };

  const busy = isPreparing || isImporting;
  const preview = prepared?.preview;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Import from TodoMate"
      height="full"
      isLocked={isImporting}
      preventDismiss={isImporting}
    >
      <div className="px-4 pt-2 pb-8 space-y-5">
        <SheetErrorBanner message={error} />

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

        {isPreparing && progress && (
          <div className="flex items-center gap-3 px-1" role="status">
            <Spinner size="w-4 h-4" className="flex-shrink-0" />
            <span className="text-sm text-gray-300">{progress}</span>
          </div>
        )}

        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          disabled={busy || !email.trim() || !password}
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
                  attachment{preview.photosFound === 1 ? '' : 's'} are ready to
                  copy into Mosaic Storage.
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
              <p>
                Import uses Merge mode. Existing newer Mosaic data wins, and
                current-only Mosaic data is left untouched.
              </p>
            </div>
          </section>
        )}

        {isImporting && progress && (
          <div className="flex items-center gap-3 px-1" role="status">
            <Spinner size="w-4 h-4" className="flex-shrink-0" />
            <span className="text-sm text-gray-300">{progress}</span>
          </div>
        )}

        {prepared && (
          <Button
            variant="primary"
            className="w-full py-3"
            disabled={busy || !currentUser}
            onClick={() => void handleImport()}
          >
            {isImporting ? 'Importing…' : 'Import into Mosaic'}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
};
