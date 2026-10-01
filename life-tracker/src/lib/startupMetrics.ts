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
  | 'app-data-shell:mounted'
  | 'home:mounted'
  | 'home:tasks-ready'
  | 'home:categories-ready'
  | 'home:settings-ready'
  | 'home:friends-ready'
  | 'home:owner-data-ready'
  | 'home:carousel-ready'
  | 'home:local-data-ready';

const marked = new Set<StartupMark>();

export function markStartup(mark: StartupMark): void {
  if (marked.has(mark)) return;
  marked.add(mark);
  try {
    performance?.mark?.(`mosaic:${mark}`);
  } catch {
    // Diagnostics must never affect startup.
  }
}
