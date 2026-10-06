import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRowMock = vi.hoisted(() => vi.fn());
const updateRowMock = vi.hoisted(() => vi.fn());
const sendAppActionMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/sdk', () => ({
  guardedTablesDB: {
    getRow: getRowMock,
    updateRow: updateRowMock,
  },
}));

vi.mock('../../src/lib/appAction', () => ({
  sendAppAction: sendAppActionMock,
}));

import {
  readOwnerMaster,
  updateOwnerRowWithCas,
} from '../../src/db/ownerWriteCas';

describe('owner write CAS client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateRowMock.mockResolvedValue({});
  });

  it('preserves the server $updatedAt token from the owner read', async () => {
    getRowMock.mockResolvedValue({
      $id: 'cat_a',
      $updatedAt: '2026-10-06T10:00:01.000Z',
      user_id: 'user_A',
      name: 'Work',
    });

    const result = await readOwnerMaster({
      databaseId: 'life_tracker',
      tableId: 'categories',
      rowId: 'cat_a',
      userId: 'user_A',
      ownerLabel: 'Category',
      mapRow: (row) => ({ id: row.$id, name: row.name }),
    });

    expect(result).toEqual({
      document: { id: 'cat_a', name: 'Work' },
      serverUpdatedAt: '2026-10-06T10:00:01.000Z',
    });
  });

  it('returns a concurrent master as a conflict', async () => {
    sendAppActionMock.mockResolvedValue({
      status: 'conflict',
      row: {
        $id: 'cat_a',
        $updatedAt: '2026-10-06T10:00:02.000Z',
        user_id: 'user_A',
        name: 'Other device',
      },
    });

    await expect(
      updateOwnerRowWithCas({
        databaseId: 'life_tracker',
        tableId: 'categories',
        rowId: 'cat_a',
        userId: 'user_A',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: { user_id: 'user_A', name: 'Local' },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'conflict',
        row: expect.objectContaining({ name: 'Other device' }),
      })
    );

    expect(updateRowMock).not.toHaveBeenCalled();
  });

  it('keeps writes working during a staggered backend rollout', async () => {
    sendAppActionMock.mockRejectedValue(
      Object.assign(new Error('Unknown action'), {
        code: 400,
        result: { error: 'Unknown action: compare_and_set_owner_row' },
      })
    );

    await expect(
      updateOwnerRowWithCas({
        databaseId: 'life_tracker',
        tableId: 'settings',
        rowId: 'setting_a',
        userId: 'user_A',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: {
          user_id: 'user_A',
          key: 'theme',
          value: 'light',
        },
      })
    ).resolves.toEqual({ status: 'updated' });

    expect(updateRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: 'setting_a' })
    );
  });
});
