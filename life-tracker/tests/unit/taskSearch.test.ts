import { describe, expect, it } from 'vitest';
import { filterAndRankTasks } from '../../src/lib/taskSearch';
import type { TaskDocument } from '../../src/db/schema';

// Regression: §2 (Home task search is local,
// title-based, filterable, deterministically ranked, and DOM-bounded.

function task(
  id: string,
  title: string,
  date: string,
  categoryId = 'work'
): TaskDocument {
  return {
    id,
    title,
    completed: false,
    categoryId,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    userId: 'user_A',
    isDeleted: false,
    visibility: 'private',
  };
}

describe('filterAndRankTasks', () => {
  const now = new Date('2026-09-24T12:00:00');

  it('matches titles case-insensitively, ranks prefixes first, then future before past', () => {
    const tasks = [
      task('past-prefix', 'Plan archive', '2026-09-22'),
      task('future-substring', 'Review plan', '2026-09-25'),
      task('future-prefix', 'PLAN launch', '2026-09-26'),
      task('no-match', 'Groceries', '2026-09-24'),
    ];

    const result = filterAndRankTasks(tasks, {
      query: ' plan ',
      categoryIds: [],
      dateFilter: 'any',
      now,
    });

    expect(result.total).toBe(3);
    expect(result.results.map((item) => item.id)).toEqual([
      'future-prefix',
      'past-prefix',
      'future-substring',
    ]);
  });

  it('applies multiple categories and preset/custom date filters', () => {
    const tasks = [
      task('today-work', 'Today work', '2026-09-24', 'work'),
      task('today-life', 'Today life', '2026-09-24', 'life'),
      task('tomorrow-work', 'Tomorrow work', '2026-09-25', 'work'),
      task('october-life', 'October life', '2026-10-02', 'life'),
    ];

    expect(
      filterAndRankTasks(tasks, {
        query: '',
        categoryIds: ['work', 'life'],
        dateFilter: 'today',
        now,
      }).results.map((item) => item.id)
    ).toEqual(['today-life', 'today-work']);

    expect(
      filterAndRankTasks(tasks, {
        query: '',
        categoryIds: ['life'],
        dateFilter: 'custom',
        customStart: '2026-09-25',
        customEnd: '2026-10-05',
        now,
      }).results.map((item) => item.id)
    ).toEqual(['october-life']);
  });

  it('returns the full match count while bounding rendered results', () => {
    const tasks = Array.from({ length: 75 }, (_, index) =>
      task(
        `task-${index}`,
        `Task ${index}`,
        `2026-10-${String((index % 28) + 1).padStart(2, '0')}`
      )
    );

    const result = filterAndRankTasks(tasks, {
      query: 'task',
      categoryIds: [],
      dateFilter: 'any',
      now,
      limit: 50,
    });

    expect(result.total).toBe(75);
    expect(result.results).toHaveLength(50);
  });
});
