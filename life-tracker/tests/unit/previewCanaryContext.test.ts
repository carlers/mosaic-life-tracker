import { describe, expect, it } from 'vitest';
import {
  assessPreviewCanaryContext, assertPreviewCanaryContext, findExistingCanary,
  OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID,
} from '../../scripts/lib/preview-canary-context.mjs';

const sha = '01f3e61d0143a4d44170004dbe0be557238fd263';
const branch = 'fix/workflow-build-parity-592-20261012';
const trusted = {
  repository: 'carlers/mosaic-life-tracker', eventName: 'workflow_dispatch',
  branch, sha, checkoutSha: sha, requestedSha: sha, ref: 'refs/heads/' + branch,
  enabled: 'true', vercelOrgId: OFFICIAL_VERCEL_ORG_ID,
  vercelProjectId: OFFICIAL_VERCEL_PROJECT_ID,
};

describe('protected Preview canary context (#592)', () => {
  it('accepts only matching accepted SHA and Preview scope', () => {
    expect(assertPreviewCanaryContext(trusted)).toEqual({ eligible: true, reasons: [] });
  });

  it('rejects routine pushes and disabled canary', () => {
    for (const overrides of [
      { eventName: 'push' }, { eventName: 'pull_request' },
      { enabled: undefined }, { enabled: 'false' },
    ]) expect(assessPreviewCanaryContext({ ...trusted, ...overrides }).eligible).toBe(false);
  });

  it('rejects SHA, branch, repository or project scope mismatches', () => {
    for (const overrides of [
      { branch: 'main', ref: 'refs/heads/main' },
      { branch: 'dev', ref: 'refs/heads/dev' },
      { branch: 'chatgpt/test', ref: 'refs/heads/chatgpt/test' },
      { sha: 'a'.repeat(40) }, { checkoutSha: 'b'.repeat(40) },
      { requestedSha: 'c'.repeat(40) }, { ref: 'refs/heads/fix/other' },
      { repository: 'attacker/mosaic-life-tracker' },
      { vercelOrgId: 'team_wrong' }, { vercelProjectId: 'prj_wrong' },
    ]) expect(assessPreviewCanaryContext({ ...trusted, ...overrides }).eligible).toBe(false);
  });

  it('detects only the matching active or READY canary and excludes ordinary Git deployments', () => {
    const known = { id: 'dpl_valid', readyState: 'READY',
      meta: { mosaic_canary_sha: sha, mosaic_canary_branch: branch } };
    const list = [
      { id: 'dpl_regular', readyState: 'READY', meta: { githubCommitSha: sha } },
      { id: 'dpl_failed', readyState: 'ERROR', meta: known.meta },
      known,
    ];
    expect(findExistingCanary(list, branch, sha)).toBe(known);
    expect(findExistingCanary(list.slice(0, 2), branch, sha)).toBeNull();
    expect(() => findExistingCanary(null, branch, sha)).toThrow();
  });
});
