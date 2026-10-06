import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const USER = 'user_A';

function task(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: {
      title: 'Imported task',
      is_completed: false,
      category_id: 'cat_one',
      order: 0,
      tags: '',
      date: '2026-10-06',
      memo: '',
      image: '',
      created_at: '2026-10-01T00:00:00.000Z',
      completed_at: '',
      updated_at: '2026-10-02T00:00:00.000Z',
      source: 'todomate',
      user_id: USER,
      deleted: false,
      visibility: 'private',
      routine_id: '',
      reminder_time: '',
      reactions: '',
      ...overrides,
    },
  };
}

describe('message-action / bulk_create_todomate_tasks', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it('creates a validated batch concurrently with owner-only permissions', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockDb.createRow.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {};
    });

    const res = await invoke({
      userId: USER,
      mockDb,
      body: {
        action: 'bulk_create_todomate_tasks',
        tasks: [task('todo_one'), task('todo_two')],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      results: [
        { id: 'todo_one', status: 'created' },
        { id: 'todo_two', status: 'created' },
      ],
    });
    expect(maxInFlight).toBeGreaterThan(1);
    expect(mockDb.createRow).toHaveBeenCalledTimes(2);
    expect(mockDb.createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'tasks',
        rowId: 'todo_one',
        data: expect.objectContaining({
          user_id: USER,
          source: 'todomate',
          deleted: false,
          reactions: '',
        }),
        permissions: [
          'read("user:user_A")',
          'update("user:user_A")',
          'delete("user:user_A")',
        ],
      })
    );
  });

  it('returns existing same-owner rows so the client can preserve conflict semantics', async () => {
    mockDb.createRow.mockRejectedValueOnce(
      Object.assign(new Error('Already exists'), { code: 409 })
    );
    mockDb.getRow.mockResolvedValueOnce({
      $id: 'todo_existing',
      user_id: USER,
      source: 'todomate',
      title: 'Existing',
      is_completed: false,
      category_id: 'cat_one',
      order: 0,
      tags: '',
      date: '2026-10-06',
      memo: '',
      image: '',
      created_at: '2026-10-01T00:00:00.000Z',
      completed_at: '',
      updated_at: '2026-10-02T00:00:00.000Z',
      deleted: false,
      visibility: 'private',
      routine_id: '',
      reminder_time: '',
      reactions: '',
    });

    const res = await invoke({
      userId: USER,
      mockDb,
      body: {
        action: 'bulk_create_todomate_tasks',
        tasks: [task('todo_existing')],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      id: 'todo_existing',
      status: 'existing',
      row: { user_id: USER },
    });
  });

  it('rejects owner spoofing before creating any rows', async () => {
    const res = await invoke({
      userId: USER,
      mockDb,
      body: {
        action: 'bulk_create_todomate_tasks',
        tasks: [task('todo_bad', { user_id: 'mallory' })],
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid TodoMate task');
    expect(mockDb.createRow).not.toHaveBeenCalled();
  });

  it('fails closed when a conflicting row belongs to another owner', async () => {
    mockDb.createRow.mockRejectedValueOnce(
      Object.assign(new Error('Already exists'), { code: 409 })
    );
    mockDb.getRow.mockResolvedValueOnce({
      $id: 'todo_collision',
      user_id: 'mallory',
    });

    const res = await invoke({
      userId: USER,
      mockDb,
      body: {
        action: 'bulk_create_todomate_tasks',
        tasks: [task('todo_collision')],
      },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Task ownership mismatch');
  });

  it('rejects batches larger than the RxDB push batch', async () => {
    const res = await invoke({
      userId: USER,
      mockDb,
      body: {
        action: 'bulk_create_todomate_tasks',
        tasks: Array.from({ length: 21 }, (_, index) =>
          task('todo_' + index)
        ),
      },
    });

    expect(res.status).toBe(400);
    expect(mockDb.createRow).not.toHaveBeenCalled();
  });
});
