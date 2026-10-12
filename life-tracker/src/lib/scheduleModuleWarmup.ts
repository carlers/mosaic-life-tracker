/** Queue a cancellable code-only preload after the owning view is usable. */
export function scheduleModuleWarmup(preload: () => Promise<unknown>, delayMs = 600) {
  let canceled = false;
  let idleId: number | undefined;
  const warm = () => {
    if (!canceled && document.visibilityState === 'visible') {
      void preload().catch(() => {});
    }
  };
  const timer = window.setTimeout(() => {
    if (window.requestIdleCallback) {
      idleId = window.requestIdleCallback(warm, { timeout: 1000 });
    } else {
      warm();
    }
  }, delayMs);
  return () => {
    canceled = true;
    window.clearTimeout(timer);
    if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
  };
}
