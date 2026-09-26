import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const OWNER = 'user_b';
const TASK_ID = 'task_test_1';
const CATEGORY_ID = 'cat_test_1';

const friendshipRow = () => ({ $id: 'fr_test' });

describe('message-action / react_to_task', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it('returns 400 when taskId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid taskId');
  });

  it('returns 400 when taskOwnerId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid taskOwnerId');
  });

  it('returns 400 for an invalid emoji', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('returns 400 when reacting to your own task', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: CALLER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot react to your own task');
  });

  it('returns 403 when the caller is not friends with the task owner', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
  });

  it('returns 404 when the task is not found', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    // getRow uses its default rejection (code 404).

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 403 when the task is owned by a different user', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    mockDb.getRow.mockResolvedValueOnce({
      user_id: 'someone_else',
      deleted: false,
      visibility: 'public',
      category_id: '',
      reactions: '',
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Task ownership mismatch');
  });

  it('returns 404 when the task is deleted', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    mockDb.getRow.mockResolvedValueOnce({
      user_id: OWNER,
      deleted: true,
      visibility: 'public',
      category_id: '',
      reactions: '',
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  // Regression: §20.8/§22 (private tasks cannot be reacted to by friends).
  it('returns 403 when task visibility is private', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    mockDb.getRow.mockResolvedValueOnce({
      user_id: OWNER,
      deleted: false,
      visibility: 'private',
      category_id: CATEGORY_ID,
      reactions: '',
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Task is not visible to you');
  });

  // Regression: §22 (task-reaction visibility falls back correctly without a category).
  // 'private', matching get_friend_calendar's behavior.
  it('falls back to private when the task has no category', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    mockDb.getRow.mockResolvedValueOnce({
      user_id: OWNER,
      deleted: false,
      visibility: '',
      category_id: '',
      reactions: '',
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Task is not visible to you');
  });

  it('successful: patches the task row with the new reactions JSON', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] });
    mockDb.getRow.mockResolvedValueOnce({
      user_id: OWNER,
      deleted: false,
      visibility: 'public',
      category_id: '',
      reactions: '',
    });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: {
        action: 'react_to_task',
        taskId: TASK_ID,
        taskOwnerId: OWNER,
        emoji: '👍',
        op: 'add',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const expected = JSON.stringify([{ emoji: '👍', userIds: [CALLER] }]);
    expect(res.body.reactions).toBe(expected);

    expect(mockDb.updateRow).toHaveBeenCalledTimes(1);
    const update = mockDb.updateRow.mock.calls[0][0];
    expect(update.tableId).toBe('tasks');
    expect(update.rowId).toBe(TASK_ID);
    expect(update.data.reactions).toBe(expected);
  });
});
