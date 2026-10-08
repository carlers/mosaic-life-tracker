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
  it('creates only two named users and owned fixture rows without production data', async () => {
    const mock = services();
    const log = vi.fn();
    const result = await seedPreviewFixtures({ ...mock, password, log, now: '2026-10-08T00:00:00Z' });
    expect(result).toEqual({ users: 2, rows: 10 });
    expect(mock.users.create).toHaveBeenCalledTimes(2);
    const created = mock.users.create.mock.calls.map(call => call[0]);
    expect(created.map((user: {userId: string}) => user.userId)).toEqual(PREVIEW_IDENTITIES.map(x => x.id));
    expect(mock.tablesDB.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'diary', data: expect.objectContaining({ created_at: '2026-10-08T00:00:00Z' }),
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
  });
  it('is idempotent and does not reset existing account passwords or overwrite rows', async () => {
    const mock = services();
    mock.users.get.mockImplementation(async ({userId}: {userId:string}) =>
      ({ email: PREVIEW_IDENTITIES.find(x => x.id === userId)!.email }));
    mock.tablesDB.getRow.mockImplementation(async ({rowId}: {rowId:string}) => {
      const identity = PREVIEW_IDENTITIES.find(x => rowId.endsWith(x.id))!;
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
