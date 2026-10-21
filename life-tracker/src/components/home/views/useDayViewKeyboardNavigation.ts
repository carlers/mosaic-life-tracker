import React from 'react';

type BrowseKind = 'category' | 'task';
type BrowseTarget = HTMLButtonElement & { dataset: DOMStringMap };

const BROWSE_SELECTOR = 'button[data-day-keyboard-target][data-day-keyboard-id]';

/** Task-title Enter/Space belong to editing and completion, never drag pickup. */
export function isTaskTitleKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-day-keyboard-target="task"]'));
}

function browseTargets(root: HTMLElement): BrowseTarget[] {
  return Array.from(root.querySelectorAll<BrowseTarget>(BROWSE_SELECTOR)).filter(button =>
    !button.disabled && !button.closest('[hidden], [inert], [aria-hidden="true"]')
  );
}

type Anchor = { kind: BrowseKind; id: string; index: number };

export function useDayViewKeyboardNavigation(
  enabled: boolean,
  onShowHelp?: () => void,
  allowAdd = true,
  singleKeyShortcutsEnabled = true
) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<Anchor | null>(null);
  const keyboardUsedRef = React.useRef(false);

  const onFocusCapture = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const root = event.currentTarget;
    const target = event.target.closest<BrowseTarget>(BROWSE_SELECTOR);
    if (!target || !root.contains(target)) return;
    const index = browseTargets(root).indexOf(target);
    if (index < 0) return;
    anchorRef.current = {
      kind: target.dataset.dayKeyboardTarget as BrowseKind,
      id: target.dataset.dayKeyboardId!,
      index,
    };
  }, []);

  const onBlurCapture = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
      keyboardUsedRef.current = false;
    }
  }, []);

  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || event.defaultPrevented || event.nativeEvent.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    const root = rootRef.current;
    if (!root || root.closest('[inert], [aria-hidden="true"]')) return;
    const source = event.target instanceof Element
      ? event.target.closest<BrowseTarget>(BROWSE_SELECTOR) : null;
    // Never capture an input, menu, or another control nested beneath a browse target.
    if (!source || event.target !== source || !root.contains(source)) return;
    const buttons = browseTargets(root);
    const index = buttons.indexOf(source);
    if (index < 0) return;
    // '?' is Shift+/ on most keyboards. It is intentionally the only
    // shifted browse shortcut, and only when this workspace owns focus.
    if (singleKeyShortcutsEnabled && event.key === '?' && onShowHelp) {
      event.preventDefault();
      event.stopPropagation();
      onShowHelp();
      return;
    }
    if (event.shiftKey) return;
    // Reuse the category's existing add-task pathway. N from a task targets
    // the closest preceding category in *rendered* order, never another day.
    if (singleKeyShortcutsEnabled && event.key.toLowerCase() === 'n' && allowAdd) {
      const category = buttons.slice(0, index + 1).reverse().find(button =>
        button.dataset.dayKeyboardTarget === 'category');
      if (!category) return;
      event.preventDefault();
      event.stopPropagation();
      category.click();
      return;
    }
    let destination: number;
    switch (event.key) {
      case 'ArrowDown': destination = Math.min(index + 1, buttons.length - 1); break;
      case 'ArrowUp': destination = Math.max(index - 1, 0); break;
      case 'Home': destination = 0; break;
      case 'End': destination = buttons.length - 1; break;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
    keyboardUsedRef.current = true;
    const target = buttons[destination];
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
  }, [enabled, onShowHelp, allowAdd, singleKeyShortcutsEnabled]);

  React.useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      if (!keyboardUsedRef.current || !anchorRef.current ||
          document.activeElement !== document.body ||
          root.closest('[inert], [aria-hidden="true"]')) return;
      const buttons = browseTargets(root);
      if (!buttons.length) {
        keyboardUsedRef.current = false;
        root.focus({ preventScroll: true });
        return;
      }
      const { id, kind, index } = anchorRef.current;
      const same = buttons.find(button =>
        button.dataset.dayKeyboardTarget === kind && button.dataset.dayKeyboardId === id);
      const target = same ?? buttons[Math.min(index, buttons.length - 1)];
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  return { rootRef, onFocusCapture, onBlurCapture, onKeyDown };
}
