import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  owner: 'owner_a', current: true,
  lookup: vi.fn(), links: vi.fn(), insert: vi.fn(), patch: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({
  user: { $id: fixture.owner }, isLocalOwnerCurrent: () => fixture.current,
}) }));
vi.mock('../../src/hooks/useRxCollection', () => ({
  useRxCollection: () => ({ data: {}, isLoading: false }),
}));
vi.mock('../../src/db/database', () => ({ getDatabase: () => {
  const collection = {
    findOne: () => ({ exec: fixture.lookup }),
    find: () => ({ exec: fixture.links }), insert: fixture.insert,
  };
  return { settings: collection, bucketList: collection, bucketTaskLinks: collection, tasks: collection };
} }));

import { useSettings } from '../../src/hooks/useSettings';
import { useBucketList } from '../../src/hooks/useBucketList';
import { useBucketTaskLinks } from '../../src/hooks/useBucketTaskLinks';

const row = () => ({ id: 'row', userId: 'owner_a', key: 'theme',
  bucketListId: 'bucket', taskId: 'task', isDeleted: false,
  achieved: false, incrementalPatch: fixture.patch });

describe('personal Settings and Bucket local owner fences', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fixture.owner = 'owner_a'; fixture.current = true;
    fixture.lookup.mockImplementation(async () => row());
    fixture.links.mockResolvedValue([]);
    fixture.insert.mockResolvedValue(undefined);
    fixture.patch.mockResolvedValue(undefined);
  });

  it.each(['settings', 'edit', 'achieve', 'delete', 'link'] as const)(
    'blocks %s when the account switches during an awaited read', async action => {
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      fixture.lookup.mockImplementationOnce(async () => { await pending; return row(); });
      const hook = renderHook(() => ({
        settings: useSettings(), buckets: useBucketList(), links: useBucketTaskLinks(),
      }));
      const value = hook.result.current;
      const write = action === 'settings' ? value.settings.setSetting('theme', 'dark')
        : action === 'edit' ? value.buckets.editItem('bucket', 'changed', '')
        : action === 'achieve' ? value.buckets.setAchieved('bucket', true)
        : action === 'delete' ? value.buckets.deleteItem('bucket')
        : value.links.setLinked('bucket', 'task', true);
      fixture.owner = 'owner_b';
      hook.rerender();
      await act(async () => {
        release();
        await expect(write).rejects.toThrow('Account changed');
      });
      expect(fixture.patch).not.toHaveBeenCalled();
      expect(fixture.insert).not.toHaveBeenCalled();
    },
  );

  it('blocks stale callbacks after unmount and cross-tab revocation before rerender', async () => {
    const hook = renderHook(() => ({ buckets: useBucketList(), settings: useSettings() }));
    const stale = hook.result.current;
    fixture.current = false;
    await expect(stale.buckets.createItem('stale')).rejects.toThrow('Account changed');
    await expect(stale.settings.setSetting('theme', 'dark')).rejects.toThrow('Account changed');
    fixture.current = true;
    hook.unmount();
    await expect(stale.buckets.createItem('unmounted')).rejects.toThrow('Account changed');
    expect(fixture.patch).not.toHaveBeenCalled();
    expect(fixture.insert).not.toHaveBeenCalled();
  });

  it.each([{ userId: 'owner_b' }, { key: 'profileImageId' }])(
    'refuses a Settings ID collision without rewriting its owner or key: %j', async change => {
      fixture.lookup.mockResolvedValue({ ...row(), ...change });
      const hook = renderHook(() => useSettings());
      await expect(hook.result.current.setSetting('theme', 'dark')).rejects.toThrow('collision');
      expect(fixture.patch).not.toHaveBeenCalled();
    },
  );

  it('retains same-owner Settings create, update and concurrent insert recovery', async () => {
    const hook = renderHook(() => useSettings());
    await hook.result.current.setSetting('theme', 'dark');
    expect(fixture.patch).toHaveBeenCalledWith(expect.objectContaining({ value: 'dark' }));
    fixture.lookup.mockResolvedValueOnce(null);
    await hook.result.current.setSetting('theme', 'light');
    expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner_a', key: 'theme' }));
    fixture.lookup.mockResolvedValueOnce(null);
    fixture.insert.mockRejectedValueOnce(new Error('conflict'));
    await hook.result.current.setSetting('theme', 'black');
    expect(fixture.patch).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'black' }));
  });

  it('does not resume a raced Settings insert after the account is revoked', async () => {
    fixture.lookup.mockResolvedValueOnce(null);
    fixture.insert.mockImplementationOnce(async () => {
      fixture.current = false;
      throw new Error('conflict');
    });
    const hook = renderHook(() => useSettings());
    await expect(hook.result.current.setSetting('theme', 'dark')).rejects.toThrow('Account changed');
    expect(fixture.patch).not.toHaveBeenCalled();
  });

  it('stops relationship cleanup after an already-dispatched Bucket deletion changes accounts', async () => {
    fixture.patch.mockImplementationOnce(async () => { fixture.current = false; });
    fixture.links.mockResolvedValue([{ ...row() }]);
    const hook = renderHook(() => useBucketList());
    await expect(hook.result.current.deleteItem('bucket')).rejects.toThrow('Account changed');
    expect(fixture.patch).toHaveBeenCalledTimes(1);
    expect(fixture.patch).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: true }));
  });

  it('preserves owned Bucket edits and refuses foreign task unlinking', async () => {
    const hook = renderHook(() => ({ buckets: useBucketList(), links: useBucketTaskLinks() }));
    await hook.result.current.buckets.editItem('bucket', 'safe', 'notes');
    await hook.result.current.buckets.setAchieved('bucket', true);
    expect(fixture.patch).toHaveBeenCalledTimes(2);
    fixture.lookup.mockResolvedValueOnce(row()).mockResolvedValueOnce({ ...row(), userId: 'owner_b' });
    await expect(hook.result.current.links.setLinked('bucket', 'task', false)).rejects.toThrow('no longer available');
    expect(fixture.patch).toHaveBeenCalledTimes(2);
  });
});
