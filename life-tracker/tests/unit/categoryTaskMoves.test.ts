import { describe, expect, it } from 'vitest';
import { planCategoryTaskMoves } from '../../src/lib/categoryTaskMoves';

const task = (id: string, date: string, order: number, visibility = '') => ({
  id, date, order, createdAt: '2026-11-01T00:00:00.000Z', visibility,
});

describe('planCategoryTaskMoves', () => {
  it('preserves completion-independent all-day and Backlogs placement and inherited visibility', () => {
    const source = [task('day2', '2026-11-02', 3), task('backlog', '', 0),
      task('day1', '2026-11-02', 0, 'followers')];
    const destination = [task('existing', '2026-11-02', 6), task('oldbacklog', '', 4)];
    expect(planCategoryTaskMoves(source, destination, 'destination', 'private')).toEqual([
      { id: 'backlog', categoryId: 'destination', order: 5, visibility: 'private' },
      { id: 'day1', categoryId: 'destination', order: 7, visibility: 'followers' },
      { id: 'day2', categoryId: 'destination', order: 8, visibility: 'private' },
    ]);
  });

  it('preserves source ordering with deterministic ID ties and starts empty groups at zero', () => {
    expect(planCategoryTaskMoves([task('b', '2026-11-01', 0), task('a', '2026-11-01', 0)], [], 'target', 'public'))
      .toEqual([
        { id: 'a', categoryId: 'target', order: 0, visibility: 'public' },
        { id: 'b', categoryId: 'target', order: 1, visibility: 'public' },
      ]);
  });
});
