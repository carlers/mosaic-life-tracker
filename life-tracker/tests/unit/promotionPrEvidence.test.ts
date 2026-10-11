import { describe, expect, it } from 'vitest';
import { evaluatePromotionPrEvidence } from '../../scripts/lib/promotion-pr-evidence.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const t = 'c'.repeat(40);
const valid = () => ({
  baseBranch: 'dev', headBranch: 'feature/workflow',
  repository: 'carlers/mosaic-life-tracker',
  baseRepository: 'carlers/mosaic-life-tracker',
  headRepository: 'carlers/mosaic-life-tracker',
  baseSha: a, headSha: b, liveBaseSha: a, liveHeadSha: b,
  draft: false, prNumber: 42,
  livePr: { number: 42, state: 'open', draft: false,
    base: { ref: 'dev', sha: a, repo: { full_name: 'carlers/mosaic-life-tracker' } },
    head: { ref: 'feature/workflow', sha: b, repo: { full_name: 'carlers/mosaic-life-tracker' } } },
  sourceTree: t, mergedTree: t, mergeConflict: false,
  checkRuns: [{ id: 10, name: 'canonical-acceptance', head_sha: b, status: 'completed',
    conclusion: 'success', app: { slug: 'github-actions' } }],
  baseVersion: '0.17.2', headVersion: '0.17.2',
});
describe('trusted-base promotion PR preflight', () => {
  it('recognizes a canonical-accepted exact-tree stable Preview to dev', () => {
    expect(evaluatePromotionPrEvidence(valid())).toEqual({ passed: true, reasons: [] });
  });
  it('permits dev to main with a non-regressing version', () => {
    const proof = valid();
    proof.baseBranch = 'main';
    proof.headBranch = 'dev';
    proof.livePr.base.ref = 'main';
    proof.livePr.head.ref = 'dev';
    proof.baseVersion = '0.16.0';
    expect(evaluatePromotionPrEvidence(proof).passed).toBe(true);
  });
  it.each([
    [{ baseBranch: 'feature/workflow' }, 'target'],
    [{ headBranch: 'chatgpt/unaccepted' }, 'stable'],
    [{ baseBranch: 'main', headBranch: 'feature/workflow' }, 'originate from dev'],
    [{ headRepository: 'attacker/fork' }, 'cross-repository'],
    [{ draft: true }, 'draft'],
    [{ livePr: null }, 'PR metadata'],
    [{ prNumber: 43 }, 'PR metadata'],
    [{ livePr: { ...valid().livePr, state: 'closed' } }, 'PR metadata'],
    [{ livePr: { ...valid().livePr, draft: true } }, 'PR metadata'],
    [{ livePr: { ...valid().livePr, head: { ...valid().livePr.head, sha: a } } }, 'PR metadata'],
    [{ livePr: { ...valid().livePr, base: { ...valid().livePr.base, ref: 'main' } } }, 'PR metadata'],
    [{ livePr: { ...valid().livePr, head: { ...valid().livePr.head, repo: { full_name: 'other/repo' } } } }, 'PR metadata'],
    [{ liveBaseSha: b }, 'changed'],
    [{ liveHeadSha: a }, 'changed'],
    [{ mergedTree: a }, 'differs'],
    [{ mergeConflict: true }, 'conflict'],
    [{ checkRuns: [] }, 'canonical'],
    [{ checkRuns: [{ id: 10, name: 'canonical-acceptance', head_sha: a,
      status: 'completed', conclusion: 'success', app: { slug: 'github-actions' } }] }, 'canonical'],
    [{ checkRuns: [{ id: 10, name: 'canonical-acceptance', head_sha: b,
      status: 'completed', conclusion: 'success', app: { slug: 'other' } }] }, 'canonical'],
    [{ baseVersion: '0.17.2', headVersion: '0.17.1' }, 'version'],
    [{ baseVersion: 'unknown' }, 'version'],
  ])('fails closed: %j', (overrides, fragment) => {
    const result = evaluatePromotionPrEvidence({ ...valid(), ...overrides });
    expect(result.passed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(new RegExp(fragment, 'i'));
  });
  it('rejects a newer failing acceptance when an older successful check is still listed', () => {
    const original = valid();
    const result = evaluatePromotionPrEvidence({ ...original, checkRuns: [
      ...original.checkRuns,
      { ...original.checkRuns[0], id: 11, conclusion: 'failure' },
    ] });
    expect(result.passed).toBe(false);
  });
});
