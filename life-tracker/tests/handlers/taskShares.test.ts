import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const require = createRequire(import.meta.url);
const { shareId } = require('../../appwrite-functions/message-action/task-shares.js');

const owner = 'user_A';
const invitee = 'user_B';
const taskId = 'task_demo';
const friendshipVersion = require('node:crypto').createHash('sha256')
  .update('2026-10-09T00:00:01.000Z|2026-10-09T00:00:01.000Z')
  .digest('hex').slice(0, 40);
const friendId = (one: string, two: string) =>
  'fr_' + require('node:crypto').createHash('sha256')
    .update(one + '|' + two).digest('hex').slice(0, 32);

function baseTask(changes: Record<string, unknown> = {}) {
  return {
    $id: taskId, $updatedAt: '2026-10-10T00:00:01.000Z',
    user_id: owner, title: 'Shared title', date: '2026-10-10',
    is_completed: false, memo: 'SECRET MEMO', image: 'SECRET IMAGE',
    category_id: 'SECRET CATEGORY', visibility: 'private', deleted: false, ...changes,
  };
}
function baseShare(changes: Record<string, unknown> = {}) {
  return {
    $id: shareId(taskId, invitee), $updatedAt: '2026-10-10T00:00:02.000Z',
    task_id: taskId, owner_id: owner, invitee_id: invitee,
    status: 'accepted', grant_epoch: 'grant_abc',
    friendship_version: friendshipVersion, last_command_id: '',
    last_membership_command_id: '',
    last_command_target: false, allow_title_edit: false, allow_date_edit: false, created_at: '2026-10-10T00:00:00.000Z',
    updated_at: '2026-10-10T00:00:02.000Z', ...changes,
  };
}

