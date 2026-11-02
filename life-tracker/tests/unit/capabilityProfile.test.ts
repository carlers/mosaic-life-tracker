import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('immutable build capability ceiling', () => {
  it('keeps core and disables social in core-only builds', async () => {
    vi.stubEnv('VITE_MOSAIC_CAPABILITY_PROFILE', 'core-only');
    vi.resetModules();
    const p = await import('../../src/lib/capabilityProfile');
    expect(p.BUILD_PROVIDER).toBe('appwrite');
    expect(p.BUILD_CAPABILITY_PROFILE).toBe('core-only');
    for (const key of p.CAPABILITY_KEYS) {
      expect(p.isBuildCapabilityAvailable(key)).toBe(key.startsWith('core.'));
    }
  });
  it('fails closed for unknown profiles', async () => {
    vi.stubEnv('VITE_MOSAIC_CAPABILITY_PROFILE', 'not-supported');
    vi.resetModules();
    const p = await import('../../src/lib/capabilityProfile');
    expect(p.isBuildCapabilityAvailable('social.chat')).toBe(false);
    expect(p.isBuildCapabilityAvailable('core.sync')).toBe(true);
  });
  it('preserves normal full Appwrite support', async () => {
    vi.stubEnv('VITE_MOSAIC_CAPABILITY_PROFILE', '');
    vi.resetModules();
    const p = await import('../../src/lib/capabilityProfile');
    expect(p.BUILD_CAPABILITY_PROFILE).toBe('full');
    expect(p.isBuildCapabilityAvailable('social.chat')).toBe(true);
  });
});
