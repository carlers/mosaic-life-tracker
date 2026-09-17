import { usePropSync } from './usePropSync';

/**
 * Shared "reset form state when the sheet opens" behavior. Replaces the
 * copy-pasted render-body block:
 *
 *   const [syncedIsOpen, setSyncedIsOpen] = useState(false);
 *   if (isOpen !== syncedIsOpen) {
 *     setSyncedIsOpen(isOpen);
 *     if (isOpen) { setField1(''); setField2(''); ... }
 *   }
 *
 * Callers pass `isOpen` and a `reset` callback that clears their form
 * state. The reset fires only on the false→true transition (opening),
 * not on every render while open.
 *
 * Built on `usePropSync` so the underlying render-body reset pattern
 * has a single implementation.
 */
export function useSheetReset(isOpen: boolean, reset: () => void): void {
  usePropSync(isOpen, () => {
    if (isOpen) reset();
  });
}
