import type { RefObject } from 'react';
import { canUseKeyboardShortcut } from './keyboardShortcuts';

/** Optional Home keyboard accelerator, loaded on mount outside first-paint JS. */
export function registerHomeShortcuts({
  taskSearchEnabled, friendCarouselRef, handleOpenBacklog, handleOpenSearch,
}: {
  taskSearchEnabled: boolean;
  friendCarouselRef: RefObject<HTMLDivElement | null>;
  handleOpenBacklog: () => void;
  handleOpenSearch: () => void;
}): () => void {
  // Reuse the exact same menu/Sync controls, never invoke a network action.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === '/' && taskSearchEnabled) {
      if (!canUseKeyboardShortcut(event) ||
        document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      handleOpenSearch();
      return;
    }
    const homeMenuShortcut = event.key === 'H' && event.shiftKey;
    if (!canUseKeyboardShortcut(event, { allowShift: homeMenuShortcut })) return;
    if (event.key === 'f') {
      const active = friendCarouselRef.current?.querySelector<HTMLButtonElement>(
        '[data-person-pill][aria-pressed="true"]'
      );
      if (active) {
        event.preventDefault();
        active.focus({ preventScroll: true });
      }
    } else if (homeMenuShortcut || event.key === 's') {
      const trigger = document.querySelector<HTMLButtonElement>(
        homeMenuShortcut ? '[data-home-menu-trigger="true"]' : '[data-home-sync-trigger="true"]'
      );
      if (!trigger) return;
      event.preventDefault();
      trigger.click();
    } else if (event.key === 'b') {
      event.preventDefault();
      handleOpenBacklog();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
