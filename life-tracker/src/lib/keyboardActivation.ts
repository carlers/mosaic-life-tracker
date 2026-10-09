/**
 * Keyboard parity for custom interactive rows that expose a button-like role.
 * Keep text-input Enter/Escape and native <button> behavior on their own paths.
 */
export function activateOnEnterOrSpace(
  event: Pick<KeyboardEvent, 'key' | 'preventDefault'>,
  activate: () => void
): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activate();
}
