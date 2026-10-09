// Regression for #434: the category sheet can only show a failed-write
// retry state if the underlying persistence hook propagates the rejection.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  userId: 'viewer_1' as string | null,
  insert: vi.fn(),
  incrementalPatch: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: fixture.userId ? { $id: fixture.userId } : null }),
}));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    categories: {
      insert: fixture.insert,
      findOne: () => ({
        exec: async () => ({
          id: 'cat_1',
          name: 'Original',
          visibility: 'private',
          isDeleted: false,
          incrementalPatch: fixture.incrementalPatch,
        }),
      }),
    },
  }),
}));

import { useCategories } from '../../src/hooks/useCategories';

describe('category mutation error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.userId = 'viewer_1';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects failed category insertion instead of pretending save completed', async () => {
    fixture.insert.mockRejectedValueOnce(new Error('local database unavailable'));
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(
        result.current.addCategory({
          name: 'New',
          color: '#112233',
          visibility: 'private',
          order: 0,
          icon: '',
        })
      ).rejects.toThrow('local database unavailable');
    });
  });

  it('rejects failed category deletion instead of hiding confirmation', async () => {
    fixture.incrementalPatch.mockRejectedValueOnce(new Error('write rejected'));
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(result.current.deleteCategory('cat_1')).rejects.toThrow('write rejected');
    });
  });

  it('fails closed on unauthenticated category creation', async () => {
    fixture.userId = null;
    const { result } = renderHook(() => useCategories());
    await act(async () => {
      await expect(
        result.current.addCategory({
          name: 'New',
          color: '#112233',
          visibility: 'private',
          order: 0,
          icon: '',
        })
      ).rejects.toThrow(/not authenticated/i);
    });
    expect(fixture.insert).not.toHaveBeenCalled();
  });
});
