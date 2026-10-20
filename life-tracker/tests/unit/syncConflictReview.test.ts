import { describe, expect, it, vi } from 'vitest';
import { getSyncConflicts, registerSyncConflictReview, resolveSyncConflict,
  type SyncConflict } from '../../src/lib/syncConflictReview';

const conflict: SyncConflict = {
  domain: 'tasks', documentId: 'task_1', title: 'Private draft',
  revision: '7', canKeepLocal: true,
  fields: [{ label: 'Completed', local: 'Yes', remote: 'No' }],
};
describe('current-owner sync conflict decisions', () => {
  it('hides other accounts and rejects stale snapshots before dispatch', async () => {
    const actions = { refresh: vi.fn(), keepLocal: vi.fn() };
    const a = registerSyncConflictReview('owner_a', actions);
    a.publish([conflict]);
    const first = getSyncConflicts('owner_a')[0];
    expect(getSyncConflicts('owner_b')).toEqual([]);
    expect(getSyncConflicts(undefined)).toEqual([]);
    await expect(resolveSyncConflict('owner_b', first, 'keepLocal')).rejects.toThrow('changed');
    a.publish([{ ...conflict, revision: '8' }]);
    await expect(resolveSyncConflict('owner_a', first, 'keepLocal')).rejects.toThrow('changed');
    expect(actions.keepLocal).not.toHaveBeenCalled();
    await resolveSyncConflict('owner_a', getSyncConflicts('owner_a')[0], 'keepLocal');
    expect(actions.keepLocal).toHaveBeenCalledWith(expect.objectContaining({ revision: '8' }));
    a.unregister();
  });
  it('does not let a late publisher/cleanup overwrite a new owner or acknowledge its result', async () => {
    let finish!: () => void;
    const a = registerSyncConflictReview('owner_a', {
      refresh: vi.fn(), keepLocal: () => new Promise(resolve => { finish = resolve; }),
    });
    a.publish([conflict]);
    const pending = resolveSyncConflict('owner_a', getSyncConflicts('owner_a')[0], 'keepLocal');
    const b = registerSyncConflictReview('owner_b', { refresh: vi.fn(), keepLocal: vi.fn() });
    b.publish([{ ...conflict, title: 'Other draft' }]);
    a.publish([conflict]);
    a.unregister();
    finish();
    await expect(pending).rejects.toThrow('account changed');
    expect(getSyncConflicts('owner_a')).toEqual([]);
    expect(getSyncConflicts('owner_b')[0].title).toBe('Other draft');
    b.unregister();
  });
  it('never applies a missing or protected cloud version', async () => {
    const actions = { refresh: vi.fn(), keepLocal: vi.fn() };
    const a = registerSyncConflictReview('owner_a', actions);
    a.publish([{ ...conflict, canKeepLocal: false, revision: null }]);
    await expect(resolveSyncConflict('owner_a', getSyncConflicts('owner_a')[0], 'keepLocal'))
      .rejects.toThrow('changed');
    expect(actions.keepLocal).not.toHaveBeenCalled();
    a.unregister();
  });
});
