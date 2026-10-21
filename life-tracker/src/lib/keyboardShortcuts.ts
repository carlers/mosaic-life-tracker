/**
 * Shared guard for unmodified, single-key Mosaic shortcuts.
 * Browser/AT shortcuts, IME, editable controls and temporary overlays win.
 */
export function canUseKeyboardShortcut(
  event: KeyboardEvent,
  options: { allowOpenDialog?: boolean; allowShift?: boolean } = {},
): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing ||
      event.ctrlKey || event.altKey || event.metaKey || (event.shiftKey && !options.allowShift)) return false;
  const target = event.target;
  if (target instanceof Element && target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), ' +
    '[role="textbox"], [role="combobox"], [role="searchbox"], [inert], [aria-hidden="true"]'
  )) return false;
  if (!options.allowOpenDialog && document.querySelector(
    '[role="dialog"][aria-modal="true"]:not([inert]):not([aria-hidden="true"]), ' +
    '[role="menu"]:not([aria-hidden="true"]), [role="listbox"]:not([aria-hidden="true"])'
  )) return false;
  return true;
}
