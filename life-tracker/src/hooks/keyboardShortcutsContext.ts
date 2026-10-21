import { createContext, useContext } from 'react';

export interface KeyboardShortcutState {
  enabled: boolean;
  openGuide: () => void;
}

export const KeyboardShortcutsContext = createContext<KeyboardShortcutState>({
  enabled: true,
  openGuide: () => {},
});

/** Ordinary keyboard accessibility stays active when accelerators are off. */
export function useKeyboardShortcuts(): KeyboardShortcutState {
  return useContext(KeyboardShortcutsContext);
}
