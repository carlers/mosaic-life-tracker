import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/home/views/DayViewSheet', () => ({
  DayViewSheet: () => null,
}));

import { loadDayViewSheet } from '../../src/components/home/views/dayViewSheetModule';

describe('Day View module warmup', () => {
  it('reuses the same in-flight module load for idle warmup and on-demand opening', async () => {
    const first = loadDayViewSheet();
    expect(loadDayViewSheet()).toBe(first);
    await expect(first).resolves.toHaveProperty('DayViewSheet', expect.any(Function));
  });
});
