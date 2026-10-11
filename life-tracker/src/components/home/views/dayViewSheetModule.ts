import { lazy } from 'react';

// Share one pending import between idle warmup and every owner Day View entry point.
// No sheet, hooks, or data subscriptions mount until a user actually opens it.
let dayViewSheetPromise: Promise<typeof import('./DayViewSheet')> | null = null;

export function loadDayViewSheet(): Promise<typeof import('./DayViewSheet')> {
  dayViewSheetPromise ??= import('./DayViewSheet').catch((error) => {
    dayViewSheetPromise = null;
    throw error;
  });
  return dayViewSheetPromise;
}

export const LazyDayViewSheet = lazy(() =>
  loadDayViewSheet().then(({ DayViewSheet }) => ({ default: DayViewSheet }))
);
