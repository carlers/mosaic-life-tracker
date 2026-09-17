/**
 * Canonical render-body prop-reset pattern (§9). Tracks the last value
 * of `propValue`; when it changes, calls `onChange()` during render
 * (React's supported "adjust state during render" escape hatch) and
 * updates the tracked value. Returns nothing — the caller stores its
 * draft state alongside and reads it with `draft ?? prop`.
 *
 * Replaces the copy-pasted block:
 *
 *   const [syncedId, setSyncedId] = useState<string | null>(null);
 *   if (taskId !== syncedId) {
 *     setSyncedId(taskId);
 *     setEditedValue(null);
 *   }
 *
 * `onChange` must be idempotent: React may invoke the render phase
 * twice under StrictMode. It should only call `setState` with stable
 * values.
 */
import { useState } from 'react';

export function usePropSync<T>(propValue: T, onChange: () => void): void {
  const [tracked, setTracked] = useState<T>(propValue);
  if (tracked !== propValue) {
    setTracked(propValue);
    onChange();
  }
}
