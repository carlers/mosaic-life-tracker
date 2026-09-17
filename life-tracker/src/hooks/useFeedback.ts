import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_MS = 2000;

/**
 * Shared feedback-toast state. Returns the current message (or null),
 * a `show(msg)` setter, and a `clear()`. `show` auto-clears after
 * `durationMs` (default 2000ms, matching the existing `[useX] feedback`
 * pattern). A second `show` replaces the message and restarts the
 * timer.
 *
 * The timer is held in a ref so repeated calls do not stack timeouts;
 * unmount clears any pending timer.
 */
export function useFeedback(durationMs: number = DEFAULT_DURATION_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback(
    (msg: string) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setMessage(null);
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { message, show, clear };
}
