import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refs = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner_a' } }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({ tasks: { findOne: refs.findOne } }),
}));
import { useTasks } from '../../src/hooks/useTasks';

beforeEach(() => refs.findOne.mockReset());

describe('task photo reference replacement', () => {
  it('atomically updates an owned task only when its prior photo matches', async () => {
    let applied: Record<string, unknown> | null = null;
    const doc = { incrementalModify: vi.fn(async (modifier: (row: any) => any) => {
      applied = modifier({ userId: 'owner_a', isDeleted: false, image: 'img_old' });
    }) };
    refs.findOne.mockReturnValue({ exec: async () => doc });
    const { result } = renderHook(() => useTasks());
    await act(async () => result.current.replaceTaskPhoto('task_1', 'img_new', 'img_old'));
    expect(applied).toMatchObject({ image: 'img_new', userId: 'owner_a' });
    expect(doc.incrementalModify).toHaveBeenCalledOnce();
  });

  it('rejects a stale photo without overwriting it', async () => {
    const doc = { incrementalModify: vi.fn(async (modifier: (row: any) => any) => {
      modifier({ userId: 'owner_a', isDeleted: false, image: 'img_changed' });
    }) };
    refs.findOne.mockReturnValue({ exec: async () => doc });
    const { result } = renderHook(() => useTasks());
    await expect(result.current.replaceTaskPhoto('task_1', 'img_new', 'img_old'))
      .rejects.toThrow(/Task photo changed/);
  });

  it('rejects an absent task and never reports attachment success', async () => {
    refs.findOne.mockReturnValue({ exec: async () => null });
    const { result } = renderHook(() => useTasks());
    await expect(result.current.replaceTaskPhoto('task_missing', 'img_new', ''))
      .rejects.toThrow(/no longer available/);
  });

  it('refuses a foreign-owned task', async () => {
    const doc = { incrementalModify: vi.fn(async (modifier: (row: any) => any) => {
      modifier({ userId: 'other_owner', isDeleted: false, image: '' });
    }) };
    refs.findOne.mockReturnValue({ exec: async () => doc });
    const { result } = renderHook(() => useTasks());
    await expect(result.current.replaceTaskPhoto('task_foreign', 'img_new', ''))
      .rejects.toThrow(/no longer available/);
  });
});
