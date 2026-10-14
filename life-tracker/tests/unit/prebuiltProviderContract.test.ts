import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  addUniquePrebuiltDeploymentId, assessKnownPrebuiltDeployments,
  planAcceptedPreview, prebuiltCliArguments,
  VERIFIED_PREVIEW_PROJECT,
} from '../../scripts/lib/prebuilt-provider-contract.mjs';
import { PREBUILT_CANARY_BRANCH, PREBUILT_ROUTING_SHA256 } from
  '../../scripts/lib/prebuilt-receiver-gate.mjs';

const sha = 'a'.repeat(40);
const accepted = {
  sha, branch: PREBUILT_CANARY_BRANCH, runId: 38506106029, attempt: 1,
  zipDigest: 'sha256:' + 'b'.repeat(64), routeSha256: PREBUILT_ROUTING_SHA256,
  target: 'preview', createEnabled: 'true', aliasEnabled: 'false',
};
const plan = planAcceptedPreview(accepted);

describe('CI-first prebuilt Vercel provider contract (#592)', () => {
  it('uses stable unique provider deploymentId across run retries and attempts', () => {
    expect(plan.deploymentId).toMatch(/^mos[0-9a-f]{29}$/);
    expect(plan.deploymentId).toHaveLength(32);
    const rerun = planAcceptedPreview({ ...accepted, runId: 38506106039, attempt: 5 });
    expect(rerun.deploymentId).toBe(plan.deploymentId);
    const changed = planAcceptedPreview({ ...accepted, sha: 'c'.repeat(40) });
    expect(changed.deploymentId).not.toBe(plan.deploymentId);
  });

  it('refuses credentials-disabled, alias-enabled and Production/non-canary intentions', () => {
    for (const modified of [
      { createEnabled: undefined }, { createEnabled: 'false' },
      { aliasEnabled: 'true' }, { target: 'production' },
      { target: undefined }, { projectId: 'prj_attacker' },
      { sha: 'invalid' }, { branch: 'fix/other' }, { zipDigest: undefined },
      { routeSha256: '0'.repeat(64) }, { runId: 0 }, { attempt: 0 },
    ]) expect(() => planAcceptedPreview({ ...accepted, ...modified })).toThrow();
  });

  it('constructs only explicit Preview-target prebuilt CLI and safe branch/SHA metadata', () => {
    const argv = prebuiltCliArguments(plan);
    expect(argv).toContain('--prebuilt');
    expect(argv).toContain('--target=preview');
    expect(argv).toContain('--archive=tgz');
    expect(argv).toContain('mosaicPrebuiltSha=' + sha);
    expect(argv).toContain('mosaicPrebuiltId=' + plan.deploymentId);
    expect(argv.join(' ')).not.toMatch(/--prod|--force|vercel build|--build-env|--env\b|--public/);
    expect(() => prebuiltCliArguments({ ...plan, target: 'production' })).toThrow();
    expect(() => prebuiltCliArguments({ ...plan, projectId: 'wrong' })).toThrow();
    expect(() => prebuiltCliArguments({ ...plan, meta: { bad: 'unsafe\nvalue' } })).toThrow();
  });

  it('adds deterministic provider ID without touching verified routing structures', () => {
    // The real CI-produced config digest is pinned in the trusted receiver.
    // The unit fixture cannot fabricate that SHA256 preimage, which is the
    // point: any altered candidate output must fail before the deploy step.
    const fakeConfig = Buffer.from(JSON.stringify({ version: 3, routes: [{ src: '/x' }] }));
    expect(() => addUniquePrebuiltDeploymentId(fakeConfig, plan)).toThrow(/Unverified/);
    expect(() => addUniquePrebuiltDeploymentId(fakeConfig,
      { ...plan, deploymentId: 'invalid' })).toThrow();
  });

  it('returns create only after a complete provider history and reuses a matched READY deployment', () => {
    expect(assessKnownPrebuiltDeployments([], plan, { exhaustive: true })).toEqual({
      action: 'create',
    });
    expect(() => assessKnownPrebuiltDeployments([], plan)).toThrow();
    const existing = {
      id: 'dpl_AbC123', url: 'mosaic-prebuilt-foo.vercel.app',
      projectId: VERIFIED_PREVIEW_PROJECT, target: null, state: 'READY',
      meta: plan.meta,
    };
    expect(assessKnownPrebuiltDeployments([existing], plan,
      { exhaustive: true })).toEqual({ action: 'reuse', id: existing.id });
    expect(assessKnownPrebuiltDeployments([{ ...existing, state: 'BUILDING' }],
      plan, { exhaustive: true })).toEqual({ action: 'wait', id: existing.id });
    for (const entries of [
      [existing, existing],
      [{ ...existing, target: 'production' }],
      [{ ...existing, projectId: 'prj_unknown' }],
      [{ ...existing, meta: { ...existing.meta, mosaicPrebuiltId: 'different' } }],
      [{ ...existing, state: 'ERROR' }],
      [{ ...existing, url: 'evil.example.com' }],
    ]) expect(() => assessKnownPrebuiltDeployments(entries, plan,
      { exhaustive: true })).toThrow();
  });
});
