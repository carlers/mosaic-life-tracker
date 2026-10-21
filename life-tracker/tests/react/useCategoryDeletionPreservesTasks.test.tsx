import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  userId: string;
  isDeleted: boolean;
  categoryId?: string;
  order?: number;
  updatedAt: string;
  incrementalPatch: ReturnType<typeof vi.fn>;
}
const fixtures = vi.hoisted(() => ({
  owner: 'owner_a',
  categories: [] as Row[],
  tasks: [] as Row[],
  events: [] as string[],
  taskLookupDelay: null as null | (() => Promise<void>),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: fixtures.owner } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => {
  const matches = (row: Row, selector: Record<string, unknown>) =>
    Object.entries(selector).every(([key, value]) => row[key as keyof Row] === value);
  const find = (rows: Row[]) => (query: { selector: Record<string, unknown> }) => ({
    exec: async () => rows.filter(row => matches(row, query.selector)),
  });
  return { getDatabase: () => ({
    categories: {
      find: find(fixtures.categories),
      findOne: (id: string) => ({ exec: async () => fixtures.categories.find(row => row.id === id) ?? null }),
    },
    tasks: {
      find: find(fixtures.tasks),
      findOne: (id: string) => ({ exec: async () => {
        await fixtures.taskLookupDelay?.();
        return fixtures.tasks.find(row => row.id === id) ?? null;
      } }),
    },
  }) };
});

import { useCategories } from '../../src/hooks/useCategories';

function row(id: string, userId: string, extra: Partial<Row> = {}): Row {
  const record: Row = {
    id, userId, isDeleted: false, order: 0,
    updatedAt: '2026-10-21T00:00:00Z',
    incrementalPatch: vi.fn(async (patch: Partial<Row>) => {
      fixtures.events.push(id);
      Object.assign(record, patch);
    }),
    ...extra,
  };
  return record;
}

describe('deleting categories keeps owner tasks visible', () => {
  beforeEach(() => {
    fixtures.owner = 'owner_a';
    fixtures.categories = [
      row('old', 'owner_a', { order: 0 }),
      row('next', 'owner_a', { order: 1 }),
      row('other_owner', 'owner_b', { order: 0 }),
    ];
    fixtures.tasks = [
      row('task_1', 'owner_a', { categoryId: 'old' }),
      row('task_2', 'owner_a', { categoryId: 'old' }),
      row('foreign', 'owner_b', { categoryId: 'old' }),
    ];
    fixtures.events = [];
    fixtures.taskLookupDelay = null;
  });

  it('moves only the owner tasks before tombstoning the category', async () => {
    const { result } = renderHook(() => useCategories());
    await act(async () => result.current.deleteCategory('old'));
    expect(fixtures.tasks.slice(0, 2).map(t => t.categoryId)).toEqual(['next', 'next']);
    expect(fixtures.categories[0].isDeleted).toBe(true);
    expect(fixtures.tasks[2].categoryId).toBe('old');
    expect(fixtures.events).toEqual(['task_1', 'task_2', 'old']);
  });

  it('can delete an empty last category, but does not strand tasks in it', async () => {
    fixtures.categories = [row('old', 'owner_a')];
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(result.current.deleteCategory('old')).rejects.toThrow(/create another category/i);
    });
    expect(fixtures.categories[0].isDeleted).toBe(false);
    fixtures.tasks = [];
    await act(async () => result.current.deleteCategory('old'));
    expect(fixtures.categories[0].isDeleted).toBe(true);
  });

  it('does not tombstone after a failed partial move and retries without losing data', async () => {
    fixtures.tasks[1].incrementalPatch.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(result.current.deleteCategory('old')).rejects.toThrow('disk full');
    });
    expect(fixtures.categories[0].isDeleted).toBe(false);
    expect(fixtures.tasks[0].categoryId).toBe('next');
    expect(fixtures.tasks[1].categoryId).toBe('old');
    await act(async () => result.current.deleteCategory('old'));
    expect(fixtures.tasks[1].categoryId).toBe('next');
    expect(fixtures.categories[0].isDeleted).toBe(true);
  });

  it('revokes mutation after switching owners during a delayed lookup', async () => {
    let resume!: () => void;
    let entered!: () => void;
    const lookupEntered = new Promise<void>(resolve => { entered = resolve; });
    fixtures.taskLookupDelay = () => {
      entered();
      return new Promise<void>(resolve => { resume = resolve; });
    };
    const { result, rerender } = renderHook(() => useCategories());
    const mutation = result.current.deleteCategory('old');
    await lookupEntered;
    fixtures.owner = 'owner_b';
    rerender();
    await act(async () => {
      resume();
      await expect(mutation).rejects.toThrow(/account changed/i);
    });
    expect(fixtures.events).toEqual([]);
  });
});
