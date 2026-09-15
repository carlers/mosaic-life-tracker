import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDatabase } from './db/database';
import { initializeSync } from './db/sync';
import { AuthProvider } from './hooks/AuthProvider';

async function bootstrap() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[Bootstrap] Storage persisted: ${isPersisted}`);
  }
  try {
    console.log('[Bootstrap] Initializing database...');
    await initializeDatabase();
    console.log('[Bootstrap] ✅ Database initialized successfully.');
    initializeSync().catch((err) =>
      console.error('[Bootstrap] Initial sync failed:', err)
    );
  } catch (error) {
    console.error('[Bootstrap] FATAL: Database initialization failed', error);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}
bootstrap();