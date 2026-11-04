import { useState, useSyncExternalStore } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';
import { isSheetVisible, subscribeToSheetVisibility } from '../../lib/sheetVisibility';
import { PwaUpdateDialog } from './PwaUpdateDialog';

// The install offer stays non-modal. The update uses its own centered modal.
export function PwaPrompt() {
  const { installAvailable, updateAvailable, dismissInstall, requestInstall } = usePwaLifecycle();
  const hasVisibleSheet = useSyncExternalStore(subscribeToSheetVisibility, isSheetVisible, () => false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (updateAvailable) return <PwaUpdateDialog />;
  if (!installAvailable || hasVisibleSheet) return null;

  const handleInstall = async () => {
    setIsWorking(true);
    setError(null);
    try {
      await requestInstall();
    } catch (cause) {
      console.error('[PWA] Install action failed:', cause);
      setError('Install failed. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <aside aria-label="Install Mosaic"
      className="fixed z-[80] bottom-24 left-4 right-4 mx-auto max-w-md rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2 text-emerald-400">
          <Download size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">Install Mosaic</h2>
          <p className="mt-1 text-sm leading-5 text-gray-400">
            Add Mosaic to this device for quick access and a standalone app experience.
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
          <button type="button" disabled={isWorking} onClick={handleInstall}
            className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400">
            {isWorking ? 'Please wait…' : 'Install'}
          </button>
        </div>
        <button type="button" onClick={dismissInstall}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-[#2A2A2A] hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label="Dismiss install prompt"><X size={18} aria-hidden="true" /></button>
      </div>
    </aside>
  );
}
