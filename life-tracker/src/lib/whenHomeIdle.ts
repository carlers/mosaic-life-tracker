/** Run noncritical Home warmup on browser idle, with a cancellable fallback. */
export function whenHomeIdle(work: () => void, timeout: number, fallback: number): () => void {
  const id = window.requestIdleCallback?.(work, { timeout });
  if (id !== undefined) return () => window.cancelIdleCallback?.(id);
  const timer = window.setTimeout(work, fallback);
  return () => window.clearTimeout(timer);
}
