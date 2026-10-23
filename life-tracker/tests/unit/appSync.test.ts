import { afterEach, describe, expect, it, vi } from 'vitest';

const appwrite = vi.hoisted(() => ({ forceSync: vi.fn(), syncNow: vi.fn() }));
vi.mock('../../src/db/sync', () => appwrite);
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });

describe('provider-neutral app refresh', () => {
  it('preserves automatic and manual Appwrite refresh', async () => {
    const { requestAppSync } = await import('../../src/lib/appSync');
    await requestAppSync('owner');
    await requestAppSync('owner', true);
    expect(appwrite.forceSync).toHaveBeenCalledWith('owner');
    expect(appwrite.syncNow).toHaveBeenCalledWith('owner');
  });

  it('never falls back to Appwrite for inactive, foreign or disposed Supabase sessions', async () => {
    vi.stubEnv('VITE_MOSAIC_BACKEND', 'supabase-cloud');
    vi.stubEnv('VITE_MOSAIC_FEATURE_PROFILE', 'core-only');
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    const { registerCoreSync, requestAppSync } = await import('../../src/lib/appSync');
    await expect(requestAppSync('owner')).rejects.toThrow();
    const resync = vi.fn().mockResolvedValue(undefined);
    const verify = vi.fn().mockResolvedValue(undefined);
    const dispose = registerCoreSync('owner', resync, { verify });
    await expect(requestAppSync('foreign')).rejects.toThrow();
    await requestAppSync('owner');
    await requestAppSync('owner', true);
    expect(resync).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(1);
    dispose();
    const unverified = registerCoreSync('owner', resync);
    await expect(requestAppSync('owner', true)).rejects.toThrow(/verification is unavailable/);
    unverified();
    await expect(requestAppSync('owner')).rejects.toThrow();
    expect(appwrite.forceSync).not.toHaveBeenCalled();
    expect(appwrite.syncNow).not.toHaveBeenCalled();
  });
});
