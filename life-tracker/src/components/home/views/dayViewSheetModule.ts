import React from 'react';
import type { DayViewSheet } from './DayViewSheet';

// Warming the import alone does not initialize React.lazy's first render.
// Cache the actual component so a warmed day-cell tap can mount it directly.
let ready: typeof DayViewSheet | null = null;
let pending: Promise<typeof import('./DayViewSheet')> | null = null;

export function loadDayViewSheet() {
  return pending ??= import('./DayViewSheet')
    .then(module => (ready = module.DayViewSheet, module),
      error => { pending = null; throw error; });
}

// Preserve the old Suspense path for an early click before idle warmup.
// Pin the chosen type for each mount to avoid remounting if preload resolves.
const ColdDayViewSheet = React.lazy(() =>
  loadDayViewSheet().then(({ DayViewSheet }) => ({ default: DayViewSheet }))
);
export function LazyDayViewSheet(props: React.ComponentProps<typeof DayViewSheet>) {
  const [Component] = React.useState(() => ready ?? ColdDayViewSheet);
  return React.createElement(React.Suspense, { fallback: null },
    React.createElement(Component, props));
}
