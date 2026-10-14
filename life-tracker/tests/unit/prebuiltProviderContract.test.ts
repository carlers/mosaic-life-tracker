import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addUniquePrebuiltDeploymentId, assessKnownPrebuiltDeployments,
  planAcceptedPreview, prebuiltCliArguments,
  VERIFIED_PREVIEW_PROJECT, assertTrustedProviderProject, assertIsolatedCanaryGitDisable,
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
  it('refuses an unexpected Vercel project, unsafe Git overlap or unknown rollout bytes', async () => {
    const project={id:VERIFIED_PREVIEW_PROJECT,name:'mosaic-life-tracker',
      rootDirectory:'life-tracker',
      link:{type:'github',repoId:1361399135,productionBranch:'main'}};
    expect(assertTrustedProviderProject(project)).toBe(true);
    for(const bad of [
      {...project,rootDirectory:'/'},
      {...project,link:{...project.link,repoId:0}},
      {...project,link:{...project.link,productionBranch:'dev'}},
      {...project,id:'untrusted'},
    ]) expect(()=>assertTrustedProviderProject(bad)).toThrow();
    const source=await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'));
    const old=source.toString('utf8');
    const safe=Buffer.from(old.replace('"fix/*": true,',
      '"fix/!(592-trusted-archive-20261014)": true,'));
    expect(assertIsolatedCanaryGitDisable(safe)).toBe(true);
    expect(()=>assertIsolatedCanaryGitDisable(source)).toThrow();
    expect(()=>assertIsolatedCanaryGitDisable(Buffer.from(old.replace(
      '"main": true,','"main": false,')))).toThrow();
    expect(()=>assertIsolatedCanaryGitDisable(Buffer.from(old.replace(
      '"fix/*": true,','"fix/*": false,')))).toThrow();
  });

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

  it('adds deterministic provider ID to real pinned v3 routing without altering routes', async () => {
    // Verified static output recorded by accepted #592 CI. No private inputs.
    const config = await readFile(resolve(process.cwd(),
      'tests/fixtures/trusted-preview-routes-v3.json'));
    expect(createHash('sha256').update(config).digest('hex')).toBe(
      PREBUILT_ROUTING_SHA256,
    );
    const result = JSON.parse(addUniquePrebuiltDeploymentId(config, plan).toString());
    const original = JSON.parse(config.toString());
    expect(result.deploymentId).toBe(plan.deploymentId);
    delete result.deploymentId;
    expect(result).toEqual(original);
    const tampered = Buffer.from(config);
    tampered[35] ^= 1;
    expect(() => addUniquePrebuiltDeploymentId(tampered, plan)).toThrow(/Unverified/);
    expect(() => addUniquePrebuiltDeploymentId(config,
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
      [{...existing,source:'git',meta:{githubCommitSha:sha,githubCommitRef:PREBUILT_CANARY_BRANCH}}],
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
