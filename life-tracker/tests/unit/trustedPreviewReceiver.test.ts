import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assessTrustedPreviewTrigger, assertTrustedPreviewDeployment,
  trustedGitSource, assertTrustedVercelProject, TRUSTED_PREVIEW_BRANCH, TRUSTED_PREVIEW_ALIAS,
  TRUSTED_GITHUB_REPO_ID } from '../../scripts/lib/trusted-preview-receiver.mjs';

const sha = '26dfa9c7d978ff7bbc7ac861625e4d69c0fca861';
const suite = 483729122;
const run = {
  id: 38316959947, check_suite_id: suite, name: 'Quality Gate',
  path: '.github/workflows/quality-gate.yml', event: 'push',
  head_sha: sha, head_branch: TRUSTED_PREVIEW_BRANCH,
  status: 'completed', conclusion: 'success',
};
const check = { name: 'canonical-acceptance', check_suite: { id: suite },
  status: 'completed', conclusion: 'success', head_sha: sha,
  app: { slug: 'github-actions' } };
const event = { repository: { full_name: 'carlers/mosaic-life-tracker' },
  workflow_run: { ...run,
    head_repository: { full_name: 'carlers/mosaic-life-tracker' },
    repository: { full_name: 'carlers/mosaic-life-tracker' },
  } };
const trigger = {
  event, repository: 'carlers/mosaic-life-tracker',
  eventName: 'workflow_run', ref: 'refs/heads/main',
  checkoutSha: 'a'.repeat(40), enabled: 'true',
  workflowRuns: [run], checkRuns: [check], branchHead: sha,
};

const deployment = { id: 'dpl_accepted', projectId: 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc',
  readyState: 'READY', source: 'git', target: null,
  url: 'mosaic-life-tracker-accepted.vercel.app',
  meta: { githubCommitSha: sha, githubCommitRef: TRUSTED_PREVIEW_BRANCH,
    githubOrg: 'carlers', githubRepo: 'mosaic-life-tracker' } };

