import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), creationEnabled: true }));
vi.mock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { $id: 'ownerA' } }) }));
vi.mock('../../src/hooks/useRxCollection', () => ({ useRxCollection: () => ({ data: [], isLoading: false }) }));
vi.mock('../../src/db/database', () => ({ getDatabase: () => ({ bucketList: { insert: mocks.insert } }) }));
vi.mock('../../src/lib/featureControls', () => ({ isFeatureEnabled: () => mocks.creationEnabled }));

import { useBucketList } from '../../src/hooks/useBucketList';

describe('Bucket List creation operational control', () => {
  beforeEach(() => {
    mocks.creationEnabled = true;
    mocks.insert.mockReset().mockResolvedValue(undefined);
  });

  it('rejects a stale create action without touching existing rows, and restores creation when enabled', async () => {
    const { result } = renderHook(() => useBucketList());
    mocks.creationEnabled = false;
    await expect(result.current.createItem('See the sea')).rejects.toThrow('temporarily unavailable');
    expect(mocks.insert).not.toHaveBeenCalled();
    mocks.creationEnabled = true;
    await result.current.createItem('See the sea');
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'ownerA', title: 'See the sea', achieved: false, isDeleted: false }));
  });
});
