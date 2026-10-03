import { describe, expect, it } from 'vitest';
import { evaluatePromotionEvidence } from '../../scripts/lib/promotion-verification.mjs';

const baseSha = 'base123';
const sourceSha = 'source456';
const headSha = 'merge789';
const treeSha = 'treeabc';

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    targetBranch: 'dev',
    headSha,
    beforeSha: baseSha,
    headCommit: {
      sha: headSha,
      commit: { tree: { sha: treeSha } },
      parents: [{ sha: baseSha }, { sha: sourceSha }],
    },
    sourceCommit: {
      sha: sourceSha,
      commit: { tree: { sha: treeSha } },
    },
    pulls: [
      {
        number: 42,
        merged_at: '2026-10-03T00:00:00Z',
        merge_commit_sha: headSha,
        base: { ref: 'dev' },
        head: { ref: 'feature/example', sha: sourceSha },
      },
    ],
    checkRuns: [
      {
        name: 'canonical-acceptance',
        head_sha: sourceSha,
        status: 'completed',
        conclusion: 'success',
      },
    ],
    ...overrides,
  };
}

describe('stable Preview promotion verification', () => {
  it('reuses acceptance only for an identical stable Preview merge tree', () => {
    expect(evaluatePromotionEvidence(evidence())).toEqual({
      eligible: true,
      reason: 'stable Preview tree and canonical acceptance are reusable',
      sourceSha,
      sourceBranch: 'feature/example',
      prNumber: 42,
    });
  });

  it('falls back when the merge changes the accepted source tree', () => {
    const sourceCommit = {
      sha: sourceSha,
      commit: { tree: { sha: 'different-tree' } },
    };
    expect(
      evaluatePromotionEvidence(evidence({ sourceCommit }))
    ).toMatchObject({
      eligible: false,
      reason: 'promotion merge tree differs from the stable Preview source tree',
      sourceSha,
    });
  });

  it('falls back when the promotion did not come from a stable Preview PR', () => {
    const pulls = [
      {
        number: 43,
        merged_at: '2026-10-03T00:00:00Z',
        merge_commit_sha: headSha,
        base: { ref: 'dev' },
        head: { ref: 'chatgpt/example', sha: sourceSha },
      },
    ];
    expect(evaluatePromotionEvidence(evidence({ pulls }))).toMatchObject({
      eligible: false,
      reason: 'no merged stable Preview pull request matches this promotion',
    });
  });

  it('falls back when canonical acceptance is missing or stale', () => {
    const checkRuns = [
      {
        name: 'canonical-acceptance',
        head_sha: sourceSha,
        status: 'completed',
        conclusion: 'failure',
      },
    ];
    expect(
      evaluatePromotionEvidence(evidence({ checkRuns }))
    ).toMatchObject({
      eligible: false,
      reason: 'stable Preview source lacks successful canonical acceptance',
      sourceSha,
      sourceBranch: 'feature/example',
    });
  });

  it('falls back when the push before-SHA is not the merge first parent', () => {
    expect(
      evaluatePromotionEvidence(evidence({ beforeSha: 'unexpected-base' }))
    ).toMatchObject({
      eligible: false,
      reason: 'push before-SHA does not match the merge first parent',
      sourceSha,
    });
  });
});
