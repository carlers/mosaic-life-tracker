import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './hooks/AuthProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installChunkLoadErrorTracking } from './lib/chunkLoadErrors';
import { initializePwaLifecycle } from './lib/pwaLifecycle';
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

// A previously-hydrated account is likely to redirect straight from /login
// to Home, so overlap DB opening immediately. A genuinely logged-out Login
// gets first paint before RxDB work begins.
let hasCachedIdentity = false;
try {
  hasCachedIdentity = Boolean(localStorage.getItem('mosaic_last_known_user'));
} catch {
  hasCachedIdentity = false;
}

if (window.location.pathname === '/login' && !hasCachedIdentity) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(beginDatabaseBootstrap, { timeout: 1200 });
  } else {
    window.setTimeout(beginDatabaseBootstrap, 400);
  }
} else {
  beginDatabaseBootstrap();
}

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
};

// Maintenance stays behind the first paint. Sync is intentionally absent here:
// AuthProvider owns identity and starts sync only after auth + DB readiness.
window.requestAnimationFrame(() => {
  window.setTimeout(startBackgroundMaintenance, 0);
});
