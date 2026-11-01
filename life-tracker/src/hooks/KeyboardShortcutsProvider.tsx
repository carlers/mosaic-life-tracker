import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardShortcutsContext } from './keyboardShortcutsContext';
import { useSettings } from './useSettings';
import { useFeatureEnabled } from './useFeatureEnabled';
import { usePrimaryNavigationShortcuts } from './usePrimaryNavigationShortcuts';
import { canUseKeyboardShortcut } from '../lib/keyboardShortcuts';
import { KEYBOARD_SHORTCUTS_SETTING_KEY } from '../lib/preferences';

const LazyKeyboardShortcutsSheet = React.lazy(() =>
  import('../components/ui/KeyboardShortcutsSheet').then(module => ({
    default: module.KeyboardShortcutsSheet,
  }))
);

/** Mounted only inside the authenticated, initialized app data shell.
 * The account-scoped settings stream immediately updates all shortcut owners. */
export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getSetting, isLoading } = useSettings();
  const operatorEnabled = useFeatureEnabled('mosaic_disable_keyboard_shortcuts');
  const enabled = operatorEnabled && !isLoading && getSetting(KEYBOARD_SHORTCUTS_SETTING_KEY, true) !== false;
  const [guideOpen, setGuideOpen] = useState(false);
  usePrimaryNavigationShortcuts(enabled);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?' || !canUseKeyboardShortcut(event, { allowShift: true })) return;
      event.preventDefault();
      setGuideOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  const value = useMemo(() => ({ enabled, openGuide: () => setGuideOpen(true) }), [enabled]);
  return <KeyboardShortcutsContext.Provider value={value}>
    {children}
    {guideOpen && <React.Suspense fallback={null}>
      <LazyKeyboardShortcutsSheet isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </React.Suspense>}
  </KeyboardShortcutsContext.Provider>;
};
