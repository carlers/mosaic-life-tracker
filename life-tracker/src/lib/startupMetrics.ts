export type StartupMark =
  | 'bootstrap:start'
  | 'react:mounted'
  | 'database:import-start'
  | 'database:module-ready'
  | 'database:create-start'
  | 'database:create-ready'
  | 'database:collections-start'
  | 'database:collections-ready'
  | 'database:ready'
  | 'auth:resolved'
  | 'app-shell:import-start'
  | 'app-shell:module-ready'
  | 'app-shell:database-fallback-visible'
  | 'app-shell:module-fallback-visible'
  | 'app-data-shell:mounted'
  | 'home:mounted'
  | 'home:tasks-ready'
  | 'home:categories-ready'
  | 'home:settings-ready'
  | 'home:friends-ready'
  | 'home:owner-data-ready'
  | 'home:carousel-ready'
  | 'home:local-data-ready'
  | 'home:neighbor-preload-start'
  | 'home:neighbor-module-ready';

const marked = new Set<StartupMark>();
const subscriptions = new Map<StartupMark, Set<() => void>>();

/**
 * One-shot local readiness signal for deferring noncritical imports until
 * Home's own data is usable. A late subscriber is notified immediately.
 */
export function subscribeStartupMark(mark: StartupMark, callback: () => void): () => void {
  if (marked.has(mark)) {
    callback();
    return () => {};
  }
  let listeners = subscriptions.get(mark);
  if (!listeners) {
    listeners = new Set();
    subscriptions.set(mark, listeners);
  }
  listeners.add(callback);
  return () => {
    listeners?.delete(callback);
    if (listeners?.size === 0) subscriptions.delete(mark);
  };
}


export function markStartup(mark: StartupMark): void {
  if (marked.has(mark)) return;
  marked.add(mark);
  try {
    performance?.mark?.(`mosaic:${mark}`);
  } catch {
    // Diagnostics must never affect startup.
  }
  const listeners = subscriptions.get(mark);
  subscriptions.delete(mark);
  for (const callback of listeners ?? []) {
    try {
      callback();
    } catch {
      // A noncritical preload subscriber must never disrupt startup.
    }
  }
}
