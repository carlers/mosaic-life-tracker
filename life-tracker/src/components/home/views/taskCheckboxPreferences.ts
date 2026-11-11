import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface FocusedTaskCheckboxPreferences {
  input: HTMLInputElement;
  rowKey: string | null;
  allowCheckboxes: boolean;
  keepInputFocused: boolean;
}

/** Read the account preferences from the active Day View creation or title-edit input. */
export function getFocusedTaskCheckboxPreferences(): FocusedTaskCheckboxPreferences | null {
  const activeInput = document.activeElement;
  if (!(activeInput instanceof HTMLInputElement) ||
      !activeInput.matches('input[data-task-inline-input]')) {
    return null;
  }
  const scope = activeInput.closest<HTMLElement>('[data-task-checkbox-preferences-scope="true"]');
  return {
    input: activeInput,
    rowKey: activeInput.dataset.taskInlineRowKey || null,
    allowCheckboxes: scope?.dataset.allowTaskCheckboxesWhileAdding !== 'false',
    keepInputFocused: scope?.dataset.keepTaskInputFocusedOnCheckbox !== 'false',
  };
}

/**
 * Mobile browsers can blur an existing title editor or omit the synthesized click
 * during a checkbox touch. Only the editing + allow-other + keep-focus combination
 * needs a pointerup fallback; creation and every other preference matrix entry
 * must retain their existing click/blur semantics.
 */
const protectedEditors = new WeakSet<HTMLInputElement>();
const inputCheckboxIntent = new WeakMap<HTMLInputElement, number>();
const EDIT_TAP_DRIFT_PX = 14;

/** Each later checkbox pointerdown supersedes an earlier deferred blur/focus action. */
export function markTaskCheckboxIntent(input: HTMLInputElement | undefined): number {
  if (!input) return 0;
  const revision = (inputCheckboxIntent.get(input) ?? 0) + 1;
  inputCheckboxIntent.set(input, revision);
  return revision;
}

export function isCurrentTaskCheckboxIntent(input: HTMLInputElement, revision: number): boolean {
  return inputCheckboxIntent.get(input) === revision;
}

export interface DeferredTaskCheckboxBlur {
  input: HTMLInputElement;
  revision: number;
}

export function blurTaskInputAfterCompletion(request: DeferredTaskCheckboxBlur | null) {
  if (!request || !isCurrentTaskCheckboxIntent(request.input, request.revision)) return;
  if (request.input.isConnected && document.activeElement === request.input) request.input.blur();
}

function isAnotherEditableFocused(input: HTMLInputElement): boolean {
  const active = document.activeElement;
  return active !== input && (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}

function restoreProtectedEditorFocus(input: HTMLInputElement) {
  if (!input.isConnected || document.activeElement === input ||
      isAnotherEditableFocused(input)) return;
  // A mobile focus trap may move focus to a sheet/header control, not just to
  // the checkbox or body. This gesture explicitly requested editor retention.
  input.focus({ preventScroll: true });
}

export function shouldRetainTitleEditorOnBlur(input: HTMLInputElement): boolean {
  if (!protectedEditors.has(input) || isAnotherEditableFocused(input)) return false;
  queueMicrotask(() => {
    if (protectedEditors.has(input) && input.isConnected &&
        !isAnotherEditableFocused(input)) {
      input.focus({ preventScroll: true });
    }
  });
  return true;
}

interface ArmedEditCheckboxTap {
  pointerId: number;
  x: number;
  y: number;
  input: HTMLInputElement;
  revision: number;
}

export function useFocusedEditCheckboxTap(
  rowKey: string,
  onActivate: () => void | Promise<unknown>,
) {
  const activateRef = useRef(onActivate);
  useEffect(() => { activateRef.current = onActivate; }, [onActivate]);
  const armedRef = useRef<ArmedEditCheckboxTap | null>(null);
  const protectedInputRef = useRef<HTMLInputElement | null>(null);
  const skipPointerClickRef = useRef(false);
  const clickExpiryTimerRef = useRef<number | null>(null);

  const clearClickExpiry = () => {
    if (clickExpiryTimerRef.current !== null) window.clearTimeout(clickExpiryTimerRef.current);
    clickExpiryTimerRef.current = null;
  };
  const suppressFollowupClick = () => {
    clearClickExpiry();
    skipPointerClickRef.current = true;
    // A canceled or dropped synthetic click must not suppress a much later
    // assistive-technology click. Keyboard input also clears this immediately.
    clickExpiryTimerRef.current = window.setTimeout(() => {
      skipPointerClickRef.current = false;
      clickExpiryTimerRef.current = null;
    }, 700);
  };

  const release = () => {
    if (protectedInputRef.current) protectedEditors.delete(protectedInputRef.current);
    protectedInputRef.current = null;
    armedRef.current = null;
  };

  useEffect(() => () => {
    // A gesture may be interrupted by row removal or navigation.
    if (clickExpiryTimerRef.current !== null) window.clearTimeout(clickExpiryTimerRef.current);
    if (protectedInputRef.current) protectedEditors.delete(protectedInputRef.current);
  }, []);

  const cancel = () => {
    const armed = armedRef.current;
    if (!armed) return;
    suppressFollowupClick();
    if (isCurrentTaskCheckboxIntent(armed.input, armed.revision)) {
      restoreProtectedEditorFocus(armed.input);
    }
    release();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): boolean => {
    skipPointerClickRef.current = false;
    clearClickExpiry();
    release();
    const focused = getFocusedTaskCheckboxPreferences();
    if (!focused?.rowKey || focused.rowKey === rowKey ||
        !focused.allowCheckboxes || !focused.keepInputFocused ||
        event.button !== 0 || event.isPrimary === false) return false;
    const input = focused.input;
    protectedEditors.add(input);
    protectedInputRef.current = input;
    armedRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      input,
      revision: inputCheckboxIntent.get(input) ?? 0,
    };
    // Native focus transfer must not save/unmount the other task's editor.
    event.preventDefault();
    return true;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const armed = armedRef.current;
    if (armed && armed.pointerId === event.pointerId &&
        Math.hypot(event.clientX - armed.x, event.clientY - armed.y) > EDIT_TAP_DRIFT_PX) {
      cancel();
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const armed = armedRef.current;
    if (!armed || armed.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - armed.x, event.clientY - armed.y) > EDIT_TAP_DRIFT_PX) {
      cancel();
      return;
    }
    armedRef.current = null;
    suppressFollowupClick();
    // Keep the active editor protected only for the physical pointer gesture.
    // Never retain a blur guard or schedule a focus steal until an asynchronous
    // task write finishes: the user's next tap may intentionally leave this input.
    try {
      const result = activateRef.current();
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).catch(() => {});
      }
    } finally {
      if (isCurrentTaskCheckboxIntent(armed.input, armed.revision)) {
        restoreProtectedEditorFocus(armed.input);
      }
      release();
    }
  };

  const consumeClick = (): boolean => {
    // Touch-synthesized clicks may have detail=0 (confirmed in Chromium). Do
    // not mistake that for keyboard activation: keydown resets this guard.
    if (!skipPointerClickRef.current) return false;
    skipPointerClickRef.current = false;
    clearClickExpiry();
    return true;
  };

  const resetKeyboard = () => {
    skipPointerClickRef.current = false;
    clearClickExpiry();
    release();
  };

  return { onPointerDown, onPointerMove, onPointerUp, cancel, consumeClick, resetKeyboard };
}