describe('task sharing Function authorization and completion', () => {
  let db: MockDb;
  let task: Record<string, unknown>;
  let share: Record<string, unknown>;
  let friendship: boolean;

  beforeEach(() => {
    db = makeMockDb();
    task = baseTask();
    share = baseShare();
    friendship = true;
    db.getRow.mockImplementation(async ({ tableId, rowId }: { tableId: string, rowId: string }) => {
      if (tableId === 'tasks' && rowId === taskId) return task;
      if (tableId === 'task_shares' && rowId === share.$id) return share;
      if (tableId === 'friendships' && [friendId(owner, invitee), friendId(invitee, owner)].includes(rowId)) {
        return { status: friendship ? 'accepted' : 'blocked', deleted: false,
          updated_at: '2026-10-09T00:00:01.000Z' };
      }
      throw Object.assign(new Error('Not found'), { code: 404 });
    });
  });

  it('generates Appwrite-safe deterministic membership row IDs', () => {
    expect(shareId(taskId, invitee)).toMatch(/^shr_[a-f0-9]{32}$/);
    expect(shareId(taskId, invitee)).toHaveLength(36);
    expect(shareId(taskId, invitee)).not.toBe(shareId(taskId, 'user_C'));
  });

  it('returns a strict minimal projection even for private tasks', async () => {
    db.listRows.mockResolvedValue({ rows: [share] });
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'list', scope: 'received' } });
    expect(result.status).toBe(200);
    expect(result.body.items).toHaveLength(1);
    const item = result.body.items[0];
    expect(item).toMatchObject({
      taskId, ownerId: owner, title: 'Shared title',
      date: '2026-10-10', completed: false, status: 'accepted',
    });
    for (const forbidden of ['memo', 'image', 'categoryId', 'category_id', 'visibility', 'tags', 'reactions']) {
      expect(item).not.toHaveProperty(forbidden);
    }
    expect(JSON.stringify(result.body)).not.toContain('SECRET');
  });

  it('coalesces owner list task reads across multiple collaborators without leaking fields', async () => {
    const recipients = ['user_B', 'user_C', 'user_D'];
    db.listRows.mockResolvedValue({ rows: recipients.map(inviteeId => baseShare({
      $id: shareId(taskId, inviteeId), invitee_id: inviteeId,
    })) });
    db.getRow.mockImplementation(async ({ tableId, rowId }: { tableId: string; rowId: string }) => {
      if (tableId === 'tasks' && rowId === taskId) return task;
      if (tableId === 'friendships' && recipients.some(friend =>
        rowId === friendId(owner, friend) || rowId === friendId(friend, owner))) {
        return { status: 'accepted', deleted: false,
          updated_at: '2026-10-09T00:00:01.000Z' };
      }
      throw Object.assign(new Error('Not found'), { code: 404 });
    });

    const result = await invoke({ userId: owner, mockDb: db,
      body: { action: 'task_shares', operation: 'list', scope: 'owned' } });
    expect(result.status).toBe(200);
    expect(result.body.items.map((item: { inviteeId: string }) => item.inviteeId))
      .toEqual(recipients);
    expect(db.getRow.mock.calls.filter(([query]: [{ tableId: string }]) =>
      query.tableId === 'tasks')).toHaveLength(1);
    expect(JSON.stringify(result.body)).not.toContain('SECRET');
  });

  it('fences legacy direct owner writes atomically with first invitation', async () => {
    share = {};
    db.createRow.mockImplementation(async ({ rowId, data }: { rowId: string, data: Record<string, unknown> }) => {
      share = { ...data, $id: rowId, $updatedAt: '2026-10-10T00:00:03.000Z' };
      return {};
    });
    db.getRow.mockImplementation(async ({ tableId, rowId }: { tableId: string, rowId: string }) => {
      if (tableId === 'tasks' && rowId === taskId) return task;
      if (tableId === 'task_shares' && rowId === share.$id) return share;
      if (tableId === 'friendships' && [friendId(owner, invitee), friendId(invitee, owner)].includes(rowId)) {
        return { status: 'accepted', deleted: false, updated_at: '2026-10-09T00:00:01.000Z' };
      }
      throw Object.assign(new Error('Not found'), { code: 404 });
    });
    const result = await invoke({ userId: owner, mockDb: db,
      body: { action: 'task_shares', operation: 'invite', taskId, friendUserId: invitee } });
    expect(result.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'tasks', rowId: taskId, transactionId: 'tx',
      permissions: ['read("user:user_A")', 'delete("user:user_A")'],
    }));
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'tx', commit: true });
  });

  it('refuses a forged invite from a non-owner', async () => {
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'invite', taskId, friendUserId: 'user_C' } });
    expect(result.status).toBe(404);
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it('refuses revoked friendship even with a cached membership', async () => {
    friendship = false;
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner, taskId,
        grantEpoch: 'grant_abc', completed: true,
        expectedRevision: task.$updatedAt, operationId: 'cmd_one' } });
    expect(result.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('rejects a stale offline completion without mutating the task', async () => {
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner, taskId,
        grantEpoch: 'grant_abc', completed: true,
        expectedRevision: '2026-10-09T00:00:00.000Z', operationId: 'cmd_old' } });
    expect(result.status).toBe(409);
    expect(result.body.item.completed).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('stages an atomic completion and idempotency stamp without sending private fields', async () => {
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner, taskId,
        grantEpoch: 'grant_abc', completed: true,
        expectedRevision: task.$updatedAt, operationId: 'cmd_valid' } });
    expect(result.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'tasks', rowId: taskId, transactionId: 'tx',
      data: expect.objectContaining({ is_completed: true }),
    }));
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'task_shares', transactionId: 'tx',
      data: expect.objectContaining({ last_command_id: 'cmd_valid' }),
    }));
    expect(db.updateTransaction).toHaveBeenCalledWith({ transactionId: 'tx', commit: true });
    expect(JSON.stringify(result.body)).not.toContain('SECRET');
  });

  it('deduplicates a lost-response replay without a second write', async () => {
    share = baseShare({ last_command_id: 'cmd_repeat', last_command_target: true });
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner, taskId,
        grantEpoch: 'grant_abc', completed: true,
        expectedRevision: 'stale', operationId: 'cmd_repeat' } });
    expect(result.status).toBe(200);
    expect(result.body.duplicate).toBe(true);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('denies resurrecting a grant after unfriending and re-adding a friend', async () => {
    share = baseShare({ friendship_version: 'obsolete_relation_version' });
    db.listRows.mockResolvedValue({ rows: [share] });
    const list = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'list', scope: 'received' } });
    expect(list.body.items).toEqual([]);
    const attempted = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner,
        taskId, grantEpoch: 'grant_abc', completed: true,
        expectedRevision: task.$updatedAt, operationId: 'cmd_stale' } });
    expect(attempted.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('replays an accepted offline invitation idempotently without rewriting', async () => {
    share = baseShare({ last_membership_command_id: 'member_op_1' });
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'accept', ownerId: owner, taskId,
        grantEpoch: 'grant_abc', operationId: 'member_op_1' } });
    expect(result.status).toBe(200);
    expect(result.body.duplicate).toBe(true);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('requires versioned client operation IDs on accepted/declined/left transitions', async () => {
    share = baseShare({ status: 'pending' });
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'accept', ownerId: owner, taskId,
        grantEpoch: 'grant_abc' } });
    expect(result.status).toBe(400);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('refuses a stale grant epoch after re-invitation', async () => {
    share = baseShare({ grant_epoch: 'new_epoch' });
    const result = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_completed', ownerId: owner, taskId,
        grantEpoch: 'old_epoch', completed: true,
        expectedRevision: task.$updatedAt, operationId: 'cmd_old' } });
    expect(result.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('denies title and date writes without explicit owner grants', async () => {
    for (const [operation, patch] of [
      ['edit_title', { title: 'Altered by invitee' }],
      ['edit_date', { date: '2026-10-11' }],
    ] as const) {
      const result = await invoke({ userId: invitee, mockDb: db,
        body: { action: 'task_shares', operation, ownerId: owner, taskId,
          grantEpoch: 'grant_abc', expectedRevision: task.$updatedAt, ...patch } });
      expect(result.status).toBe(403);
    }
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it('allows only title when owner granted title, and rejects stale revisions', async () => {
    share.allow_title_edit = true;
    const changed = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'edit_title', ownerId: owner,
        taskId, grantEpoch: 'grant_abc', expectedRevision: task.$updatedAt, title: 'New shared title' } });
    expect(changed.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'tasks', rowId: taskId,
      data: expect.objectContaining({ title: 'New shared title' }),
    }));
    const date = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'edit_date', ownerId: owner,
        taskId, grantEpoch: 'grant_abc', expectedRevision: task.$updatedAt, date: '2026-10-11' } });
    expect(date.status).toBe(403);
    const stale = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'edit_title', ownerId: owner,
        taskId, grantEpoch: 'grant_abc', expectedRevision: 'older', title: 'Oops' } });
    expect(stale.status).toBe(409);
  });

  it('lets only the owner adjust edit permissions on an existing share', async () => {
    const denied = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'set_permissions', taskId,
        ownerId: owner, friendUserId: invitee, grantEpoch: 'grant_abc',
        allowTitleEdit: true, allowDateEdit: true } });
    expect(denied.status).not.toBe(200);
    const granted = await invoke({ userId: owner, mockDb: db,
      body: { action: 'task_shares', operation: 'set_permissions', taskId,
        friendUserId: invitee, grantEpoch: 'grant_abc',
        allowTitleEdit: true, allowDateEdit: false } });
    expect(granted.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'task_shares',
      data: expect.objectContaining({ allow_title_edit: true, allow_date_edit: false }),
    }));
  });

  it('rejects revoked grants and malformed shared-date edits', async () => {
    share.allow_date_edit = true;
    for (const date of ['2026-02-30', 'tomorrow', '2026-11-01T00:00:00Z']) {
      const result = await invoke({ userId: invitee, mockDb: db,
        body: { action: 'task_shares', operation: 'edit_date', ownerId: owner,
          taskId, grantEpoch: 'grant_abc', expectedRevision: task.$updatedAt, date } });
      expect(result.status).toBe(400);
    }
    share.status = 'revoked';
    const denied = await invoke({ userId: invitee, mockDb: db,
      body: { action: 'task_shares', operation: 'edit_date', ownerId: owner,
        taskId, grantEpoch: 'grant_abc', expectedRevision: task.$updatedAt,
        date: '2026-11-01' } });
    expect(denied.status).toBe(403);
  });

});
