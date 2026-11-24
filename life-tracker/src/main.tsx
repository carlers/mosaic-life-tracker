import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './hooks/AuthProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installChunkLoadErrorTracking } from './lib/chunkLoadErrors';
import { initializePwaLifecycle } from './lib/pwaLifecycle';
import { registerSW } from 'virtual:pwa-register';

import { captureHandledException } from './lib/posthog';
import { initializeAppearance } from './lib/appearance';
import { initializeAccentColor } from './lib/accentColor';
import { initializeUiColors } from './lib/uiColors';
import { initializeScreenLayout } from './lib/screenLayout';
import { startDatabaseBootstrap } from './lib/databaseBootstrap';
import { markStartup } from './lib/startupMetrics';
import { captureEmailVerificationCallbackUrl } from './lib/emailVerificationCallback';
import { initializeConnectivity } from './lib/connectivity';
import { preloadHomePage } from './lib/homePreload';
import { loadAppDataShell } from './components/layout/routeModuleLoaders';

// Strip verification secrets from the URL before telemetry, PWA or idle startup.
captureEmailVerificationCallbackUrl();
markStartup('bootstrap:start');
initializeConnectivity(window);
initializeAppearance();
initializeAccentColor();
initializeUiColors();
initializeScreenLayout();
installChunkLoadErrorTracking();
// Keep the install/update listeners registered before the browser can emit
// lifecycle events, but leave all unrelated background work until after paint.
initializePwaLifecycle(window, registerSW);

const beginDatabaseBootstrap = () => {
  void startDatabaseBootstrap()
    .then(() => markStartup('database:ready'))
    .catch((error) => {
      console.error('DB init:', error);
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
    console.warn('Home preload:', error);
  });
  // Load the app-shell module graph alongside RxDB and Home instead of
  // waiting for the first React effect. Never wait for network or sync.
  void loadAppDataShell().catch((error) => {
    console.warn('Shell preload:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="auth">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
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

// Maintenance stays behind first paint and is fetched on demand. A failed
// optional import must not prevent auth, DB setup or service-worker registration.
window.requestAnimationFrame(() => {
  window.setTimeout(() => {
    void import('./lib/backgroundMaintenance')
      .then(({ startBackgroundMaintenance }) => startBackgroundMaintenance())
      .catch(error => console.warn('Background maintenance:', error));
  }, 0);
});