describe('trusted default-branch Preview receiver (#592)', () => {
  it('accepts only a completed latest exact-SHA canonical push from the official repo', () => {
    expect(assessTrustedPreviewTrigger(trigger)).toMatchObject({
      eligible: true, sha, branch: TRUSTED_PREVIEW_BRANCH, runId: run.id,
    });
    for (const patch of [
      { enabled: undefined }, { enabled: 'false' },
      { eventName: 'push' }, { ref: 'refs/heads/fix/workflow-build-parity-592-20261012' },
      { checkoutSha: 'not-a-sha' }, { repository: 'attacker/mosaic-life-tracker' },
      { branchHead: 'f'.repeat(40) }, { checkRuns: [] },
      { checkRuns: [{ ...check, conclusion: 'failure' }] },
      { workflowRuns: [{ ...run, status: 'in_progress', conclusion: null }] },
      { workflowRuns: [{ ...run, id: run.id + 1, check_suite_id: suite + 1 }] },
    ]) expect(assessTrustedPreviewTrigger({ ...trigger, ...patch }).eligible).toBe(false);
  });

  it('rejects event payload tricks and attempted changes to source workflow identity', () => {
    for (const patch of [
      { name: 'Not Quality Gate' }, { event: 'workflow_dispatch' },
      { path: '.github/workflows/other.yml' }, { head_branch: 'dev' },
      { head_branch: 'main' }, { head_sha: 'f'.repeat(40) },
      { head_repository: { full_name: 'attacker/mosaic-life-tracker' } },
      { repository: { full_name: 'attacker/mosaic-life-tracker' } },
      { status: 'queued' }, { conclusion: 'failure' }, { id: 'not-a-number' },
    ]) {
      const poisoned = { ...event, workflow_run: { ...event.workflow_run, ...patch } };
      expect(assessTrustedPreviewTrigger({ ...trigger, event: poisoned }).eligible).toBe(false);
    }
  });

  it('pins exact SHA and linked Git repo identity for remote Vercel build', () => {
    expect(trustedGitSource(sha)).toEqual({ type: 'github',
      repoId: TRUSTED_GITHUB_REPO_ID, ref: TRUSTED_PREVIEW_BRANCH, sha });
    expect(() => trustedGitSource('main')).toThrow();
  });

  it('requires READY hosted official Preview rather than arbitrary deployment', () => {
    expect(assertTrustedPreviewDeployment(deployment, sha)).toBe('dpl_accepted');
    expect(assertTrustedPreviewDeployment({ ...deployment, source: 'cli',
      meta: { ...deployment.meta, githubCommitRef: 'HEAD' } }, sha)).toBe('dpl_accepted');
    for (const patch of [
      { source: 'unknown' }, { source: 'local' }, { readyState: 'BUILDING' },
      { readyState: 'ERROR' }, { target: 'production' },
      { projectId: 'another' }, { url: 'malicious.example.com' },
      { meta: { ...deployment.meta, githubCommitSha: 'f'.repeat(40) } },
      { meta: { ...deployment.meta, githubOrg: 'attacker' } },
      { meta: { ...deployment.meta, githubRepo: 'wrong' } },
      { meta: { ...deployment.meta, githubCommitRef: 'dev' } },
    ]) expect(() => assertTrustedPreviewDeployment({ ...deployment, ...patch }, sha)).toThrow();
  });

  it('stages a default-branch workflow_run listener that never executes candidate code', () => {
    const yaml = readFileSync(new URL('../../../.github/workflows/trusted-preview-delivery.yml', import.meta.url), 'utf8');
    expect(yaml).toContain('workflow_run:');
    expect(yaml).toContain('types: [completed]');
    expect(yaml).toContain('vars.MOSAIC_TRUSTED_PREVIEW_ENABLED == \'true\'');
    expect(yaml).toContain('github.event.workflow_run.head_branch == \'fix/workflow-build-parity-592-20261012\'');
    expect(yaml).toContain('environment: mosaic-preview-auto');
    expect(yaml).toContain('ref: \${{ github.sha }}');
    expect(yaml).toContain('run: node life-tracker/scripts/run-trusted-preview-receiver.mjs');
    expect(yaml).not.toContain('github.event.workflow_run.head_sha }}');
    expect(yaml).not.toContain('npm ci');
    expect(yaml).not.toContain('vercel build');
    expect(yaml).not.toContain('workflow_dispatch');
    const impl = readFileSync(new URL('../../scripts/run-trusted-preview-receiver.mjs', import.meta.url), 'utf8');
    expect(impl).toContain('gitSource: trustedGitSource(sha)');
    expect(impl).toContain("process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED !== 'true'");
    expect(impl).toContain('await authorized(event);');
    expect(impl).not.toContain("execFileSync('npm'");
    expect(impl).not.toContain('actions/download-artifact');
    expect(impl).not.toContain('actions/checkout');
    expect(impl).not.toContain('git checkout');
  });

  it('hard-disables legacy source-workflow secret-bearing pilot even if repository toggle is enabled', () => {
    const yaml = readFileSync(new URL('../../../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');
    const legacy = yaml.split('\n  preview_auto_pilot:\n')[1];
    expect(legacy).toContain('false && always() && !cancelled()');
    expect(legacy).toContain('environment: mosaic-preview-auto');
    expect(legacy).toContain("vars.MOSAIC_AUTO_PREVIEW_ENABLED == 'true'");
  });

  it('fails closed if Vercel project binding or production branch cannot be verified', () => {
    const project = {
      id: 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc',
      name: 'mosaic-life-tracker', rootDirectory: 'life-tracker',
      link: { type: 'github', repoId: TRUSTED_GITHUB_REPO_ID, productionBranch: 'main' },
    };
    expect(assertTrustedVercelProject(project)).toBe(true);
    for (const diff of [
      { id: 'wrong' }, { rootDirectory: 'wrong' },
      { name: 'wrong' },
      { link: { ...project.link, type: 'gitlab' } },
      { link: { ...project.link, repoId: 12 } },
      { link: { ...project.link, productionBranch: TRUSTED_PREVIEW_BRANCH } },
      { link: null },
    ]) expect(() => assertTrustedVercelProject({ ...project, ...diff })).toThrow();
  });

  it('never bakes the deployment token or project environment into candidate artifact', () => {
    const script = readFileSync(new URL('../../scripts/run-trusted-preview-receiver.mjs', import.meta.url), 'utf8');
    expect(script).toContain("method: 'POST'");
    expect(script).toContain('assertTrustedVercelProject(project)');
    expect(script).toContain("source scripts execute only in Vercel's normal build sandbox");
    expect(script).not.toContain('npm install');
    expect(script).not.toContain('npm run build');
    expect(script).not.toContain('vercel pull');
    expect(script).not.toContain('source.tgz');
  });
});
