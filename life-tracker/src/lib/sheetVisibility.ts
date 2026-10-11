// A small cross-chunk signal: global notices must not render inside an inert
// app root while any BottomSheet portal (including its exit) is visible.
let visible = false;
const listeners = new Set<() => void>();

export function subscribeToSheetVisibility(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isSheetVisible(): boolean {
  return visible;
}

export function publishSheetVisibility(next: boolean): void {
  if (visible === next) return;
  visible = next;
  for (const listener of listeners) listener();
}
