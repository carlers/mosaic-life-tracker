import { createContext, useContext } from 'react';
import type { GestureShortcutAction, GestureShortcutTrigger } from '../lib/gestureShortcuts';

export interface GestureShortcutsContextValue {
  actionFor: (trigger: GestureShortcutTrigger) => GestureShortcutAction | null;
  dispatch: (action: GestureShortcutAction) => void;
}

export const GestureShortcutsContext = createContext<GestureShortcutsContextValue>({
  actionFor: () => null,
  dispatch: () => {},
});

export function useGestureShortcuts(): GestureShortcutsContextValue {
  return useContext(GestureShortcutsContext);
}
