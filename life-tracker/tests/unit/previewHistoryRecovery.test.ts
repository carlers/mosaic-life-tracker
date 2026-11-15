import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isExactReadyPreviewDeployment, selectPendingPreviewCandidates } from '../../scripts/lib/preview-history-recovery.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40);
const branches = [{ name: 'fix/safe-release', commit: { sha: a } },
  { name: 'feature/another', commit: { sha: b } }, { name: 'main', commit: { sha: b } }];
const ready = (branch: string, sha: string, created = 100) => ({
  id: 'dpl_AAAAAAAAAAAAAAAAAAAAAAAA',
  state: 'READY', target: null, created,
  meta: { githubCommitRef: branch, githubCommitSha: sha },
});

describe('active Preview-history recovery selector', () => {
  it('requires exact live stable ref + SHA + READY official-preview inventory', () => {
    expect(selectPendingPreviewCandidates(branches, [
      ready('fix/safe-release', a),
      ready('fix/safe-release', b),
      ready('main', b),
      { ...ready('feature/another', b), state: 'ERROR' },
      { ...ready('feature/another', b), target: 'production' },
    ], [])).toEqual([{ branch: 'fix/safe-release', sha: a, created: 100, deploymentId: 'dpl_AAAAAAAAAAAAAAAAAAAAAAAA' }]);
  });
  it('prioritizes recent active Previews and remains deterministically bounded', () => {
    const deps = [ready('fix/safe-release', a, 300),
      ready('feature/another', b, 100), ready('feature/another', b, 200)];
    expect(selectPendingPreviewCandidates(branches, deps, [], 1))
      .toEqual([{ branch: 'fix/safe-release', sha: a, created: 300, deploymentId: 'dpl_AAAAAAAAAAAAAAAAAAAAAAAA' }]);
    expect(selectPendingPreviewCandidates(branches, deps, [{id:'preview:'+b}]))
      .toEqual([{ branch:'fix/safe-release', sha:a, created:300, deploymentId: 'dpl_AAAAAAAAAAAAAAAAAAAAAAAA' }]);
    expect(() => selectPendingPreviewCandidates(branches, deps, [], 0)).toThrow();
    const publisher = readFileSync(new URL('../../scripts/reconcile-preview-history.mjs', import.meta.url), 'utf8');
    expect(publisher).toContain('timeout: 45000');
    expect(publisher).toContain('Omitted unverified Preview');
    expect(publisher).toContain('continue;');
    expect(publisher).not.toContain("throw new Error('Verified Preview recovery blocked for");
    expect(publisher).toContain('HISTORY_DEPLOYMENT_ID: candidate.deploymentId');
    expect(publisher).toContain('History provider (?:POST|PATCH)');


  });

  it('requires exact official READY deployment, project and source for direct readback', () => {
    const expected = {
      id: 'dpl_AAAAAAAAAAAAAAAAAAAAAAAA', sha: a,
      branch: 'fix/safe-release', projectId: 'prj_expected',
    };
    const deployment = {
      ...ready('fix/safe-release', a),
      projectId: 'prj_expected',
    };
    expect(isExactReadyPreviewDeployment(deployment, expected)).toBe(true);
    expect(isExactReadyPreviewDeployment({ ...deployment, state: 'ERROR' }, expected)).toBe(false);
    expect(isExactReadyPreviewDeployment({ ...deployment, projectId: 'foreign' }, expected)).toBe(false);
    expect(isExactReadyPreviewDeployment({ ...deployment, target: 'production' }, expected)).toBe(false);
    expect(isExactReadyPreviewDeployment({ ...deployment, id: 'foreign' }, expected)).toBe(false);
    expect(isExactReadyPreviewDeployment({ ...deployment,
      meta: { ...deployment.meta, mosaicPrebuiltSha: b } }, expected)).toBe(false);
    expect(isExactReadyPreviewDeployment({ ...deployment,
      meta: { ...deployment.meta, githubOrg: 'foreign' } }, expected)).toBe(false);
  });
});
