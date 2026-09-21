import { useEffect } from 'react';

interface HorizontalArrowNavigationOptions {
  enabled: boolean;
  onLeft: () => void;
  onRight: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])'
    )
  );
}

/**
 * Adds keyboard parity for horizontal swipe navigation without changing
 * visible UI. Arrow keys are ignored while typing/editing or when a browser
 * shortcut modifier is held.
 */
export function useHorizontalArrowNavigation({
  enabled,
  onLeft,
  onRight,
}: HorizontalArrowNavigationOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.isComposing ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onLeft();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onRight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onLeft, onRight]);
}
