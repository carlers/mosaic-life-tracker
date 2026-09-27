export type StartupMark =
  | 'bootstrap:start'
  | 'react:mounted'
  | 'database:ready'
  | 'auth:resolved'
  | 'home:mounted'
  | 'home:local-data-ready';

export function markStartup(mark: StartupMark): void {
  try {
    performance?.mark?.(`mosaic:${mark}`);
  } catch {
    // Diagnostics must never affect startup.
  }
}
