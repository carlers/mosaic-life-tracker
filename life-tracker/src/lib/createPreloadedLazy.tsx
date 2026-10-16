import React from 'react';

/**
 * Preloading an import does not initialize React.lazy. Keep the resolved
 * component so the first render after warmup does not suspend. Only the
 * module is warmed; hooks and sheet instances mount on user interaction.
 */
export function createPreloadedLazy<P extends object>(
  importComponent: () => Promise<React.ComponentType<P>>
) {
  let ready: React.ComponentType<P> | null = null;
  let pending: Promise<React.ComponentType<P>> | null = null;

  function preload(): Promise<React.ComponentType<P>> {
    return (pending ??= importComponent().then(
      (Loaded) => (ready = Loaded),
      (error: unknown) => {
        // Clear a rejected import; a subsequent mount creates a fresh lazy
        // type and can retry instead of reusing React.lazy's cached failure.
        pending = null;
        throw error;
      }
    ));
  }

  const Component: React.FC<P> = (props) => {
    // One cold lazy type per mount: never swap the rendered component when an
    // import resolves, and let a later mount retry a previously failed load.
    const [Selected] = React.useState(() =>
      ready ?? React.lazy(() => preload().then((Loaded) => ({ default: Loaded })))
    );
    return (
      <React.Suspense>
        <Selected {...props} />
      </React.Suspense>
    );
  };

  return { Component, preload };
}
