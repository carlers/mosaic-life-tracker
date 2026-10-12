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
    if (ready) return Promise.resolve(ready);
    if (pending) return pending;
    pending = importComponent().then(
      (Component) => {
        ready = Component;
        return Component;
      },
      (error: unknown) => {
        // React.lazy caches rejected loads. A later *new mount* needs a new
        // lazy type so a user can retry after a transient chunk failure.
        pending = null;
        Cold = createCold();
        throw error;
      }
    );
    return pending;
  }

  const createCold = () =>
    React.lazy(() => preload().then((Component) => ({ default: Component })));
  let Cold = createCold();

  const Component: React.FC<P> = (props) => {
    // Pin identity for this mount: completion of an in-flight import must not
    // swap types and destroy an already mounting sheet or its local state.
    const [Selected] = React.useState(() => ready ?? Cold);
    return (
      <React.Suspense fallback={null}>
        <Selected {...props} />
      </React.Suspense>
    );
  };

  return { Component, preload };
}
