import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock3, RefreshCw, Sparkles, X } from 'lucide-react';
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';
import { APP_VERSION } from '../../lib/appVersion';
import { describePwaUpdate } from '../../lib/pwaUpdateInfo';
import { isPwaAutoPromptDue } from '../../lib/pwaLifecycle';
import { isSheetVisible, subscribeToSheetVisibility } from '../../lib/sheetVisibility';
import { useFocusTrap } from '../../hooks/useFocusTrap';

function hasCompetingDialog(): boolean {
  return Boolean(document.querySelector(
    '[role="dialog"][aria-modal="true"]:not([data-mosaic-update-dialog]), [data-mosaic-tour]'
  ));
}
function isEditingNow(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && Boolean(active.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'
  ));
}

export function PwaUpdateDialog() {
  const {
    updateAvailable, updatePromptOpen, updateVersion, updateInfo,
    applyUpdate, dismissUpdate, deferUpdate, openUpdatePrompt,
  } = usePwaLifecycle();
  const hasVisibleSheet = useSyncExternalStore(subscribeToSheetVisibility, isSheetVisible, () => false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const workingRef = useRef(isWorking);
  workingRef.current = isWorking;
  const visible = updateAvailable && updatePromptOpen && !hasVisibleSheet;

  useFocusTrap(dialog, visible, undefined, (target) => {
    window.requestAnimationFrame(() => {
      if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
    });
  });

  // Background download is unimpeded; only an installed, waiting update is offered.
  // Automatic interruption is restricted to idle Home sessions and never steals an editor.
  useEffect(() => {
    if (!updateAvailable || updatePromptOpen || hasVisibleSheet) return;
    const mountedAt = Date.now();
    let lastActivity = mountedAt;
    const activity = () => { lastActivity = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'focusin'];
    for (const name of events) window.addEventListener(name, activity, { passive: true });
    const tick = () => {
      if (Date.now() - mountedAt < 5000 || Date.now() - lastActivity < 3000 ||
          document.visibilityState !== 'visible' || location.pathname !== '/home' ||
          hasCompetingDialog() || isEditingNow() || !isPwaAutoPromptDue()) return;
      openUpdatePrompt(true);
    };
    const timer = window.setInterval(tick, 1500);
    return () => {
      window.clearInterval(timer);
      for (const name of events) window.removeEventListener(name, activity);
    };
  }, [updateAvailable, updatePromptOpen, hasVisibleSheet, openUpdatePrompt]);

  useEffect(() => {
    if (!visible) return;
    const root = document.getElementById('root');
    const previouslyInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'BrowserBack') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!workingRef.current) dismissUpdate();
    };
    document.addEventListener('keydown', onKey, true);
    // A history guard lets Android/browser Back dismiss the dialog first.
    const guard = 'pwa-update-' + Date.now();
    window.history.pushState({ ...window.history.state, __mosaicPwaModal: guard }, '');
    let popped = false;
    const onPop = () => {
      popped = true;
      if (workingRef.current) {
        window.history.pushState({ ...window.history.state, __mosaicPwaModal: guard }, '');
        popped = false;
      } else dismissUpdate();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('popstate', onPop);
      if (!popped && window.history.state?.__mosaicPwaModal === guard) window.history.back();
      if (root) root.inert = previouslyInert;
      document.body.style.overflow = previousOverflow;
    };
  }, [visible, dismissUpdate]);

  if (!visible) return null;
  const info = updateInfo && updateInfo.version === updateVersion ? updateInfo : null;
  const details = describePwaUpdate(APP_VERSION, info);
  const versionLabel = updateVersion
    ? updateVersion === APP_VERSION
      ? 'New build of v' + APP_VERSION
      : 'v' + APP_VERSION + ' → v' + updateVersion
    : 'New build available';

  const handleApply = async () => {
    if (isWorking) return;
    if (isEditingNow() || document.querySelector('[data-unsaved-changes="true"], [data-pwa-block-reload="true"]')) {
      setError('Save your current edits before updating, or choose Later.');
      return;
    }
    setIsWorking(true);
    setError(null);
    try {
      const applied = await applyUpdate();
      if (!applied) setError('The update is no longer ready. Check for updates again.');
    } catch (cause) {
      console.error('[PWA] Update action failed:', cause);
      setError('Update failed. Your current version is still available. Try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[3px] sm:p-6"
      data-testid="pwa-update-overlay">
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="mosaic-update-title"
        aria-describedby="mosaic-update-description" data-mosaic-update-dialog
        className="mosaic-settings-page flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#3A3A3A] bg-surface text-white shadow-2xl"
        style={{ maxHeight: 'min(88dvh, 720px)' }}>
        <header className="flex shrink-0 items-start gap-3 border-b border-[#333333] p-5 pb-4">
          <span className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400">
            <Sparkles size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-400">{details.label}</p>
            <h2 id="mosaic-update-title" className="mt-1 text-lg font-semibold">Mosaic update ready</h2>
            <p className="mt-1 text-sm text-gray-400">{versionLabel}</p>
          </div>
          <button type="button" aria-label="Update later" disabled={isWorking} onClick={dismissUpdate}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" tabIndex={0}>
          <h3 className="text-sm font-semibold">{details.title}</h3>
          {details.changes.length > 0 ? (
            <ul aria-label="Selected update highlights" className="mt-3 space-y-3">
              {details.changes.map(change => (
                <li key={change} className="flex items-start gap-2.5 text-sm text-gray-300">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={16} aria-hidden="true" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Release details are not available for this downloaded update.</p>
          )}
          <p id="mosaic-update-description" className="mt-4 text-xs leading-5 text-gray-400">
            All app files are prepared. Updating will reload Mosaic. Save any unfinished drafts before continuing.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
          {showOptions && (
            <div className="mt-4 space-y-2" aria-label="Update reminder options">
              <button type="button" onClick={() => deferUpdate('next-launch')}
                className="block w-full rounded-lg border border-[#444] p-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-emerald-400">
                Remind on next launch
              </button>
              <button type="button" onClick={() => deferUpdate('tomorrow')}
                className="block w-full rounded-lg border border-[#444] p-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-emerald-400">
                Remind tomorrow
              </button>
            </div>
          )}
        </div>
        <footer className="shrink-0 space-y-2 border-t border-[#333333] px-5 py-4">
          <button type="button" onClick={() => { void handleApply(); }} disabled={isWorking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-400">
            <RefreshCw size={17} className={isWorking ? 'animate-spin' : ''} aria-hidden="true" />
            {isWorking ? 'Applying update…' : 'Update now'}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={dismissUpdate} disabled={isWorking}
              className="flex-1 rounded-lg border border-[#444] px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-emerald-400">
              Later
            </button>
            <button type="button" onClick={() => setShowOptions(value => !value)} disabled={isWorking}
              aria-expanded={showOptions}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#444] px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-emerald-400">
              <Clock3 size={15} aria-hidden="true" /> Reminder options
            </button>
          </div>
        </footer>
      </section>
    </div>, document.body
  );
}
