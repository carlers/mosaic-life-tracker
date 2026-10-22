import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/coreBackendConfig', () => ({
  CORE_BACKEND: { driver: 'supabase', baseUrl: 'http://127.0.0.1:54321', publishableKey: 'sb_publishable_test' },
}));
vi.mock('../../src/db/sync', () => ({
  refreshSync: vi.fn(() => { throw new Error('Appwrite refresh called'); }),
  forceSync: vi.fn(() => { throw new Error('Appwrite sync called'); }),
  syncNow: vi.fn(() => { throw new Error('Appwrite sync called'); }),
}));

import {
  registerCoreSync, assertPersonalImportOwner, refreshPersonalImport,
} from '../../src/lib/appSync';

describe('Supabase personal import fresh signed-owner barrier', () => {
  let unregister: (() => void) | undefined;
  afterEach(() => { unregister?.(); unregister = undefined; });

  it('refuses imports without an active registered signed Supabase owner', async () => {
    await expect(refreshPersonalImport('owner_A')).rejects.toThrow(/verified sync session/);
    await expect(assertPersonalImportOwner('owner_A')).rejects.toThrow(/verified signed account/);
  });

  it('rejects cross-owner import access before any mutation', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const assertOwner = vi.fn().mockResolvedValue(undefined);
    unregister = registerCoreSync('owner_A', vi.fn(), { refresh, assertOwner });
    await expect(refreshPersonalImport('owner_B')).rejects.toThrow(/verified sync session/);
    await expect(assertPersonalImportOwner('owner_B')).rejects.toThrow(/verified signed account/);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reports freshness only after signed owner and real provider barrier resolve', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const assertOwner = vi.fn().mockResolvedValue(undefined);
    unregister = registerCoreSync('owner_A', vi.fn(), { refresh, assertOwner });
    const result = await refreshPersonalImport('owner_A');
    expect(result.status).toMatchObject({ isSyncing: false, errors: [] });
    expect(Date.parse(result.status.lastSync!)).toBeGreaterThanOrEqual(result.startedAt);
    expect(refresh).toHaveBeenCalledOnce();
    expect(assertOwner).toHaveBeenCalledTimes(2);
  });

  it('refuses false freshness on a failed signed provider barrier', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('native replication conflict'));
    unregister = registerCoreSync('owner_A', vi.fn(), {
      refresh, assertOwner: vi.fn().mockResolvedValue(undefined),
    });
    await expect(refreshPersonalImport('owner_A')).rejects.toThrow(/replication conflict/);
  });

  it('refuses stale owner registration after mid-barrier account change', async () => {
    let finish!: () => void;
    unregister = registerCoreSync('owner_A', vi.fn(), {
      assertOwner: vi.fn().mockResolvedValue(undefined),
      refresh: () => new Promise<void>(resolve => { finish = resolve; }),
    });
    const pending = refreshPersonalImport('owner_A');
    await vi.waitFor(() => expect(finish).toBeDefined());
    unregister();
    unregister = registerCoreSync('owner_B', vi.fn(), {
      assertOwner: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    finish();
    await expect(pending).rejects.toThrow(/Signed account changed/);
  });
});
