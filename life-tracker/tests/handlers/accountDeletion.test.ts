import { describe, expect, it, vi } from 'vitest';
import {
  invoke,
  makeMockDb,
  makeMockFunctions,
  makeMockStorage,
  makeMockUsers,
} from '../helpers/invoke-handler';

function notFound() {
  return Object.assign(new Error('Not found'), { code: 404 });
}

function queryValue(queries: any[], key: string): unknown {
  return queries.find((query) => query?.op === 'equal' && query.key === key)
    ?.value;
}

describe('account deletion handler', () => {
  it('rejects anything except the exact DELETE confirmation before mutations', async () => {
    const db = makeMockDb();
    const users = makeMockUsers();
    const functions = makeMockFunctions();

    const response = await invoke({
      userId: 'alice',
      mockDb: db,
      mockUsers: users,
      mockFunctions: functions,
      body: { action: 'delete_account', confirmation: 'delete', ownerId: 'bob' },
    });

    expect(response.status).toBe(400);
    expect(db.createRow).not.toHaveBeenCalled();
    expect(users.updateStatus).not.toHaveBeenCalled();
    expect(functions.createExecution).not.toHaveBeenCalled();
  });

  it('persists the DR marker before freezing the authenticated caller and queues durable cleanup', async () => {
    const db = makeMockDb();
    const users = makeMockUsers();
    const functions = makeMockFunctions();
    const rows = new Map<string, any>();
    const profile = {
      $id: 'profile_alice',
      user_id: 'alice',
      deleted: false,
      is_searchable: true,
    };

    db.getRow.mockImplementation(async ({ tableId, rowId }: any) => {
      const found = rows.get(`${tableId}:${rowId}`);
      if (found) return found;
      throw notFound();
    });
    db.listRows.mockImplementation(async ({ tableId }: any) => {
      if (tableId === 'profiles') return { rows: [profile] };
      return { rows: [] };
    });
    db.createRow.mockImplementation(async (input: any) => {
      const row = { $id: input.rowId, ...input.data };
      rows.set(`${input.tableId}:${input.rowId}`, row);
      return row;
    });
    db.updateRow.mockImplementation(async (input: any) => {
      if (input.tableId === 'profiles') {
        Object.assign(profile, input.data);
        return profile;
      }
      const key = `${input.tableId}:${input.rowId}`;
      const row = rows.get(key);
      if (!row) throw notFound();
      Object.assign(row, input.data);
      return row;
    });

    const response = await invoke({
      userId: 'alice',
      mockDb: db,
      mockUsers: users,
      mockFunctions: functions,
      body: { action: 'delete_account', confirmation: 'DELETE', ownerId: 'bob' },
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      accepted: true,
      deletionPending: true,
    });
    expect(functions.createExecution).toHaveBeenCalledTimes(2);
    expect(JSON.parse(functions.createExecution.mock.calls[0][0].body)).toEqual({
      action: 'record_privacy_deletion',
      userId: 'alice',
    });
    expect(users.updateStatus).toHaveBeenCalledWith({
      userId: 'alice',
      status: false,
    });
    expect(users.deleteSessions).toHaveBeenCalledWith({ userId: 'alice' });
    expect(profile).toMatchObject({ deleted: true, is_searchable: false });
    expect(
      JSON.parse(functions.createExecution.mock.calls[1][0].body).action
    ).toBe('resume_account_deletion');
    expect(
      [...rows.values()].find((row) => row.user_id === 'alice')
    ).toMatchObject({ status: 'pending', phase: 'queued' });
  });

  it('keeps deletion accepted and retries server-side when the DR marker is temporarily unavailable', async () => {
    const db = makeMockDb();
    const users = makeMockUsers();
    const functions = makeMockFunctions();
    const rows = new Map<string, any>();

    db.getRow.mockImplementation(async ({ tableId, rowId }: any) => {
      const found = rows.get(`${tableId}:${rowId}`);
      if (found) return found;
      throw notFound();
    });
    db.createRow.mockImplementation(async (input: any) => {
      const row = { $id: input.rowId, ...input.data };
      rows.set(`${input.tableId}:${input.rowId}`, row);
      return row;
    });
    db.updateRow.mockImplementation(async (input: any) => {
      const key = `${input.tableId}:${input.rowId}`;
      const row = rows.get(key);
      if (!row) throw notFound();
      Object.assign(row, input.data);
      return row;
    });
    functions.createExecution.mockResolvedValueOnce({
      status: 'completed',
      responseStatusCode: 500,
      responseBody: JSON.stringify({ error: 'marker failed' }),
    });

    const response = await invoke({
      userId: 'alice',
      mockDb: db,
      mockUsers: users,
      mockFunctions: functions,
      body: { action: 'delete_account', confirmation: 'DELETE' },
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      accepted: true,
      deletionPending: true,
    });
    expect(users.updateStatus).toHaveBeenCalledWith({
      userId: 'alice',
      status: false,
    });
    expect(users.deleteSessions).toHaveBeenCalledWith({ userId: 'alice' });
    expect(functions.createExecution).toHaveBeenCalledTimes(2);
    expect(
      [...rows.values()].find((row) => row.user_id === 'alice')
    ).toMatchObject({ status: 'pending' });
    expect(response.logs).toContain(
      'account-deletion: DR marker deferred to worker'
    );
  });

  it('hard-deletes owner and peer records, scrubs references/files, then deletes Auth last', async () => {
    const db = makeMockDb();
    const storage = makeMockStorage();
    const users = makeMockUsers();
    const functions = makeMockFunctions();

    const tables = new Map<string, any[]>([
      ['account_deletions', [{
        $id: 'del_job',
        user_id: 'alice',
        status: 'pending',
        phase: 'queued',
        attempts: 0,
      }]],
      ['profiles', [{
        $id: 'profile_alice',
        user_id: 'alice',
        deleted: true,
        is_searchable: false,
      }]],
      ['tasks', [
        { $id: 'task_alice', user_id: 'alice', reactions: '' },
        {
          $id: 'task_bob',
          user_id: 'bob',
          reactions: JSON.stringify([
            { emoji: '❤️', userIds: ['alice', 'bob'] },
          ]),
        },
      ]],
      ['categories', [{ $id: 'cat_alice', user_id: 'alice' }]],
      ['diary', [{ $id: 'diary_alice', user_id: 'alice' }]],
      ['settings', [
        { $id: 'setting_alice', user_id: 'alice', key: 'theme', value: 'dark' },
        {
          $id: 'setting_bob',
          user_id: 'bob',
          key: 'friend_carousel_prefs',
          value: JSON.stringify({ order: ['alice', 'carol'], hidden: ['alice'] }),
        },
      ]],
      ['friendships', [
        { $id: 'fr_a', user_id: 'alice', friend_id: 'bob' },
        { $id: 'fr_b', user_id: 'bob', friend_id: 'alice' },
      ]],
      ['messages', [
        { $id: 'msg_a', user_id: 'alice', sender_id: 'alice', recipient_id: 'bob' },
        { $id: 'msg_b', user_id: 'bob', sender_id: 'alice', recipient_id: 'bob' },
      ]],
    ]);

    const getTable = (id: string) => tables.get(id) ?? [];
    db.getRow.mockImplementation(async ({ tableId, rowId }: any) => {
      const row = getTable(tableId).find((value) => value.$id === rowId);
      if (!row) throw notFound();
      return row;
    });
    db.listRows.mockImplementation(async ({ tableId, queries }: any) => {
      let rows = [...getTable(tableId)];
      for (const key of [
        'user_id',
        'friend_id',
        'sender_id',
        'recipient_id',
        'key',
        'status',
      ]) {
        const value = queryValue(queries || [], key);
        if (value !== undefined) rows = rows.filter((row) => row[key] === value);
      }
      return { rows };
    });
    db.updateRow.mockImplementation(async (input: any) => {
      const row = getTable(input.tableId).find((value) => value.$id === input.rowId);
      if (!row) throw notFound();
      Object.assign(row, input.data);
      return row;
    });
    db.deleteRow.mockImplementation(async (input: any) => {
      const rows = getTable(input.tableId);
      const index = rows.findIndex((value) => value.$id === input.rowId);
      if (index >= 0) rows.splice(index, 1);
      return {};
    });

    let files = [
      {
        $id: 'img_alice',
        $permissions: [
          'read("users")',
          'update("user:alice")',
          'delete("user:alice")',
        ],
      },
      {
        $id: 'img_bob',
        $permissions: [
          'read("users")',
          'update("user:bob")',
          'delete("user:bob")',
        ],
      },
    ];
    storage.listFiles.mockImplementation(async () => ({ files: [...files] }));
    storage.deleteFile.mockImplementation(async ({ fileId }: any) => {
      files = files.filter((file) => file.$id !== fileId);
      return {};
    });

    const response = await invoke({
      mockDb: db,
      mockStorage: storage,
      mockUsers: users,
      mockFunctions: functions,
      body: { action: 'resume_account_deletion', jobId: 'del_job' },
    });

    expect(response.status).toBe(200);
    expect(getTable('tasks').map((row) => row.$id)).toEqual(['task_bob']);
    expect(JSON.parse(getTable('tasks')[0].reactions)).toEqual([
      { emoji: '❤️', userIds: ['bob'] },
    ]);
    expect(getTable('friendships')).toEqual([]);
    expect(getTable('messages')).toEqual([]);
    expect(JSON.parse(getTable('settings')[0].value)).toEqual({
      order: ['carol'],
      hidden: [],
    });
    expect(files.map((file) => file.$id)).toEqual(['img_bob']);
    expect(users.deleteSessions).toHaveBeenCalledWith({ userId: 'alice' });
    expect(users.delete).toHaveBeenCalledWith({ userId: 'alice' });
    expect(getTable('profiles')).toEqual([]);
    expect(getTable('account_deletions')).toEqual([]);

    const authDeleteOrder = users.delete.mock.invocationCallOrder[0];
    const jobDeleteCall = db.deleteRow.mock.calls.find(
      ([input]: any[]) => input.tableId === 'account_deletions'
    );
    expect(jobDeleteCall).toBeTruthy();
    expect(authDeleteOrder).toBeLessThan(
      db.deleteRow.mock.invocationCallOrder[
        db.deleteRow.mock.calls.indexOf(jobDeleteCall!)
      ]
    );
  });
});
