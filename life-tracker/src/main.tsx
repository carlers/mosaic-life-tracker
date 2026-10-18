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
import { initializeAccentColor } from './lib/accentColor';
import { initializeScreenLayout } from './lib/screenLayout';
import { startDatabaseBootstrap } from './lib/databaseBootstrap';
import { markStartup } from './lib/startupMetrics';
import { initializeConnectivity } from './lib/connectivity';
import { preloadHomePage } from './lib/homePreload';
import { loadAppDataShell } from './components/layout/routeModuleLoaders';

markStartup('bootstrap:start');
initializeConnectivity(window);
initializeAppearance();
initializeAccentColor();
initializeScreenLayout();
installChunkLoadErrorTracking();
// Keep the install/update listeners registered before the browser can emit
// lifecycle events, but leave all unrelated background work until after paint.
initializePwaLifecycle(window, registerSW);

// #858 isolated lab ONLY: this never executes on real owner identities
// or in the shipping production build. Test whether one real RxDB all-owner
// query can overlap Home/provider mount after DB readiness.
const prewarmOwnerTasksForLab = () => {
  if (import.meta.env.VITE_MOSAIC_858_SCALING_LAB !== '1') return;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('mosaic_last_known_user') ?? 'null');
    const id = raw && typeof raw === 'object' && '$id' in raw
      ? (raw as { $id?: unknown }).$id : null;
    if (id !== 'issue858_scale_user' ||
        localStorage.getItem('mosaic_858_query_variant') !== 'prewarm') return;
    performance.mark('mosaic:858:prewarm-start');
    void import('./db/database').then(async ({ getDatabase }) => {
      const tasks = await getDatabase().tasks.find({
        selector: { userId: id, isDeleted: false },
        sort: [{ date: 'asc' }, { createdAt: 'desc' }],
      }).exec();
      performance.mark('mosaic:858:prewarm-end');
      if (import.meta.env.DEV) console.debug('[Issue 858] Prewarmed rows:', tasks.length);
    }).catch(error => console.warn('[Issue 858] Lab prewarm failed', error));
  } catch { /* Non-production diagnostic only. */ }
};

const beginDatabaseBootstrap = () => {
  void startDatabaseBootstrap()
    .then(() => {
      markStartup('database:ready');
      prewarmOwnerTasksForLab();
    })
    .catch((error) => {
      console.error('[Bootstrap] Database initialization failed', error);
      captureHandledException(error, { source: 'database-bootstrap' });
    });
};

// Read the local auth hint before React mounts so an authenticated reload can
// start the independent DB, Home and application-shell imports early. The
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
  // Load the app-shell module graph alongside RxDB and Home instead of
  // waiting for the first React effect. Never wait for network or sync.
  void loadAppDataShell().catch((error) => {
    console.warn('[Bootstrap] App shell preload failed:', error);
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
