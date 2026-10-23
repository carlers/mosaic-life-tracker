import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  addUniquePrebuiltDeploymentId, assessKnownPrebuiltDeployments,
  planAcceptedPreview, prebuiltCliArguments, verifiedPrebuiltGitMetadata, createTrustedCliProjectRoot,
  isKnownPrebuiltHistoryCandidate, providerDeploymentId,
  verifyPrebuiltHistoryDetail,
  VERIFIED_PREVIEW_PROJECT, assertTrustedProviderProject, assertIsolatedCanaryGitDisable,
} from '../../scripts/lib/prebuilt-provider-contract.mjs';
import { expectedDefaultCiFirstGitConfig } from
  '../../scripts/lib/prebuilt-candidate-payload.mjs';
import { PREBUILT_CANARY_BRANCH, PREBUILT_PILOT_BRANCH, PREBUILT_ROUTING_SHA256 } from
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
      '"fix/!(592-trusted-archive-20261014)": true,\n      "fix/592-trusted-archive-20261014": false,'));
    const unsafeUnmatched=Buffer.from(old.replace('"fix/*": true,',
      '"fix/!(592-trusted-archive-20261014)": true,'));
    expect(()=>assertIsolatedCanaryGitDisable(unsafeUnmatched)).toThrow();
    expect(assertIsolatedCanaryGitDisable(safe)).toBe(true);
    expect(()=>assertIsolatedCanaryGitDisable(source)).toThrow();
    expect(()=>assertIsolatedCanaryGitDisable(Buffer.from(old.replace(
      '"main": true,','"main": false,')))).toThrow();
    expect(()=>assertIsolatedCanaryGitDisable(Buffer.from(old.replace(
      '"fix/*": true,','"fix/*": false,')))).toThrow();
    expect(assertIsolatedCanaryGitDisable(expectedDefaultCiFirstGitConfig(),
      'feature/real-user-task')).toBe(true);
    expect(() => assertIsolatedCanaryGitDisable(expectedDefaultCiFirstGitConfig(),
      PREBUILT_CANARY_BRANCH)).toThrow();
  });

  it('accepts a separately vetted feature pilot but never auto-enables other branches', () => {
    const featurePlan = planAcceptedPreview({
      ...accepted, branch: PREBUILT_PILOT_BRANCH,
    });
    expect(featurePlan.meta.mosaicPrebuiltBranch).toBe(PREBUILT_PILOT_BRANCH);
    expect(featurePlan.deploymentId).not.toBe(plan.deploymentId);
    expect(prebuiltCliArguments(featurePlan)).toContain('--target=preview');
    for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
      const branch = category + '/normal-work';
      expect(() => planAcceptedPreview({
        ...accepted, branch, genericEnabled: 'false',
      })).toThrow(/Generic/);
      const staged = planAcceptedPreview({
        ...accepted, branch, genericEnabled: 'true',
      });
      expect(staged.branch).toBe(branch);
      expect(prebuiltCliArguments(staged)).toContain('--target=preview');
      expect(staged.deploymentId).not.toBe(plan.deploymentId);
    }
    for (const badBranch of ['feature/any-normal-feature', 'fix/other',
      'perf/size', 'security/hardening', 'refactor/cleanup',
      'dev', 'main', 'chatgpt/task']) {
      expect(() => planAcceptedPreview({
        ...accepted, branch: badBranch,
      })).toThrow(/Untrusted|Generic Preview rollout disabled/);
    }
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
    // Both --team and --scope trigger a Vercel CLI user-identity request
    // before command dispatch. The limited project token's authenticated
    // project/history GETs succeeded, but that user lookup returned 404.
    // Project selection is already pinned by the verified environment and
    // .vercel/project.json written by the main-owned runner.
    expect(argv).not.toContain('--team');
    expect(argv).not.toContain('--scope');
    expect(argv).not.toContain('-T');
    expect(argv).not.toContain('-S');
    expect(argv).not.toContain(plan.teamId);
    expect(argv).toContain('mosaicPrebuiltSha=' + sha);
    expect(argv).toContain('mosaicPrebuiltId=' + plan.deploymentId);
    expect(argv.join(' ')).not.toMatch(/--prod|--force|vercel build|--build-env|--env\b|--public/);
    expect(() => prebuiltCliArguments({ ...plan, target: 'production' })).toThrow();
    expect(() => prebuiltCliArguments({ ...plan, projectId: 'wrong' })).toThrow();
    expect(() => prebuiltCliArguments({ ...plan, meta: { bad: 'unsafe\nvalue' } })).toThrow();
  });

  it('adds GitHub-verified commit titles to CLI Preview metadata without changing deploy target', () => {
    const commit = {
      sha, commit: {
        message: 'feat(calendar): Make month navigation easier ✨\n\nChangelog follows.',
        author: { name: 'Jane Contributor' },
      }, author: { login: 'janedev' },
    };
    const meta = verifiedPrebuiltGitMetadata(commit, plan);
    expect(meta).toEqual({
      githubCommitMessage: 'feat(calendar): Make month navigation easier ✨',
      githubCommitSha: sha,
      githubCommitRef: plan.branch,
      githubCommitOrg: 'carlers',
      githubCommitRepo: 'mosaic-life-tracker',
      githubOrg: 'carlers',
      githubRepo: 'mosaic-life-tracker',
      githubDeployment: '1',
      githubCommitAuthorName: 'Jane Contributor',
      githubCommitAuthorLogin: 'janedev',
    });
    const args = prebuiltCliArguments(plan, meta);
    expect(args).toContain('githubCommitMessage=' + meta.githubCommitMessage);
    expect(args).toContain('githubCommitSha=' + sha);
    expect(args).toContain('mosaicPrebuiltId=' + plan.deploymentId);
    expect(args).toContain('--prebuilt');
    expect(args).toContain('--target=preview');
    expect(args).not.toContain('--prod');
    expect(args).not.toContain('vercel build');
    expect(args).not.toContain('--scope');
    expect(args).not.toContain('--force');
  });

  it('rejects mismatched/spoofed Git identity and control-character presentation metadata', () => {
    const commit = {
      sha, commit: { message: 'fix: usable preview names', author: { name: 'A' } },
      author: { login: 'contributor' },
    };
    expect(() => verifiedPrebuiltGitMetadata({ ...commit, sha: 'b'.repeat(40) }, plan))
      .toThrow(/Unverified/);
    expect(() => verifiedPrebuiltGitMetadata({ ...commit,
      commit: { message: '\n', author: { name: 'A' } } }, plan)).toThrow(/subject/);
    expect(() => verifiedPrebuiltGitMetadata({ ...commit,
      commit: { message: 'fix: bad\u0000title', author: { name: 'A' } } }, plan)).toThrow(/subject/);
    const valid = verifiedPrebuiltGitMetadata(commit, plan);
    expect(() => prebuiltCliArguments(plan, { ...valid, githubCommitSha: 'b'.repeat(40) }))
      .toThrow(/Unverified/);
    expect(() => prebuiltCliArguments(plan, { ...valid, githubCommitRef: 'main' }))
      .toThrow(/Unverified/);
    expect(() => prebuiltCliArguments(plan, { ...valid, githubCommitMessage: 'bad\n--prod' }))
      .toThrow(/Unsafe/);
    expect(() => prebuiltCliArguments(plan, { ...valid, injectedSecret: 'value' }))
      .toThrow(/Unsafe/);
    expect(() => prebuiltCliArguments(plan, { ...valid, githubOrg: 'other' }))
      .toThrow(/Unverified/);
    expect(() => prebuiltCliArguments({ ...plan, target: 'production' }, valid))
      .toThrow(/Forbidden/);
    const withoutAccount = verifiedPrebuiltGitMetadata({
      sha, commit: { message: 'fix: safe title', author: { name: 'Bad\nName' } },
    }, plan);
    expect(withoutAccount).not.toHaveProperty('githubCommitAuthorName');
    expect(withoutAccount).not.toHaveProperty('githubCommitAuthorLogin');
  });

  it('distinguishes trusted CLI Git presentation metadata from real/unknown Git collisions', () => {
    const meta = { ...plan.meta, githubCommitSha: sha, githubCommitRef: plan.branch };
    const cli = {
      id: 'dpl_B123', url: 'mosaic-prebuilt-safe.vercel.app',
      projectId: VERIFIED_PREVIEW_PROJECT, target: 'preview',
      state: 'READY', meta,
    };
    expect(assessKnownPrebuiltDeployments([cli], plan, { exhaustive: true }))
      .toEqual({ action: 'reuse', id: cli.id });
    expect(() => assessKnownPrebuiltDeployments([{ ...cli, source: 'git' }],
      plan, { exhaustive: true })).toThrow(/Another deployment/);
    const unrelated = { ...cli,
      meta: { githubCommitSha: sha, githubCommitRef: plan.branch } };
    expect(() => assessKnownPrebuiltDeployments([unrelated],
      plan, { exhaustive: true })).toThrow(/Another deployment/);
    expect(() => assessKnownPrebuiltDeployments([{ ...unrelated, source: 'git' }],
      plan, { exhaustive: true })).toThrow(/Another deployment/);
  });

  it('creates only an empty required monorepo root, preserving the one verified prebuilt output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mosaic-prebuilt-cli-root-'));
    try {
      await mkdir(join(root, '.vercel', 'output'), { recursive: true });
      const original = Buffer.from('verified build output sentinel');
      const file = join(root, '.vercel', 'output', 'config.json');
      await writeFile(file, original);
      expect(await createTrustedCliProjectRoot(root, plan))
        .toBe(join(root, 'life-tracker'));
      expect((await stat(join(root, 'life-tracker'))).isDirectory()).toBe(true);
      expect(await readdir(join(root, 'life-tracker'))).toEqual([]);
      expect(await readFile(file)).toEqual(original);
      await expect(createTrustedCliProjectRoot(root, plan)).rejects.toThrow(/EEXIST/);
      await expect(createTrustedCliProjectRoot(root, { ...plan, projectId: 'wrong' }))
        .rejects.toThrow(/Untrusted/);
      await expect(createTrustedCliProjectRoot(root, { ...plan, target: 'production' }))
        .rejects.toThrow(/Untrusted/);
    } finally { await rm(root, { recursive: true, force: true }); }
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

  it('completes compact CLI history from authenticated detail before a safe retry', () => {
    const summary = { id: 'dpl_AbC123', url: 'mosaic-prebuilt-foo.vercel.app',
      state: 'READY', meta: { mosaicPrebuiltId: plan.deploymentId,
        mosaicPrebuiltSha: sha, mosaicPrebuiltBranch: plan.branch } };
    const detail = { ...summary, projectId: VERIFIED_PREVIEW_PROJECT,
      target: null, meta: plan.meta, readyState: 'READY' };
    expect(isKnownPrebuiltHistoryCandidate(summary, plan)).toBe(true);
    expect(() => assessKnownPrebuiltDeployments([summary], plan,
      { exhaustive: true })).toThrow(/identity/);
    // Vercel's actual v6 list uses uid, while v13 detail uses id.
    const liveList = { ...summary, uid: summary.id };
    delete (liveList as { id?: string }).id;
    expect(providerDeploymentId(liveList)).toBe(summary.id);
    expect(providerDeploymentId(detail)).toBe(summary.id);
    const liveComplete = verifyPrebuiltHistoryDetail(liveList, detail, plan);
    expect(liveComplete.id).toBe(summary.id);
    expect(assessKnownPrebuiltDeployments([liveComplete], plan,
      { exhaustive: true })).toEqual({ action: 'reuse', id: summary.id });
    expect(() => providerDeploymentId({ ...liveList, id: 'dpl_Different' }))
      .toThrow(/Contradictory/);
    expect(() => providerDeploymentId({ ...liveList, uid: 'bad' }))
      .toThrow(/Invalid/);
    expect(() => providerDeploymentId({ meta: summary.meta })).toThrow(/Invalid/);
    expect(() => verifyPrebuiltHistoryDetail(liveList,
      { ...detail, uid: 'dpl_Different' }, plan)).toThrow(/Contradictory/);
    expect(() => verifyPrebuiltHistoryDetail(liveList,
      { ...detail, id: 'dpl_Different' }, plan)).toThrow();
    const complete = verifyPrebuiltHistoryDetail(summary, detail, plan);
    expect(assessKnownPrebuiltDeployments([complete], plan,
      { exhaustive: true })).toEqual({ action: 'reuse', id: summary.id });
    const pending = { ...summary, state: 'BUILDING' };
    expect(assessKnownPrebuiltDeployments([
      verifyPrebuiltHistoryDetail(pending,
        { ...detail, state: 'BUILDING', readyState: 'BUILDING' }, plan),
    ], plan, { exhaustive: true })).toEqual({ action: 'wait', id: summary.id });
    for (const bad of [
      { ...detail, projectId: 'other' },
      { ...detail, target: 'production' },
      { ...detail, id: 'dpl_Other' },
      { ...detail, url: 'changed.vercel.app' },
      { ...detail, meta: { ...plan.meta, mosaicPrebuiltRoute: 'f'.repeat(64) } },
      { ...detail, meta: { ...plan.meta, mosaicPrebuiltSha: 'f'.repeat(40) } },
      { ...detail, readyState: 'ERROR' },
    ]) expect(() => verifyPrebuiltHistoryDetail(summary, bad, plan)).toThrow();
    expect(() => verifyPrebuiltHistoryDetail({ ...summary,
      target: 'production' }, detail, plan)).toThrow();
    expect(() => verifyPrebuiltHistoryDetail({ ...summary,
      meta: { ...summary.meta, mosaicPrebuiltRoute: 'bad' } }, detail, plan)).toThrow();
    expect(isKnownPrebuiltHistoryCandidate({ meta: {} }, plan)).toBe(false);
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
