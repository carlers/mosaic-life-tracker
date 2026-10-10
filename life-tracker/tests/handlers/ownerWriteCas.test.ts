import { beforeEach, describe, expect, it } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

function categoryData(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Work',
    color: '#3B82F6',
    order: 0,
    visibility: 'private',
    user_id: 'user_A',
    deleted: false,
    icon: '',
    updated_at: '2026-10-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('message-action owner write CAS', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it('updates exactly the owner row at the expected server revision', async () => {
    mockDb.updateRows.mockResolvedValue({ total: 1, rows: [{}] });

    const result = await invoke({
      userId: 'user_A',
      mockDb,
      body: {
        action: 'compare_and_set_owner_row',
        tableId: 'categories',
        rowId: 'cat_a',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: categoryData({ name: 'Updated' }),
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, status: 'updated' });
    expect(mockDb.updateRows).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseId: 'life_tracker',
        tableId: 'categories',
        data: expect.objectContaining({
          user_id: 'user_A',
          name: 'Updated',
        }),
        queries: expect.arrayContaining([
          { op: 'equal', key: '$id', value: 'cat_a' },
          {
            op: 'equal',
            key: '$updatedAt',
            value: '2026-10-06T10:00:01.000Z',
          },
          { op: 'equal', key: 'user_id', value: 'user_A' },
        ]),
      })
    );
  });

  it('returns the current master when the compare-and-set loses a race', async () => {
    mockDb.updateRows.mockResolvedValue({ total: 0, rows: [] });
    mockDb.getRow.mockResolvedValue({
      $id: 'cat_a',
      $updatedAt: '2026-10-06T10:00:02.000Z',
      ...categoryData({ name: 'Other device' }),
    });

    const result = await invoke({
      userId: 'user_A',
      mockDb,
      body: {
        action: 'compare_and_set_owner_row',
        tableId: 'categories',
        rowId: 'cat_a',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: categoryData({ name: 'This device' }),
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'conflict',
        row: expect.objectContaining({ name: 'Other device' }),
      })
    );
  });

  it('reports a row that disappeared after the client read as missing', async () => {
    mockDb.updateRows.mockResolvedValue({ total: 0, rows: [] });

    const result = await invoke({
      userId: 'user_A',
      mockDb,
      body: {
        action: 'compare_and_set_owner_row',
        tableId: 'diary',
        rowId: 'diary_a',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: {
          date: '2026-10-06',
          content: 'entry',
          visibility: 'private',
          user_id: 'user_A',
          updated_at: '2026-10-06T10:00:02.000Z',
          deleted: false,
          created_at: '2026-10-06T09:00:00.000Z',
        },
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, status: 'missing' });
  });


  it('rejects legacy owner CAS writes on a task that has ever been shared', async () => {
    mockDb.listRows.mockResolvedValue({ rows: [{ $id: 'shr_previous', status: 'revoked' }] });
    const server = { $id: 'task_1', user_id: 'user_A',
      is_completed: true, title: 'Current task', $updatedAt: '2026-10-10T10:00:00.000Z' };
    mockDb.getRow.mockResolvedValue(server);
    const result = await invoke({ userId: 'user_A', mockDb,
      body: { action: 'compare_and_set_owner_row', tableId: 'tasks',
        rowId: 'task_1', expectedUpdatedAt: '2026-10-10T10:00:00.000Z',
        data: { user_id: 'user_A', title: 'Older local edit', is_completed: false } },
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, status: 'conflict', row: server });
    expect(mockDb.updateRows).not.toHaveBeenCalled();
  });


  it('blocks an owner Backlog move when a collaborator is pending or accepted', async () => {
    mockDb.listRows.mockResolvedValue({ rows: [{ status: 'accepted' }] });
    const task = { $id: 'task_1', user_id: 'user_A', date: '2026-10-10' };
    mockDb.getRow.mockResolvedValue(task);
    const result = await invoke({ userId: 'user_A', mockDb,
      body: { action: 'compare_and_set_owner_row', tableId: 'tasks',
        rowId: 'task_1', expectedUpdatedAt: '2026-10-10T10:00:00.000Z',
        expectedCompleted: false,
        data: { user_id: 'user_A', date: '', is_completed: false } },
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, status: 'conflict', row: task });
    expect(mockDb.listRows).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'task_shares',
      queries: expect.arrayContaining([
        { op: 'equal', key: 'status', value: ['pending', 'accepted'] },
      ]),
    }));
    expect(mockDb.updateRows).not.toHaveBeenCalled();
  });

  it('allows unscheduling an unshared task with the same task identity', async () => {
    mockDb.listRows.mockResolvedValue({ rows: [] });
    mockDb.updateRows.mockResolvedValue({ total: 1, rows: [{}] });
    const result = await invoke({ userId: 'user_A', mockDb,
      body: { action: 'compare_and_set_owner_row', tableId: 'tasks',
        rowId: 'task_1', expectedUpdatedAt: '2026-10-10T10:00:00.000Z',
        expectedCompleted: false,
        data: { user_id: 'user_A', date: '', is_completed: false } },
    });
    expect(result.body.status).toBe('updated');
    expect(mockDb.updateRows).toHaveBeenCalledOnce();
  });

  it('preserves task completion precondition atomically on upgraded owner writes', async () => {
    mockDb.updateRows.mockResolvedValue({ total: 1, rows: [{}] });
    const result = await invoke({ userId: 'user_A', mockDb,
      body: { action: 'compare_and_set_owner_row', tableId: 'tasks',
        rowId: 'task_1', expectedUpdatedAt: '2026-10-10T10:00:00.000Z',
        expectedCompleted: true,
        data: { user_id: 'user_A', title: 'Updated task', is_completed: true } },
    });
    expect(result.status).toBe(200);
    expect(mockDb.listRows).not.toHaveBeenCalled();
    expect(mockDb.updateRows).toHaveBeenCalledWith(expect.objectContaining({
      queries: expect.arrayContaining([
        { op: 'equal', key: 'is_completed', value: true },
      ]),
    }));
  });

  it('rejects invalid expected completion baselines without writing', async () => {
    const result = await invoke({ userId: 'user_A', mockDb,
      body: { action: 'compare_and_set_owner_row', tableId: 'tasks',
        rowId: 'task_1', expectedUpdatedAt: '2026-10-10T10:00:00.000Z',
        expectedCompleted: 'true',
        data: { user_id: 'user_A', title: 'Bad', is_completed: true } },
    });
    expect(result.status).toBe(400);
    expect(mockDb.updateRows).not.toHaveBeenCalled();
  });

  it('rejects cross-account and non-owner-table writes', async () => {
    const foreign = await invoke({
      userId: 'user_A',
      mockDb,
      body: {
        action: 'compare_and_set_owner_row',
        tableId: 'settings',
        rowId: 'setting_a',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: {
          user_id: 'user_B',
          key: 'theme',
          value: 'light',
          deleted: false,
          updated_at: '2026-10-06T10:00:02.000Z',
        },
      },
    });
    const unsupported = await invoke({
      userId: 'user_A',
      mockDb,
      body: {
        action: 'compare_and_set_owner_row',
        tableId: 'messages',
        rowId: 'msg_a',
        expectedUpdatedAt: '2026-10-06T10:00:01.000Z',
        data: { user_id: 'user_A' },
      },
    });

    expect(foreign.status).toBe(400);
    expect(unsupported.status).toBe(400);
    expect(mockDb.updateRows).not.toHaveBeenCalled();
  });
});
