import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PREVIEW_IDENTITIES, runPreviewSeed, seedPreviewFixtures } from '../../scripts/appwrite-preview-seed.mjs';
const password = 'synthetic-long-test-password';
const missing = Object.assign(new Error('not found'), { code: 404 });
function services() {
  return {
    users: { get: vi.fn().mockRejectedValue(missing), create: vi.fn().mockResolvedValue({}) },
    tablesDB: { getRow: vi.fn().mockRejectedValue(missing), createRow: vi.fn().mockResolvedValue({}) },
  };
}
describe('scratch reusable synthetic accounts', () => {
  it('creates three isolated accounts and canonical private friendship fixtures', async () => {
    const mock = services();
    const log = vi.fn();
    const result = await seedPreviewFixtures({ ...mock, password, log, now: '2026-10-08T00:00:00Z' });
    expect(result).toEqual({ users: 3, rows: 16 });
    expect(mock.users.create).toHaveBeenCalledTimes(3);
    const created = mock.users.create.mock.calls.map(call => call[0]);
    expect(created.map((user: {userId: string}) => user.userId)).toEqual(PREVIEW_IDENTITIES.map(x => x.id));
    expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'diary', data: expect.objectContaining({ created_at: '2026-10-08T00:00:00Z' }),
    }));
    expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'categories', data: expect.objectContaining({ visibility: 'followers' }),
    }));
    expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'tasks', data: expect.objectContaining({ visibility: 'followers' }),
    }));
    for (const user of PREVIEW_IDENTITIES) {
      expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
        tableId: 'profiles', rowId: 'profile_' + user.id,
        data: expect.objectContaining({ user_id: user.id }),
      }));
    }
    for (const friend of PREVIEW_IDENTITIES.slice(1)) {
      for (const [user, peer] of [[PREVIEW_IDENTITIES[0], friend], [friend, PREVIEW_IDENTITIES[0]]]) {
        const friendshipId = 'fr_' + createHash('sha256')
          .update(user.id + '|' + peer.id).digest('hex').slice(0, 32);
        expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
          tableId: 'friendships', rowId: friendshipId,
          data: expect.objectContaining({ user_id: user.id, friend_id: peer.id, status: 'accepted' }),
        }));
      }
    }
    const friendships = mock.tablesDB.createRow.mock.calls
      .map(call => call[0]).filter(row => row.tableId === 'friendships');
    expect(friendships).toHaveLength(4);
    for (const row of friendships) {
      expect(row.permissions).toEqual([`read("user:${row.data.user_id}")`]);
    }
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
  });
  it('is idempotent and does not reset existing account passwords or overwrite rows', async () => {
    const mock = services();
    mock.users.get.mockImplementation(async ({userId}: {userId:string}) =>
      ({ email: PREVIEW_IDENTITIES.find(x => x.id === userId)!.email }));
    mock.tablesDB.getRow.mockImplementation(async ({rowId, tableId}: {rowId:string; tableId:string}) => {
      const identity = PREVIEW_IDENTITIES.find(user => {
        if (tableId !== 'friendships') return rowId.endsWith(user.id);
        return PREVIEW_IDENTITIES.some(peer => peer.id !== user.id &&
          (user.id === PREVIEW_IDENTITIES[0].id || peer.id === PREVIEW_IDENTITIES[0].id) &&
          rowId === 'fr_' + createHash('sha256')
            .update(user.id + '|' + peer.id).digest('hex').slice(0, 32));
      });
      if (!identity) throw missing;
      return { data: { user_id: identity.id } };
    });
    const result = await seedPreviewFixtures({ ...mock, password, log: vi.fn() });
    expect(result).toEqual({ users: 0, rows: 0 });
    expect(mock.users.create).not.toHaveBeenCalled();
    expect(mock.tablesDB.createRow).not.toHaveBeenCalled();
  });
  it('refuses different-owner fixture collisions and weak or missing passwords', async () => {
    const mock = services();
    await expect(seedPreviewFixtures({ ...mock, password: '' })).rejects.toThrow(/12 characters/);
    mock.tablesDB.getRow.mockResolvedValue({ data: { user_id: 'not_fixture_owner' } });
    await expect(seedPreviewFixtures({ ...mock, password, log: vi.fn() })).rejects.toThrow(/owner mismatch/);
  });
  it('cannot write to an implicit or different Appwrite project', async () => {
    const mock = services();
    await expect(runPreviewSeed({
      argv: ['--project', 'production', '--endpoint', 'https://sgp.cloud.appwrite.io/v1', '--confirm-project','production'],
      env: { APPWRITE_API_KEY: 'key', MOSAIC_SCRATCH_TEST_PASSWORD: password },
      services: mock,
    })).rejects.toThrow(/scratch/);
    expect(mock.users.create).not.toHaveBeenCalled();
  });
});
