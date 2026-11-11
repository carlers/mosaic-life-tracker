import React, { useEffect, useState } from 'react';
import { GestureShortcutsContext, type GestureShortcutsContextValue } from './gestureShortcutsContext';

// Keep account settings and feature-flag subscriptions out of the initial
// Home static closure. Content mounts immediately; the optional controller
// loads after the first painted frame without replacing the context boundary.
const LazyController = React.lazy(async () => ({
  default: (await import('./GestureShortcutsController')).GestureShortcutsController,
}));

const NO_SHORTCUTS: GestureShortcutsContextValue = {
  actionFor: () => null,
  dispatch: () => {},
};

export const GestureShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<GestureShortcutsContextValue>(NO_SHORTCUTS);
  const [controllerReady, setControllerReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setControllerReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <GestureShortcutsContext.Provider value={value}>
      {children}
      {controllerReady && <React.Suspense fallback={null}>
        <LazyController onValueChange={setValue} />
      </React.Suspense>}
    </GestureShortcutsContext.Provider>
  );
};
