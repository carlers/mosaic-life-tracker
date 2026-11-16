import { createContext, useContext } from 'react';
import type { GestureShortcutAction, GestureShortcutTrigger } from '../lib/gestureShortcuts';

export interface GestureShortcutsContextValue {
  actionFor: (trigger: GestureShortcutTrigger) => GestureShortcutAction | null;
  dispatch: (action: GestureShortcutAction) => void;
}

export const NO_SHORTCUTS: GestureShortcutsContextValue = {
  actionFor: () => null,
  dispatch: () => {},
};
export const GestureShortcutsContext = createContext<GestureShortcutsContextValue>(NO_SHORTCUTS);

export function useGestureShortcuts(): GestureShortcutsContextValue {
  return useContext(GestureShortcutsContext);
}
