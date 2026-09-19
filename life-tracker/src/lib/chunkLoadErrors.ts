const preloadErrors = new WeakSet<object>();
let isTracking = false;

function remember(error: unknown): void {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    preloadErrors.add(error);
  }
}

export function installChunkLoadErrorTracking(): void {
  if (isTracking || typeof window === 'undefined') return;
  isTracking = true;
  window.addEventListener('vite:preloadError', (event) => {
    remember((event as Event & { payload?: unknown }).payload);
  });
}

export function isChunkLoadError(error: unknown): boolean {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    if (preloadErrors.has(error)) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /unable to preload css/i.test(message) ||
    message === 'Load failed'
  );
}
