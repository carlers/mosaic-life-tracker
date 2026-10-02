import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './hooks/AuthProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installChunkLoadErrorTracking } from './lib/chunkLoadErrors';
import {
  initializePwaLifecycle,
  prefetchPwaUpdate,
} from './lib/pwaLifecycle';
import { registerSW } from 'virtual:pwa-register';
import { configureResponsiveOrientation } from './lib/orientation';
import {
  captureHandledException,
  initializePostHog,
} from './lib/posthog';
import { initializeAppearance } from './lib/appearance';
import { initializeScreenLayout } from './lib/screenLayout';
import { startDatabaseBootstrap } from './lib/databaseBootstrap';
import { markStartup } from './lib/startupMetrics';
import { initializeConnectivity } from './lib/connectivity';
import { preloadHomePage } from './lib/homePreload';

markStartup('bootstrap:start');
initializeConnectivity(window);
initializeAppearance();
initializeScreenLayout();
installChunkLoadErrorTracking();
// Keep the install/update listeners registered before the browser can emit
// lifecycle events, but leave all unrelated background work until after paint.
initializePwaLifecycle(window, registerSW);

const beginDatabaseBootstrap = () => {
  void startDatabaseBootstrap()
    .then(() => markStartup('database:ready'))
    .catch((error) => {
      console.error('[Bootstrap] Database initialization failed', error);
      captureHandledException(error, { source: 'database-bootstrap' });
    });
};

// Read the local auth hint before React mounts so an authenticated reload can
// start its two expensive independent imports in the same bootstrap task. The
// imports remain asynchronous; logged-out Login still gets first paint first.
const hasCachedIdentity = (() => {
  try {
    return Boolean(localStorage.getItem('mosaic_last_known_user'));
  } catch {
    return false;
  }
})();

if (hasCachedIdentity) {
  beginDatabaseBootstrap();
  void preloadHomePage().catch((error) => {
    console.warn('[Bootstrap] Home preload failed:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="auth">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

window.requestAnimationFrame(() => {
  markStartup('react:mounted');
});

if (!hasCachedIdentity) {
  if (window.location.pathname === '/login') {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(beginDatabaseBootstrap, { timeout: 1200 });
    } else {
      window.setTimeout(beginDatabaseBootstrap, 400);
    }
  } else {
    beginDatabaseBootstrap();
  }
}

const PWA_UPDATE_PREFETCH_DELAY_MS = 65_000;
const PWA_UPDATE_RECHECK_MS = 60 * 60 * 1000;
const pwaUpdatePrefetchEligibleAt =
  Date.now() + PWA_UPDATE_PREFETCH_DELAY_MS;
let lastPwaUpdatePrefetchAt = 0;

const maybePrefetchPwaUpdate = () => {
  const now = Date.now();
  if (
    now < pwaUpdatePrefetchEligibleAt ||
    now - lastPwaUpdatePrefetchAt < PWA_UPDATE_RECHECK_MS ||
    navigator.onLine === false ||
    document.visibilityState === 'hidden'
  ) {
    return;
  }

  lastPwaUpdatePrefetchAt = now;
  void prefetchPwaUpdate().catch((error) => {
    console.warn('[PWA] Background update check failed:', error);
  });
};

const startBackgroundMaintenance = () => {
  void initializePostHog();
  void configureResponsiveOrientation();

  if (navigator.storage?.persist) {
    void navigator.storage
      .persist()
      .then((isPersisted) => {
        if (import.meta.env.DEV) {
          console.log(`[Bootstrap] Storage persisted: ${isPersisted}`);
        }
      })
      .catch((error) => {
        console.warn('[Bootstrap] Storage persistence request failed', error);
      });
  }

  void import('./lib/imageCache')
    .then(({ enforceImageCacheBudget }) => enforceImageCacheBudget())
    .catch((error) =>
      console.warn('[Bootstrap] Image-cache sweep failed:', error)
    );

  // Let first-use Home/auth/database work win. Once the app has been settled
  // for more than a minute, quietly download future app-shell updates so the
  // Settings action usually only needs to activate an already-waiting worker.
  window.setTimeout(() => {
    maybePrefetchPwaUpdate();
    window.setInterval(maybePrefetchPwaUpdate, PWA_UPDATE_RECHECK_MS);
  }, PWA_UPDATE_PREFETCH_DELAY_MS);
  window.addEventListener('online', maybePrefetchPwaUpdate);
  document.addEventListener('visibilitychange', maybePrefetchPwaUpdate);
};

// Maintenance stays behind the first paint. Sync is intentionally absent here:
// AuthProvider owns identity and starts sync only after auth + DB readiness.
window.requestAnimationFrame(() => {
  window.setTimeout(startBackgroundMaintenance, 0);
});
