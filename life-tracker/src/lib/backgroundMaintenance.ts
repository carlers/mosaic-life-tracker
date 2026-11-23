import { prefetchPwaUpdate } from './pwaLifecycle';
import { initializePostHog } from './posthog';

// Noncritical work deliberately stays outside the synchronous entry chunk.
// App startup, service-worker registration and auth/error reporting remain eager.
// Prepare full updates while the user is in-app so Settings can show a
// verified waiting worker immediately. Keep first paint and initial work first.
const PWA_UPDATE_INITIAL_DELAY_MS = 3_000;
const PWA_UPDATE_RECHECK_MS = 60 * 60 * 1000;
const PWA_UPDATE_RETRY_MS = 30_000;
let nextPwaUpdateCheckAt = Date.now() + PWA_UPDATE_INITIAL_DELAY_MS;
let pwaUpdateCheckInFlight = false;
let pwaUpdateTimer: number | null = null;

const schedulePwaUpdateCheck = (delayMs: number) => {
  if (pwaUpdateTimer !== null) clearTimeout(pwaUpdateTimer);
  pwaUpdateTimer = window.setTimeout(() => {
    pwaUpdateTimer = null;
    maybePrefetchPwaUpdate();
  }, Math.max(0, delayMs));
};

const maybePrefetchPwaUpdate = () => {
  if (pwaUpdateCheckInFlight || navigator.onLine === false ||
      document.visibilityState === 'hidden') return;
  const now = Date.now();
  if (now < nextPwaUpdateCheckAt) {
    schedulePwaUpdateCheck(nextPwaUpdateCheckAt - now);
    return;
  }
  pwaUpdateCheckInFlight = true;
  void prefetchPwaUpdate().then((result) => {
    nextPwaUpdateCheckAt = Date.now() +
      (result === 'unavailable' ? PWA_UPDATE_RETRY_MS : PWA_UPDATE_RECHECK_MS);
  }).catch((error) => {
    nextPwaUpdateCheckAt = Date.now() + PWA_UPDATE_RETRY_MS;
    console.warn('PWA update:', error);
  }).finally(() => {
    pwaUpdateCheckInFlight = false;
    if (navigator.onLine !== false && document.visibilityState !== 'hidden') {
      schedulePwaUpdateCheck(nextPwaUpdateCheckAt - Date.now());
    }
  });
};

export const startBackgroundMaintenance = () => {
  void initializePostHog();
  // Orientation locking is best-effort and already starts after first paint.
  // Keep the orientation-only module out of the critical startup bundle.
  void import('./orientation')
    .then(({ configureResponsiveOrientation }) => configureResponsiveOrientation())
    .catch(error => console.warn('Orientation:', error));

  if (navigator.storage?.persist) {
    // Best-effort persistence runs after paint; failure remains reported.
    void navigator.storage.persist().catch(error =>
      console.warn('Storage persist:', error));
  }

  void import('./imageCache')
    .then(({ enforceImageCacheBudget }) => enforceImageCacheBudget())
    .catch((error) =>
      console.warn('Image cache:', error)
    );

  // Opportunistic, idle-aware update discovery. Native SW registration still
  // owns its own browser-triggered update checks.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(maybePrefetchPwaUpdate, { timeout: 4_000 });
  } else {
    schedulePwaUpdateCheck(PWA_UPDATE_INITIAL_DELAY_MS);
  }
  window.addEventListener('online', maybePrefetchPwaUpdate);
  document.addEventListener('visibilitychange', maybePrefetchPwaUpdate);
};

