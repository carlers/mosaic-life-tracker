import { useEffect } from 'react';
import type { ViewType } from '../components/home/ViewSwitcher';
import { canUseKeyboardShortcut } from '../lib/keyboardShortcuts';
import { useKeyboardShortcuts } from './keyboardShortcutsContext';

/** Only the currently visible Home person may handle view shortcuts.
 * Reuse the same asynchronous ViewSwitcher action for pointer and keyboard. */
export function useHomeViewKeyboardShortcuts(
  isActive: boolean,
  activeView: ViewType,
  onViewChange: (view: ViewType) => void,
): void {
  const { enabled } = useKeyboardShortcuts();
  useEffect(() => {
    if (!isActive || !enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canUseKeyboardShortcut(event)) return;
      const view: ViewType | null = event.key === 't' ? 'todo' :
        event.key === 'd' ? 'diary' : event.key === 'v' ? 'calendar' : null;
      if (!view || view === activeView) return;
      event.preventDefault();
      onViewChange(view);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, enabled, isActive, onViewChange]);
}
