export type DatabaseBootstrapState = 'idle' | 'loading' | 'ready' | 'error';

export interface DatabaseBootstrapSnapshot {
  state: DatabaseBootstrapState;
  error: string | null;
}

let snapshot: DatabaseBootstrapSnapshot = { state: 'idle', error: null };
let bootstrapPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: DatabaseBootstrapSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getDatabaseBootstrapSnapshot(): DatabaseBootstrapSnapshot {
  return snapshot;
}

export function subscribeToDatabaseBootstrap(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startDatabaseBootstrap(): Promise<void> {
  if (snapshot.state === 'ready') return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  publish({ state: 'loading', error: null });
  bootstrapPromise = import('../db/database')
    .then(({ initializeDatabaseWithRetry }) => initializeDatabaseWithRetry())
    .then(() => {
      publish({ state: 'ready', error: null });
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'The local database could not be opened.';
      publish({ state: 'error', error: message });
      throw error;
    })
    .finally(() => {
      if (snapshot.state !== 'loading') bootstrapPromise = null;
    });

  return bootstrapPromise;
}

export function waitForDatabaseReady(): Promise<void> {
  return startDatabaseBootstrap();
}

export function retryDatabaseBootstrap(): Promise<void> {
  if (snapshot.state === 'loading' && bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = null;
  publish({ state: 'idle', error: null });
  return startDatabaseBootstrap();
}

export function resetDatabaseBootstrapForTests(): void {
  bootstrapPromise = null;
  snapshot = { state: 'idle', error: null };
  listeners.clear();
}
