import { describe, expect, it } from 'vitest';
import { evaluatePromotionPrEvidence, latestCanonicalState, waitForPromotionCanonicalEvidence } from '../../scripts/lib/promotion-pr-evidence.mjs';

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

describe('canonical-acceptance PR event race', () => {
  const check = (id: number, status: string, conclusion: string | null = null) =>
    ({ id, name: 'canonical-acceptance', head_sha: b, status, conclusion,
      app: { slug: 'github-actions' } });
  it('distinguishes absent, pending, successful and terminal failure at the exact SHA', () => {
    expect(latestCanonicalState({ ...valid(), checkRuns: [] })).toBe('missing');
    expect(latestCanonicalState({ ...valid(), checkRuns: [check(11, 'in_progress')] })).toBe('pending');
    expect(latestCanonicalState({ ...valid(), checkRuns: [check(11, 'completed', 'success')] })).toBe('success');
    expect(latestCanonicalState({ ...valid(), checkRuns: [check(11, 'completed', 'failure')] })).toBe('failed');
  });
  it('waits through a missing and then queued exact-SHA check until latest succeeds', async () => {
    const sequence = [
      { ...valid(), checkRuns: [] },
      { ...valid(), checkRuns: [check(11, 'queued')] },
      { ...valid(), checkRuns: [check(11, 'completed', 'success')] },
    ];
    let reads = 0;
    let waits = 0;
    const result = await waitForPromotionCanonicalEvidence({
      evidence: sequence[0],
      refresh: async () => sequence[++reads],
      sleep: async () => { waits += 1; }, maxAttempts: 4, intervalMs: 1,
    });
    expect(result).toEqual({ passed: true, reasons: [] });
    expect(reads).toBe(2);
    expect(waits).toBe(2);
  });
  it('never accepts an older green check while the newest is pending', async () => {
    const evidence = { ...valid(), checkRuns: [
      check(10, 'completed', 'success'), check(11, 'in_progress'),
    ] };
    expect(latestCanonicalState(evidence)).toBe('pending');
    const result = await waitForPromotionCanonicalEvidence({
      evidence, refresh: async () => evidence, sleep: async () => {},
      maxAttempts: 2, intervalMs: 1,
    });
    expect(result.passed).toBe(false);
  });
  it('fails without waiting when newest check failed or independent checks reject', async () => {
    for (const evidence of [
      { ...valid(), checkRuns: [check(11, 'completed', 'failure')] },
      { ...valid(), draft: true, checkRuns: [] },
    ]) {
      let waited = false;
      const result = await waitForPromotionCanonicalEvidence({
        evidence, refresh: async () => { throw Error('should not refresh'); },
        sleep: async () => { waited = true; },
      });
      expect(result.passed).toBe(false);
      expect(waited).toBe(false);
    }
  });
  it('fails closed if base/head drifts while waiting', async () => {
    const result = await waitForPromotionCanonicalEvidence({
      evidence: { ...valid(), checkRuns: [] },
      refresh: async () => ({ ...valid(), liveHeadSha: a, checkRuns: [check(11, 'completed', 'success')] }),
      sleep: async () => {}, maxAttempts: 3,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/changed/);
  });
  it('times out when no canonical result ever arrives', async () => {
    let attempts = 0;
    const evidence = { ...valid(), checkRuns: [] };
    const result = await waitForPromotionCanonicalEvidence({
      evidence, refresh: async () => { attempts++; return evidence; },
      sleep: async () => {}, maxAttempts: 3,
    });
    expect(result.passed).toBe(false);
    expect(attempts).toBe(2);
  });
});
