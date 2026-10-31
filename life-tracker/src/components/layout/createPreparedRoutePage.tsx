import React from 'react';

/**
 * A fulfilled JS import does not automatically prime an unrelated React.lazy
 * instance. Share one prepared component across the real route and swipe preview.
 * Cold mounts still suspend into their existing route-level fallback.
 */
export function createPreparedRoutePage<P extends object>(
  importComponent: () => Promise<React.ComponentType<P>>
) {
  let ready: React.ComponentType<P> | null = null;
  let pending: Promise<React.ComponentType<P>> | null = null;

  const preload = (): Promise<React.ComponentType<P>> => {
    if (!pending) {
      pending = importComponent().then(
        (Page) => { ready = Page; return Page; },
        (error: unknown) => { pending = null; throw error; }
      );
    }
    return pending;
  };

  const Component: React.FC<P> = (props) => {
    // Freeze component identity for the current mount; failed imports retry
    // on a later mount rather than sharing React.lazy's cached rejection.
    const [Selected] = React.useState<React.ComponentType<P>>(
      () => ready ?? React.lazy(() => preload().then((Page) => ({ default: Page })))
    );
    return <Selected {...props} />;
  };

  return { Component, preload };
}
