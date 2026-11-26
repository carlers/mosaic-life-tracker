/** Idle work must remain cancellable and never block the first Home paint. */
export function scheduleHomeIdle(
  work: () => void, timeout: number, fallback: number,
): () => void {
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, fallback);
  return () => window.clearTimeout(id);
}
