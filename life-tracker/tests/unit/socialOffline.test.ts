import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn(), upsert: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('../../src/lib/messageDelivery', () => ({ sendMessageAction: mocks.send }));
vi.mock('../../src/lib/friendCache', () => ({ clearCachedCalendar: vi.fn() }));
vi.mock('../../src/lib/sdk', () => ({ guardedTablesDB: { updateRow: mocks.update, createRow: mocks.create } }));
vi.mock('../../src/db/database', () => ({ getDatabase: () => ({ friendships: {
  upsert: mocks.upsert, insert: mocks.upsert, findOne: (...args: unknown[]) => ({ exec: () => mocks.find(...args) }),
} }) }));
import { sendFriendRequest, acceptFriendRequest, createOrUpdateProfile } from '../../src/lib/social';
import { executeFriendshipCommand, flushFriendshipCommands, scopeFriendshipCommands, pendingFriendshipCount,
  subscribeFriendshipFailures, migrateLegacyFriendship } from '../../src/lib/friendshipCommands';
import { getSocialOutboxSize } from '../../src/lib/socialOutbox';
import { createHash } from 'node:crypto';
const input = { myUserId: 'alice', myUsername: 'alice', myDisplayName: 'Alice', myAvatarFileId: '', myBio: '',
  friend: { $id: 'profile_bob', user_id: 'bob', username: 'bob', display_name: 'Bob', avatar_file_id: '', bio: '', is_searchable: true } };
const row = { $id: 'fr_test', user_id: 'alice', friend_id: 'bob', friend_username: 'bob', status: 'pending_outgoing',
  created_at: '2026-09-28T00:00:00.000Z', updated_at: '2026-09-28T00:00:00.000Z', deleted: false };
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  vi.resetAllMocks(); scopeFriendshipCommands('alice');
  mocks.find.mockResolvedValue(null); mocks.send.mockResolvedValue({ ok: true, row });
});
describe('friendship command delivery', () => {
  it('queues offline intent without writing a phantom local relationship', async () => {
    mocks.send.mockRejectedValue(new Error('Offline'));
    expect(await sendFriendRequest(input)).toEqual({ status: 'queued' });
    expect(pendingFriendshipCount('alice')).toBe(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.send.mockResolvedValue({ ok: true, row });
    await flushFriendshipCommands('alice');
    expect(pendingFriendshipCount('alice')).toBe(0);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', status: 'pending_outgoing' }));
  });
  it('sends an authenticated command rather than a raw row write', async () => {
    expect(await sendFriendRequest(input)).toEqual({ status: 'applied' });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ action: 'friendship', ownerId: 'alice', friendUserId: 'bob', operation: 'send', expectedVersion: null }));
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('surfaces permanent failures without reporting success or changing the cache', async () => {
    mocks.send.mockRejectedValue(Object.assign(new Error('Blocked'), { code: 403 }));
    const listener = vi.fn(); const stop = subscribeFriendshipFailures(listener);
    await expect(sendFriendRequest(input)).rejects.toThrow('Blocked');
    expect(listener).toHaveBeenCalledWith('alice', 'Blocked'); stop();
    expect(pendingFriendshipCount()).toBe(0); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('accept waits for the server and carries the observed relationship version', async () => {
    mocks.find.mockResolvedValue({ updatedAt: 'version' });
    mocks.send.mockRejectedValue(new Error('Offline'));
    expect(await acceptFriendRequest('alice', 'bob')).toEqual({ status: 'queued' });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ operation: 'accept', expectedVersion: 'version' }));
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('serializes cancellation behind an uncertain send, using its confirmed version', async () => {
    mocks.send.mockRejectedValue(new Error('Offline'));
    await sendFriendRequest(input);
    await executeFriendshipCommand('alice', 'bob', 'cancel');
    mocks.send.mockClear(); mocks.send.mockResolvedValue({ ok: true, row });
    await flushFriendshipCommands('alice');
    expect(mocks.send.mock.calls.map(([x]) => x.operation)).toEqual(['send', 'cancel']);
    expect(mocks.send.mock.calls[1][0].expectedVersion).toBe(row.updated_at);
    expect(pendingFriendshipCount()).toBe(0);
  });
  it('does not rebase dependent cancellation when send has become stale', async () => {
    mocks.send.mockRejectedValue(new Error('Offline'));
    await sendFriendRequest(input); await executeFriendshipCommand('alice', 'bob', 'cancel');
    mocks.send.mockClear(); mocks.send.mockRejectedValue(Object.assign(new Error('Changed'), { code: 409 }));
    await flushFriendshipCommands('alice');
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(pendingFriendshipCount()).toBe(0);
  });
  it('ignores in-flight responses after account switching and never dispatches another account queue', async () => {
    let resolve!: (v: unknown) => void;
    mocks.send.mockImplementation(() => new Promise(r => { resolve = r; }));
    const sending = sendFriendRequest(input);
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalled());
    scopeFriendshipCommands('bob'); resolve({ ok: true, row });
    await expect(sending).rejects.toThrow('Account changed');
    expect(mocks.upsert).not.toHaveBeenCalled();
    await flushFriendshipCommands('alice'); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('drops exhausted retries visibly without reverting server state', async () => {
    mocks.send.mockRejectedValue(new Error('Offline'));
    const listener = vi.fn(); const stop = subscribeFriendshipFailures(listener);
    await sendFriendRequest(input);
    for (let i = 0; i < 4; i++) await flushFriendshipCommands('alice');
    expect(pendingFriendshipCount()).toBe(0); expect(listener).toHaveBeenCalledTimes(1); stop();
  });
  it('migrates only verifiable legacy sends and rejects identity-free legacy updates', async () => {
    const rowId = 'fr_' + createHash('sha256').update('bob|alice').digest('hex').slice(0, 32);
    await migrateLegacyFriendship({ userId: 'alice', action: 'send_request', enqueuedAt: new Date().toISOString(),
      op: { rowId, data: { user_id: 'bob', friend_id: 'alice', status: 'pending_incoming' } } });
    expect(pendingFriendshipCount()).toBe(1);
    await expect(migrateLegacyFriendship({ userId: 'alice', action: 'accept_friend_request', enqueuedAt: new Date().toISOString(),
      op: { rowId, data: { status: 'accepted' } } })).rejects.toThrow('fresh retry');
  });
});
describe('profile persistence', () => {
  const profile = { userId: 'alice', username: 'alice', displayName: 'Alice' };
  it('queues transient failure and reports offline', async () => {
    mocks.update.mockRejectedValue(new Error('Offline'));
    await expect(createOrUpdateProfile(profile)).rejects.toMatchObject({ name: 'OfflineError' });
    expect(getSocialOutboxSize('alice')).toBe(1);
  });
  it('updates existing profiles and only creates on 404', async () => {
    mocks.update.mockResolvedValue({ username: 'alice' });
    expect(await createOrUpdateProfile(profile)).toMatchObject({ username: 'alice' });
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.update.mockRejectedValue(Object.assign(new Error('Missing'), { code: 404 }));
    mocks.create.mockResolvedValue({ username: 'alice' });
    await createOrUpdateProfile(profile); expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('does not queue permanent profile failures', async () => {
    mocks.update.mockRejectedValue(Object.assign(new Error('Forbidden'), { code: 403 }));
    await expect(createOrUpdateProfile(profile)).rejects.toThrow('Forbidden');
    expect(getSocialOutboxSize()).toBe(0);
  });
});
