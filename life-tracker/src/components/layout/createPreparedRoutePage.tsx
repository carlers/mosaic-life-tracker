import React from 'react';

/**
 * Imported JavaScript does not prime a separate React.lazy wrapper. A warm
 * first mount uses the resolved page directly (shared by actual and preview
 * routes); a genuinely cold mount still suspends to its parent's fallback.
 */
export function createPreparedRoutePage<P extends object>(
  importComponent: () => Promise<React.ComponentType<P>>
) {
  let ready: React.ComponentType<P> | null = null;
  let pending: Promise<React.ComponentType<P>> | null = null;

  const preload = (): Promise<React.ComponentType<P>> => {
    if (!pending) {
      pending = importComponent().then(
        (Page) => {
          ready = Page;
          return Page;
        },
        (error: unknown) => {
          pending = null;
          throw error;
        }
      );
    }
    return pending;
  };

  const Component: React.FC<P> = (props) => {
    // Once mounted, do not replace its component identity on load completion.
    // A subsequent mount can retry if a previous import failed.
    const [Selected] = React.useState<React.ComponentType<P>>(
      () => ready ?? React.lazy(() =>
        preload().then((Page) => ({ default: Page }))
      )
    );
    return <Selected {...props} />;
  };

  return { Component, preload };
}
