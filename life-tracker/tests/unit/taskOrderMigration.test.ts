import { describe, expect, it } from 'vitest';
import { tasksMigrationStrategies } from '../../src/db/migrations';

describe('task order migration', () => {
  it('derives deterministic, non-negative values from creation time and ID', () => {
    const migrate = tasksMigrationStrategies[2];
    const first = migrate({ id: 'task_a', createdAt: '2026-01-01T00:00:00.000Z' });
    const second = migrate({ id: 'task_b', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(first.order).toBeGreaterThanOrEqual(0);
    expect(second.order).not.toBe(first.order);
    expect(migrate({ id: 'task_a', createdAt: '2026-01-01T00:00:00.000Z' }).order).toBe(first.order);
  });
});
