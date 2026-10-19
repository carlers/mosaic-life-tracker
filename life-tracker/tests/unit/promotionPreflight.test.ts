import { describe, expect, it } from 'vitest';
import { evaluatePromotionPreflight } from '../../scripts/lib/promotion-preflight.mjs';

const base = () => ({
  targetBranch: 'dev', targetSha: 'dev123', expectedTargetSha: 'dev123', latestTargetSha: 'dev123',
  sourceBranch: 'feature/example', sourceSha: 'preview456', latestSourceSha: 'preview456',
  sourceTree: 'tree789', mergedTree: 'tree789', mergeConflict: false,
  checkRuns: [{ name: 'canonical-acceptance', head_sha: 'preview456', status: 'completed', conclusion: 'success' }],
  deployment: { state: 'READY', sha: 'preview456', branch: 'feature/example', target: null },
  sanitizedEnvScopes: [{ key: 'VITE_GIPHY_API_KEY', target: ['preview'], gitBranch: null }],
  sourceVersion: '0.17.2', targetVersion: '0.17.2', versionImpact: 'none',
  backendDependent: false,
});

describe('safe dev promotion preflight', () => {
  it('accepts an identical fully verified source without approving/merging it', () => {
    expect(evaluatePromotionPreflight(base())).toMatchObject({ outcome: 'safe-to-request-approval', reasons: [] });
  });
  it.each([
    [{ latestTargetSha: 'advanced' }, 'dev moved'],
    [{ targetSha: 'advanced' }, 'dev advanced'],
    [{ latestSourceSha: 'newer' }, 'source moved'],
    [{ checkRuns: [] }, 'canonical'],
    [{ deployment: { state: 'ERROR', sha: 'preview456', branch: 'feature/example' } }, 'Vercel'],
    [{ sanitizedEnvScopes: [{ key: 'VITE_GIPHY_API_KEY', target: ['preview'], gitBranch: 'dev' }] }, 'diverge'],
    [{ sanitizedEnvScopes: [{ key: 'VITE_GIPHY_API_KEY', target: ['preview'], value: 'secret' }] }, 'sanitized'],
    [{ versionImpact: 'user-visible' }, 'version'],
    [{ sourceVersion: '0.17.1' }, 'version'],
    [{ backendDependent: true }, 'Scratch'],
    [{ mergeConflict: true }, 'conflict'],
    [{ mergedTree: '' }, 'missing'],
    [{ sourceBranch: 'chatgpt/task' }, 'stable'],
    [{ sourceBranch: 'feature/dogfood' }, 'dogfood'],
  ])('blocks missing, stale or unsafe evidence: %j', (override, expected) => {
    const result = evaluatePromotionPreflight({ ...base(), ...override });
    expect(result.outcome).toBe('blocked');
    expect(result.reasons.join(' ')).toMatch(new RegExp(expected, 'i'));
  });
  it('requires fresh acceptance when concurrent nonconflicting dev work changes the integration tree', () => {
    expect(evaluatePromotionPreflight({ ...base(), mergedTree: 'combinedTree' })).toMatchObject({
      outcome: 'requires-integration',
    });
  });
  it('requires exact expected live backend for backend-dependent changes', () => {
    expect(evaluatePromotionPreflight({ ...base(), backendDependent: true,
      expectedScratchDeployment: 'active123', observedScratchDeployment: 'active123' }).outcome)
      .toBe('safe-to-request-approval');
    expect(evaluatePromotionPreflight({ ...base(), backendDependent: true,
      expectedScratchDeployment: 'active123', observedScratchDeployment: 'changed' }).outcome)
      .toBe('blocked');
  });
  it('allows a strictly higher user-visible version, not a reused one', () => {
    expect(evaluatePromotionPreflight({ ...base(), sourceVersion: '0.17.3', versionImpact: 'user-visible' }).outcome)
      .toBe('safe-to-request-approval');
  });
});
