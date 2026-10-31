import { Permission, Role } from 'appwrite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  rows: vi.fn(),
  file: vi.fn(),
}));
vi.mock('../../src/lib/sdk', () => ({
  guardedAccount: { get: mocks.account },
  guardedTablesDB: { listRows: mocks.rows },
  guardedStorage: { getFile: mocks.file },
}));
import { scanOwnerReferencedCloudMedia } from '../../src/lib/cloudMediaUsage';

const grants = (owner: string) => [
  Permission.read(Role.users()),
  Permission.update(Role.user(owner)),
  Permission.delete(Role.user(owner)),
];

beforeEach(() => {
  mocks.account.mockReset().mockResolvedValue({ $id: 'owner_a' });
  mocks.rows.mockReset().mockImplementation(async ({ tableId }: { tableId: string }) => {
    if (tableId === 'tasks') return { rows: [
      { $id: 'task_1', user_id: 'owner_a', image: 'img_one', deleted: false },
      { $id: 'task_2', user_id: 'owner_a', image: 'localimg_pending', deleted: false },
    ] };
    if (tableId === 'diary') return { rows: [
      { $id: 'diary_1', user_id: 'owner_a', photos: JSON.stringify(['img_one', 'img_two']), deleted: false },
    ] };
    if (tableId === 'settings') return { rows: [
      { $id: 'setting_1', user_id: 'owner_a', key: 'profileImageId', value: 'img_three', deleted: false },
    ] };
    throw new Error('Unexpected table');
  });
  mocks.file.mockReset().mockImplementation(async ({ fileId }: { fileId: string }) => ({
    sizeOriginal: fileId === 'img_one' ? 100 : fileId === 'img_two' ? 50 : 25,
    $permissions: grants('owner_a'),
  }));
});

describe('owner-verified referenced cloud media inventory', () => {
  it('deduplicates media across owner records and separates category sizes', async () => {
    const result = await scanOwnerReferencedCloudMedia('owner_a');
    expect(result.coverage).toBe('referenced-media-only');
    expect(result.verified).toEqual({ count: 3, bytes: 175 });
    expect(result.byKind.multiple).toEqual({ count: 1, bytes: 100 });
    expect(result.byKind.diary).toEqual({ count: 1, bytes: 50 });
    expect(result.byKind.profile).toEqual({ count: 1, bytes: 25 });
    expect(result.unavailable).toBe(0);
    expect(result.truncated).toBe(false);
    expect(mocks.file).toHaveBeenCalledTimes(3);
    expect(mocks.rows).toHaveBeenCalledTimes(3);
    expect(mocks.rows.mock.calls.every(([args]) =>
      args.queries.some((query: string) => query.includes('owner_a')))).toBe(true);
  });

  it('never counts another user\'s readable but non-owner-controlled file', async () => {
    mocks.file.mockImplementation(async () => ({
      sizeOriginal: 3000,
      $permissions: grants('owner_b'),
    }));
    const result = await scanOwnerReferencedCloudMedia('owner_a');
    expect(result.verified).toEqual({ count: 0, bytes: 0 });
    expect(result.unavailable).toBe(3);
    expect(result.largest).toEqual([]);
  });

  it('fails closed on account change or unexpected owner data', async () => {
    mocks.account.mockResolvedValueOnce({ $id: 'owner_b' });
    await expect(scanOwnerReferencedCloudMedia('owner_a')).rejects.toThrow('Account changed');
    expect(mocks.file).not.toHaveBeenCalled();
    mocks.account.mockReset().mockResolvedValue({ $id: 'owner_a' });
    mocks.rows.mockResolvedValueOnce({ rows: [
      { $id: 'task_b', user_id: 'owner_c', image: 'img_foreign', deleted: false },
    ] });
    await expect(scanOwnerReferencedCloudMedia('owner_a')).rejects.toThrow('ownership');
    expect(mocks.file).not.toHaveBeenCalled();
  });

  it('reports inaccessible metadata as incomplete without exposing its file identity', async () => {
    mocks.file.mockRejectedValue(new Error('offline'));
    const result = await scanOwnerReferencedCloudMedia('owner_a');
    expect(result.verified.count).toBe(0);
    expect(result.unavailable).toBe(3);
    expect(result.largest).toEqual([]);
  });

  it('does not continue requesting metadata after a session is cancelled during a page', async () => {
    const controller = new AbortController();
    let release!: (value: { rows: Array<Record<string, unknown>> }) => void;
    const blockedPage = new Promise<{ rows: Array<Record<string, unknown>> }>((resolve) => {
      release = resolve;
    });
    mocks.rows.mockImplementationOnce(() => blockedPage);
    const scan = scanOwnerReferencedCloudMedia('owner_a', controller.signal);
    await vi.waitFor(() => expect(mocks.rows).toHaveBeenCalledTimes(1));
    controller.abort();
    release({ rows: [{ $id: 'task_1', user_id: 'owner_a', image: 'img_one' }] });
    await expect(scan).rejects.toThrow('cancelled');
    expect(mocks.rows).toHaveBeenCalledTimes(1);
    expect(mocks.file).not.toHaveBeenCalled();
  });

  it('revalidates the session before scanning additional account tables', async () => {
    mocks.account.mockResolvedValueOnce({ $id: 'owner_a' })
      .mockResolvedValueOnce({ $id: 'owner_a' })
      .mockResolvedValueOnce({ $id: 'owner_b' });
    await expect(scanOwnerReferencedCloudMedia('owner_a')).rejects.toThrow('Account changed');
    expect(mocks.rows).toHaveBeenCalledTimes(1);
    expect(mocks.file).not.toHaveBeenCalled();
  });

  it('does not schedule further file metadata requests after cancellation', async () => {
    mocks.rows.mockImplementation(async ({ tableId }: { tableId: string }) =>
      ({ rows: tableId === 'tasks' ? Array.from({ length: 8 }, (_, i) => ({
        $id: `task_${i}`, user_id: 'owner_a', image: `img_${i}`, deleted: false,
      })) : [] }));
    const releases: Array<(value: { sizeOriginal: number; $permissions: string[] }) => void> = [];
    mocks.file.mockImplementation(() => new Promise(resolve => {
      releases.push(resolve);
    }));
    const controller = new AbortController();
    const scan = scanOwnerReferencedCloudMedia('owner_a', controller.signal);
    await vi.waitFor(() => expect(mocks.file).toHaveBeenCalledTimes(4));
    controller.abort();
    for (const release of releases) release({ sizeOriginal: 100, $permissions: grants('owner_a') });
    await expect(scan).rejects.toThrow('cancelled');
    expect(mocks.file).toHaveBeenCalledTimes(4);
  });

  it('rejects an unknown account before contacting Appwrite', async () => {
    await expect(scanOwnerReferencedCloudMedia('')).rejects.toThrow('requires an owner');
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.rows).not.toHaveBeenCalled();
  });
});
