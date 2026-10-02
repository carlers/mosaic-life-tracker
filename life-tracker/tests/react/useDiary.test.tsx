import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findOneMock = vi.hoisted(() => vi.fn());
const upsertLocalDocMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../src/db/database', () => ({
  getDatabase: () => ({
    diary: {
      findOne: (id: string) => ({
        exec: () => findOneMock(id),
      }),
    },
  }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_A' } }),
}));

vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock('../../src/lib/localUpsert', () => ({
  upsertLocalDoc: upsertLocalDocMock,
}));


import { useDiary } from '../../src/hooks/useDiary';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T08:00:00.000Z'));
  findOneMock.mockReset();
  upsertLocalDocMock.mockReset();
  upsertLocalDocMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDiary sync mutations', () => {
  it('stamps diary tombstones with the deletion time and schedules sync', async () => {
    const incrementalPatch = vi.fn().mockResolvedValue(undefined);
    findOneMock.mockResolvedValue({ incrementalPatch });

    const { result } = renderHook(() => useDiary());

    await act(async () => {
      await result.current.deleteEntry('2026-10-01');
    });

    expect(incrementalPatch).toHaveBeenCalledWith({
      isDeleted: true,
      updatedAt: '2026-10-02T08:00:00.000Z',
    });
  });

  it('saves a diary entry through the local RxDB document path', async () => {
    findOneMock.mockResolvedValue(null);
    const { result } = renderHook(() => useDiary());

    await act(async () => {
      await result.current.saveEntry('2026-10-01', 'hello', 'private');
    });

    expect(upsertLocalDocMock).toHaveBeenCalledTimes(1);
    expect(requestSyncMock).toHaveBeenCalledWith('user_A');
  });
});
