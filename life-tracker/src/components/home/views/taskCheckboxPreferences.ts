import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

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
const EDIT_TAP_DRIFT_PX = 14;

function restoreProtectedEditorFocus(input: HTMLInputElement, button: HTMLButtonElement) {
  if (!input.isConnected || document.activeElement === input) return;
  const active = document.activeElement;
  // Never steal focus from a new field explicitly selected by the user.
  if (active === document.body || active === button || active === null) {
    input.focus({ preventScroll: true });
  }
}

export function shouldRetainTitleEditorOnBlur(input: HTMLInputElement): boolean {
  if (!protectedEditors.has(input)) return false;
  queueMicrotask(() => {
    if (protectedEditors.has(input) && input.isConnected &&
        (document.activeElement === document.body || document.activeElement === null)) {
      input.focus({ preventScroll: true });
    }
  });
  return true;
}

interface ArmedEditCheckboxTap {
  generation: number;
  pointerId: number;
  x: number;
  y: number;
  input: HTMLInputElement;
  button: HTMLButtonElement;
}

export function useFocusedEditCheckboxTap(
  rowKey: string,
  onActivate: () => void | Promise<unknown>,
) {
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;
  const armedRef = useRef<ArmedEditCheckboxTap | null>(null);
  const protectedInputRef = useRef<HTMLInputElement | null>(null);
  const skipPointerClickRef = useRef(false);
  const generationRef = useRef(0);
  const cleanupTimerRef = useRef<number | null>(null);

  const release = () => {
    generationRef.current += 1;
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    if (protectedInputRef.current) protectedEditors.delete(protectedInputRef.current);
    protectedInputRef.current = null;
    armedRef.current = null;
  };

  useEffect(() => () => {
    // A gesture may be interrupted by row removal or navigation.
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    if (protectedInputRef.current) protectedEditors.delete(protectedInputRef.current);
  }, []);

  const cancel = () => {
    const armed = armedRef.current;
    if (armed) {
      skipPointerClickRef.current = true;
      restoreProtectedEditorFocus(armed.input, armed.button);
    }
    release();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): boolean => {
    skipPointerClickRef.current = false;
    release();
    const focused = getFocusedTaskCheckboxPreferences();
    if (!focused?.rowKey || focused.rowKey === rowKey ||
        !focused.allowCheckboxes || !focused.keepInputFocused ||
        event.button !== 0 || event.isPrimary === false) return false;
    const button = event.currentTarget;
    const input = focused.input;
    protectedEditors.add(input);
    protectedInputRef.current = input;
    armedRef.current = {
      generation: generationRef.current,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      input,
      button,
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
    skipPointerClickRef.current = true;
    // The pointerup is delivered even when mobile suppresses the later click.
    // An ordinary click, if also delivered, is consumed below to avoid two toggles.
    const result = activateRef.current();
    restoreProtectedEditorFocus(armed.input, armed.button);
    const finish = () => {
      if (generationRef.current !== armed.generation ||
          protectedInputRef.current !== armed.input) return;
      restoreProtectedEditorFocus(armed.input, armed.button);
      // Let browser-generated click/default focus handling finish before release.
      cleanupTimerRef.current = window.setTimeout(() => {
        if (generationRef.current === armed.generation &&
            protectedInputRef.current === armed.input) {
          restoreProtectedEditorFocus(armed.input, armed.button);
          release();
        }
      }, 0);
    };
    if (result && typeof result.then === 'function') {
      void Promise.resolve(result).then(finish, finish);
    } else finish();
  };

  const consumeClick = (event: ReactMouseEvent<HTMLButtonElement>): boolean => {
    if (!skipPointerClickRef.current || event.detail === 0) return false;
    skipPointerClickRef.current = false;
    return true;
  };

  const resetKeyboard = () => {
    skipPointerClickRef.current = false;
    release();
  };

  return { onPointerDown, onPointerMove, onPointerUp, cancel, consumeClick, resetKeyboard };
}
