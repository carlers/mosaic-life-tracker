/** Account-scoped preference, with an early local cache for the first paint. */
export const REDUCE_ANIMATIONS_SETTING_KEY = 'reduceAnimations';
const KEY_PREFIX = 'mosaic_reduce_animations_';

export function readCachedReduceAnimations(
  userId: string,
  storage: Pick<Storage, 'getItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
): boolean {
  if (!userId || !storage) return false;
  try { return storage.getItem(KEY_PREFIX + userId) === 'true'; }
  catch { return false; }
}

export function cacheReduceAnimations(
  userId: string,
  enabled: boolean,
  storage: Pick<Storage, 'setItem'> | null =
    typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!userId || !storage) return;
  try { storage.setItem(KEY_PREFIX + userId, String(enabled)); }
  catch { /* Sync remains authoritative without local storage. */ }
}

export function systemRequestsReducedMotion(
  view: Pick<Window, 'matchMedia'> | undefined =
    typeof window !== 'undefined' ? window : undefined
): boolean {
  return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function applyReducedMotionPreference(
  enabled: boolean,
  root: HTMLElement | undefined =
    typeof document !== 'undefined' ? document.documentElement : undefined
): void {
  if (root) root.dataset.reduceMotion = enabled ? 'true' : 'false';
}
