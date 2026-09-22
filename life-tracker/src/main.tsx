import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDatabaseWithRetry } from './db/database';
import { initializeSync } from './db/sync';
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

void initializePostHog();
installChunkLoadErrorTracking();
initializePwaLifecycle(window, registerSW);
void configureResponsiveOrientation();

function databaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'The local database could not be opened.';
}

function renderDatabaseFailure(error: unknown) {
  const message = databaseErrorMessage(error);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-lg font-bold mb-2">Local database unavailable</h1>
          <p className="text-sm text-gray-400 mb-4">
            Mosaic could not open its on-device database. Your Appwrite data has not been deleted.
          </p>
          <pre className="text-left text-xs text-red-300 bg-[#1A1A1A] border border-red-900/30 rounded-xl p-3 whitespace-pre-wrap break-words mb-4">
            {message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-emerald-500 text-black font-medium"
          >
            Retry database
          </button>
        </div>
      </div>
    </React.StrictMode>
  );
}

async function bootstrap() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[Bootstrap] Storage persisted: ${isPersisted}`);
      } catch (error) {
        console.warn('[Bootstrap] Storage persistence request failed', error);
      }
    }

    console.log('[Bootstrap] Initializing database...');
    await initializeDatabaseWithRetry();
    console.log('[Bootstrap] ✅ Database initialized successfully.');
  } catch (error) {
    console.error('[Bootstrap] FATAL: Database initialization failed', error);
    captureHandledException(error, { source: 'database-bootstrap' });
    renderDatabaseFailure(error);
    return;
  }

  initializeSync().catch((err) =>
    console.error('[Bootstrap] Initial sync failed:', err)
  );
  import('./lib/imageCache')
    .then(({ enforceImageCacheBudget }) => enforceImageCacheBudget())
    .catch((err) => console.warn('[Bootstrap] Image-cache sweep failed:', err));

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary label="auth">
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
bootstrap();
