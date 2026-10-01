import { describe, expect, it } from 'vitest';
import { tasksMigrationStrategies } from '../../src/db/migrations';

describe('task order migration', () => {
  it('defaults legacy tasks to order zero so createdAt-desc remains the tie-breaker', () => {
    const migrated = tasksMigrationStrategies[2]({
      id: 'task_a',
      title: 'Legacy task',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(migrated).toMatchObject({
      id: 'task_a',
      title: 'Legacy task',
      order: 0,
    });
  });
});
