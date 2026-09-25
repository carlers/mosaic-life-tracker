import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Minimal focus trap for modal containers.
 *
 * On mount: captures the currently-focused element, then focuses the
 * first focusable descendant of `containerRef`. Tab / Shift+Tab wrap
 * within the container. On unmount: restores focus to the captured
 * element.
 *
 * Deliberately not a dependency. One call site (BottomSheet) does not
 * justify `focus-trap-react`'s weight, and the trap's contract is small
 * enough to state in 40 lines. Not exported for reuse outside modals —
 * if a second call site appears, lift it then.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean
): void {
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = (): HTMLElement[] => {
      const nodes = container.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      // Filter out elements that are not actually reachable — the sheet
      // can contain a `pointer-events-none`/`opacity-50` locked region
      // (TaskActionSheet's nested choreography) whose children should
      // not receive focus.
      return Array.from(nodes).filter((el) => {
        if (el.hasAttribute('disabled')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return el.offsetParent !== null || el === document.activeElement;
      });
    };

    // Keep the initial focus scan out of the synchronous open/update path.
    // querySelectorAll + visibility checks can force style/layout on the full
    // sheet subtree, which is especially expensive for large day views.
    // Framer Motion's enter animation has also started by the next frame.
    let focusTrapRaf: number | null = null;
    focusTrapRaf = requestAnimationFrame(() => {
      const focusables = getFocusable();
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      }
      focusTrapRaf = null;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (focusTrapRaf !== null) {
        cancelAnimationFrame(focusTrapRaf);
        focusTrapRaf = null;
      }
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [containerRef, isActive]);
}
