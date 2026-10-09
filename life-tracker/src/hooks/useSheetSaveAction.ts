import { useCallback, useRef, useState } from 'react';

/**
 * Shared single-flight, error/retry handling for lightweight sheet saves.
 * Ref gating is synchronous, so repeated clicks in one React batch still
 * dispatch exactly one write. A sheet reopening invalidates late completions.
 */
export function useSheetSaveAction() {
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    generation.current += 1;
    inFlight.current = false;
    setIsSaving(false);
    setError(null);
  }, []);

  const save = useCallback(
    async (
      write: () => void | Promise<void>,
      onSuccess: () => void,
      failureMessage = 'Could not save. Try again.'
    ) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const requestGeneration = generation.current;
      setIsSaving(true);
      setError(null);
      try {
        await write();
        if (generation.current === requestGeneration) onSuccess();
      } catch {
        if (generation.current === requestGeneration) {
          setError(failureMessage);
        }
      } finally {
        if (generation.current === requestGeneration) {
          inFlight.current = false;
          setIsSaving(false);
        }
      }
    },
    []
  );

  return { save, reset, isSaving, error };
}
