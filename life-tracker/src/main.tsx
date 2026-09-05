import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDatabase } from './db/database';
import { initializeSync } from './db/sync';

async function bootstrap() {
  // 1. Request persistent storage (prevents iOS/WebKit from purging IndexedDB)
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[Bootstrap] Storage persisted: ${isPersisted}`);
  }

  // 2. Initialize RxDB BEFORE React mounts
  try {
    console.log('[Bootstrap] Initializing database...');
    await initializeDatabase();
    console.log('[Bootstrap] ✅ Database initialized successfully.');
    
    // 3. Start background sync 
    // We don't 'await' this so it doesn't block the UI from rendering immediately
    initializeSync().catch(err => console.error('[Bootstrap] Initial sync failed:', err));
  } catch (error) {
    console.error('[Bootstrap] FATAL: Database initialization failed', error);
  }

  // 4. Render React App
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Kick off the application
bootstrap();