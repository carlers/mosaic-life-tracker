import { describe, expect, it } from 'vitest';
import { compareFeaturePresence, featurePresence, formatFeatureParity } from '../../scripts/lib/build-feature-parity.mjs';

describe('effective Vercel build feature scopes', () => {
  const shared = [
    { key: 'VITE_APPWRITE_PROJECT_ID', target: ['preview'] },
    { key: 'VITE_APPWRITE_ENDPOINT', target: ['preview'] },
    { key: 'VITE_GIPHY_API_KEY', target: ['preview'], gitBranch: 'dev' },
  ];
  it('fails for the observed same-tree GIPHY scope mismatch without reading values', () => {
    const result = compareFeaturePresence(shared, 'feature/backlog-dev-407');
    expect(result).toMatchObject({
      passed: false,
      mismatches: [{ feature: 'GIPHY stickers', sourceEnabled: false, targetEnabled: true }],
    });
    expect(formatFeatureParity(result)).toContain('scope parity failed');
    expect(formatFeatureParity(result)).not.toContain('api_key');
  });
  it('accepts generic shared Preview feature configuration and matching branch overrides', () => {
    const global = [{ key: 'VITE_GIPHY_API_KEY', target: ['preview'] }];
    expect(compareFeaturePresence([...shared, ...global], 'feature/example').passed).toBe(true);
    expect(compareFeaturePresence([
      ...shared,
      { key: 'VITE_GIPHY_API_KEY', target: ['preview'], gitBranch: 'feature/example' },
    ], 'feature/example').passed).toBe(true);
  });
  it('distinguishes intentional Production target and ignores unrelated backend/analytics scope', () => {
    const result = compareFeaturePresence(shared, 'feature/example');
    expect(result.mismatches).toHaveLength(1);
    expect(featurePresence(shared, 'main', 'production')).toEqual({ 'GIPHY stickers': false });
    expect(compareFeaturePresence([], 'feature/example').passed).toBe(true);
  });
  it('fails closed on missing metadata or unspecified branches', () => {
    expect(() => compareFeaturePresence(undefined, 'feature/example')).toThrow(/metadata/);
    expect(() => featurePresence([], '')).toThrow(/Branch/);
  });
});
