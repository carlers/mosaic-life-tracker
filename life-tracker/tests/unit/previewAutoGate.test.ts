import { describe, it, expect } from 'vitest';
import { AUTO_PREVIEW_PILOT_BRANCH, AUTO_PREVIEW_PILOT_ALIAS,
  assessAutomaticPreviewContext, assertAutomaticPreviewDeployment }
  from '../../scripts/lib/preview-auto-gate.mjs';
import { OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID }
  from '../../scripts/lib/preview-canary-context.mjs';
import { readFileSync } from 'node:fs';

const sha = '61e23ac09e714f968a55b36eae965fa58870e6ac';
const hostname = 'mosaic-life-tracker-ni5kbsjw7-carls-projects-72516fde.vercel.app';
const context = {
  repository: 'carlers/mosaic-life-tracker', eventName: 'push',
  branch: AUTO_PREVIEW_PILOT_BRANCH, sha, checkoutSha: sha,
  ref: 'refs/heads/' + AUTO_PREVIEW_PILOT_BRANCH, enabled: 'true',
  vercelOrgId: OFFICIAL_VERCEL_ORG_ID,
  vercelProjectId: OFFICIAL_VERCEL_PROJECT_ID,
};
const deployment = {
  id: 'dpl_example', url: hostname, readyState: 'READY',
  project: { id: OFFICIAL_VERCEL_PROJECT_ID }, target: null, source: 'cli',
  meta: { githubCommitRef: 'HEAD', githubCommitSha: sha,
    githubRepo: 'mosaic-life-tracker', githubOrg: 'carlers' },
};
const target = { hostname, branch: AUTO_PREVIEW_PILOT_BRANCH,
  sha, alias: AUTO_PREVIEW_PILOT_ALIAS };

describe('automatic Preview pilot security (#592)', () => {
  it('accepts only opt-in official stable branch push and exact checkout', () => {
    expect(assessAutomaticPreviewContext(context).eligible).toBe(true);
    for (const different of [
      { eventName: 'workflow_dispatch' }, { eventName: 'pull_request' },
      { enabled: 'false' }, { enabled: undefined },
      { branch: 'main', ref: 'refs/heads/main' },
      { branch: 'dev', ref: 'refs/heads/dev' },
      { branch: 'feature/other', ref: 'refs/heads/feature/other' },
      { repository: 'attacker/mosaic-life-tracker' },
      { checkoutSha: 'a'.repeat(40) }, { sha: 'not-a-sha' },
      { vercelOrgId: 'wrong' }, { vercelProjectId: 'wrong' },
    ]) {
      expect(assessAutomaticPreviewContext({ ...context, ...different }).eligible).toBe(false);
    }
  });

  it('checks the live READY CLI deployment and refuses all invalid aliases or sources', () => {
    expect(assertAutomaticPreviewDeployment(deployment, target)).toBe('dpl_example');
    for (const diff of [
      { readyState: 'ERROR' }, { readyState: 'BUILDING' },
      { target: 'production' }, { source: 'git' },
      { project: { id: 'wrong' } }, { url: 'attacker.vercel.app' },
      { meta: { ...deployment.meta, githubCommitRef: AUTO_PREVIEW_PILOT_BRANCH } },
      { meta: { ...deployment.meta, githubCommitSha: 'a'.repeat(40) } },
      { meta: { ...deployment.meta, githubOrg: 'attacker' } },
    ]) expect(() => assertAutomaticPreviewDeployment({ ...deployment, ...diff }, target)).toThrow();
    for (const diff of [
      { alias: 'mosaic-life-tracker.vercel.app' }, { alias: 'custom.example.com' },
      { branch: 'main' }, { sha: 'bad' }, { hostname: 'evil.example.com' },
    ]) expect(() => assertAutomaticPreviewDeployment(deployment, { ...target, ...diff })).toThrow();
  });

  it('auto workflow is fail-closed, one-branch-only, and disabled until owner setup', () => {
    const yaml = readFileSync(new URL('../../../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');
    const job = yaml.split('\n  preview_auto_pilot:\n')[1];
    expect(job).toContain("github.event_name == 'push'");
    expect(job).toContain("vars.MOSAIC_AUTO_PREVIEW_ENABLED == 'true'");
    expect(job).toContain("needs.canonical_acceptance.result == 'success'");
    expect(job).toContain("github.ref == 'refs/heads/" + AUTO_PREVIEW_PILOT_BRANCH + "'");
    expect(job).toContain('environment: mosaic-preview-auto');
    expect(job).toContain('node scripts/check-preview-deploy-gate.mjs');
    expect(job).toContain('PREVIEW_DEPLOY_ALLOW_CURRENT_RUN: \'true\'');
    expect(job).toContain('PREVIEW_AUTO_ALIAS: ' + AUTO_PREVIEW_PILOT_ALIAS);
    expect(job).toContain('node scripts/check-preview-auto-alias.mjs');
    expect(job).toContain('vercel alias set "$url" "$PREVIEW_AUTO_ALIAS"');
    expect(job).toContain('vercel deploy --yes --prebuilt --target=preview');
    expect(job).not.toContain('secrets.MOSAIC_PREVIEW_CANARY_VERCEL_TOKEN');
    expect(job).not.toContain('workflow_dispatch');
  });
});
