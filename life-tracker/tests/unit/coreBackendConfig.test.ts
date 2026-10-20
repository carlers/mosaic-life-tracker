import { describe, expect, it } from 'vitest';
import { resolveCoreBackendConfig } from '../../src/lib/coreBackendConfig';

describe('explicit core backend selection', () => {
  it('preserves the default Appwrite backend', () => {
    expect(resolveCoreBackendConfig({})).toEqual({ driver: 'appwrite' });
  });

  it('requires a core-only profile and public credentials for Supabase', () => {
    const valid = {
      VITE_MOSAIC_BACKEND: 'supabase-cloud',
      VITE_MOSAIC_FEATURE_PROFILE: 'core-only',
      VITE_SUPABASE_URL: 'https://hcxtiifzxoaflhjgoglb.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_disposable',
    };
    expect(resolveCoreBackendConfig(valid).driver).toBe('supabase');
    expect(() => resolveCoreBackendConfig({ ...valid, VITE_MOSAIC_FEATURE_PROFILE: 'full' })).toThrow();
    expect(() => resolveCoreBackendConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' })).toThrow();
    expect(() => resolveCoreBackendConfig({ ...valid, VITE_SUPABASE_URL: 'https://production.supabase.co' })).toThrow();
    expect(() => resolveCoreBackendConfig({ ...valid, VITE_SUPABASE_URL: 'http://public.example' })).toThrow();
    expect(() => resolveCoreBackendConfig({ VITE_MOSAIC_BACKEND: 'unknown' })).toThrow();
  });
});
