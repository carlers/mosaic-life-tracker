import React, { Suspense, act } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: () => <div data-testid="day-view-mounted" />,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

it('mounts the idle-preloaded Day View in the first synchronous commit', async () => {
  const { loadDayViewSheet, LazyDayViewSheet } =
    await import('../../src/components/home/views/dayViewSheetModule');
  await loadDayViewSheet();

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    // React.lazy + an already-resolved import promise still suspends on its
    // very first render; this used to commit Suspense fallback=null instead.
    act(() => {
      flushSync(() => root.render(
        <Suspense fallback={null}>
          <LazyDayViewSheet
            isOpen
            onClose={() => {}}
            selectedDate={new Date(2026, 8, 15)}
          />
        </Suspense>
      ));
    });
    expect(container.querySelector('[data-testid="day-view-mounted"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
