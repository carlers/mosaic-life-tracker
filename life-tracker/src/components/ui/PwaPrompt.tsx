import { useState, useSyncExternalStore } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';
import { getTopVisibleSheetId, subscribeToSheetLayers } from '../../lib/sheetLayers';

export function PwaPrompt() {
  const {
    installAvailable,
    updateAvailable,
    applyUpdate,
    dismissInstall,
    dismissUpdate,
    requestInstall,
  } = usePwaLifecycle();
  const [isWorking, setIsWorking] = useState(false);
  const topVisibleSheetId = useSyncExternalStore(subscribeToSheetLayers, getTopVisibleSheetId, () => null);
  const [error, setError] = useState<string | null>(null);

  // A sheet portal owns keyboard and pointer focus until its exit completes.
  // Do not display a non-modal PWA notice inside the inert #root.
  // Lifecycle availability stays pending and is shown once the stack clears.
  if ((!updateAvailable && !installAvailable) || topVisibleSheetId !== null) return null;

  const isUpdate = updateAvailable;
  const handleAction = async () => {
    setIsWorking(true);
    setError(null);
    try {
      if (isUpdate) await applyUpdate();
      else await requestInstall();
    } catch (cause) {
      console.error(`[PWA] ${isUpdate ? 'Update' : 'Install'} action failed:`, cause);
      setError(`${isUpdate ? 'Update' : 'Install'} failed. Please try again.`);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <aside
      aria-label={isUpdate ? 'App update available' : 'Install Mosaic'}
      className="fixed z-[80] bottom-24 left-4 right-4 mx-auto max-w-md rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2 text-emerald-400">
          {isUpdate
            ? <RefreshCw size={18} aria-hidden="true" />
            : <Download size={18} aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">
            {isUpdate ? 'Mosaic update ready' : 'Install Mosaic'}
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-400">
            {isUpdate
              ? 'Update now to use the latest version. Mosaic will reload after you confirm.'
              : 'Add Mosaic to this device for quick access and a standalone app experience.'}
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={isWorking}
            onClick={handleAction}
            className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {isWorking ? 'Please wait…' : isUpdate ? 'Update now' : 'Install'}
          </button>
        </div>
        <button
          type="button"
          onClick={isUpdate ? dismissUpdate : dismissInstall}
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label={isUpdate ? 'Update later' : 'Dismiss install prompt'}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
