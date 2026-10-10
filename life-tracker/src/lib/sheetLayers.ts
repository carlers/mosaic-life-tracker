/** Visible BottomSheet portals, including sheets completing their exit animation.
 * Shared with non-modal notices so they cannot surface in the inert app root. */
type Listener = () => void;

const visibleSheetIds: string[] = [];
const listeners = new Set<Listener>();
const deferredFocusReturn = new Map<string, HTMLElement>();
let previousAppInert = false;

export function subscribeToSheetLayers(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getTopVisibleSheetId(): string | null {
  return visibleSheetIds[visibleSheetIds.length - 1] ?? null;
}

export function queueSheetFocusReturn(sheetId: string, target: HTMLElement): void {
  deferredFocusReturn.set(sheetId, target);
}

export function updateVisibleSheet(sheetId: string, visible: boolean): void {
  const index = visibleSheetIds.indexOf(sheetId);
  if ((index >= 0) === visible) return;
  if (visible) visibleSheetIds.push(sheetId);
  else visibleSheetIds.splice(index, 1);

  // Portals live outside #root: only the app tree becomes inert while a
  // sheet is visible. Keep that state through its closing animation.
  const appRoot = document.getElementById('root');
  if (visibleSheetIds.length === 1 && visible) {
    previousAppInert = appRoot?.inert ?? false;
  }
  if (appRoot) appRoot.inert = visibleSheetIds.length > 0 || previousAppInert;
  for (const listener of listeners) listener();

  if (!visible) {
    const target = deferredFocusReturn.get(sheetId);
    deferredFocusReturn.delete(sheetId);
    if (target) {
      window.requestAnimationFrame(() => {
        if (!target.isConnected || target.closest('[inert]')) return;
        target.focus({ preventScroll: true });
      });
    }
  }
}
