import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assessPreviewCanaryContext, assertPreviewCanaryContext, canaryHistoryStart, findExistingCanary,
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

/**
 * GitHub Actions jobs can inherit a false implicit success() through skipped
 * ancestors of a successful needs job. The canary follows canonical_acceptance,
 * which itself tolerates skipped promotion_check in normal full verification.
 * This YAML contract prevents an undiagnosable skipped protected job.
 */
describe('canary workflow skip-propagation contract (#592)', () => {
  it('explicitly bypasses inherited skipped ancestors but fails closed on cancellation and red canonical evidence', () => {
    const workflow = readFileSync(new URL('../../../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');
    const job = workflow.split('\n  preview_canary:\n')[1];
    expect(job).toBeDefined();
    expect(job).toContain('always() && !cancelled() &&');
    expect(job).toContain("needs.canonical_acceptance.result == 'success'");
    expect(job).toContain("github.event_name == 'workflow_dispatch'");
    expect(job).toContain("github.repository == 'carlers/mosaic-life-tracker'");
    expect(job).toContain("inputs.preview_canary_sha == github.sha");
    expect(job).toContain("vars.MOSAIC_PREBUILT_CANARY_ENABLED == 'true'");
    expect(job).toContain('environment: mosaic-preview-canary');
    expect(job).toContain('node scripts/check-preview-canary-context.mjs');
    expect(job).toContain('node scripts/check-preview-deploy-gate.mjs');
  });
});

describe('canary duplicate history window (#592)', () => {
  const nowMs = Date.parse('2026-10-12T18:00:00Z');
  const commitSeconds = Date.parse('2026-10-12T17:23:22Z') / 1000;

  it('queries from the source commit with one hour of skew rather than the entire project history', () => {
    expect(canaryHistoryStart(commitSeconds, nowMs))
      .toBe(Date.parse('2026-10-12T16:23:22Z'));
    expect(canaryHistoryStart('' + commitSeconds, nowMs))
      .toBe(Date.parse('2026-10-12T16:23:22Z'));
  });

  it('fails closed on missing, nonnumeric or future timestamps', () => {
    for (const value of [undefined, null, '', 'nope', -1, Infinity,
      (nowMs + 10 * 60_000) / 1000]) {
      expect(() => canaryHistoryStart(value, nowMs)).toThrow(/timestamp/);
    }
  });

  it('keeps valid historic commit windows bounded and nonnegative', () => {
    expect(canaryHistoryStart(1, nowMs)).toBe(0);
  });

  it('locks the read-only API query and paging contract so truncated histories cannot silently pass', () => {
    const script = readFileSync(new URL('../../scripts/check-preview-canary-duplicate.mjs', import.meta.url), 'utf8');
    expect(script).toContain("url.searchParams.set('since', String(since))");
    expect(script).toContain("url.searchParams.set('limit', '100')");
    expect(script).toContain('if (!existing && !complete) throw');
    expect(script).toContain('findExistingCanary(data.deployments, branch, sha)');
    expect(script).toContain("git('rev-parse', 'HEAD') !== sha");
  });
});

describe('protected Vercel canary dependency installation contract (#592)', () => {
  it('installs project lockfile dependencies before local vercel build and after authorization', () => {
    const workflow = readFileSync(new URL('../../../.github/workflows/quality-gate.yml', import.meta.url), 'utf8');
    const job = workflow.split('\n  preview_canary:\n')[1];
    expect(job).toBeTruthy();
    const duplicate = job.indexOf('run: node scripts/check-preview-canary-duplicate.mjs');
    const install = job.indexOf('run: npm ci --prefer-offline --no-audit --no-fund');
    const pull = job.indexOf('run: vercel pull --yes --environment=preview');
    const build = job.indexOf('run: vercel build');
    expect(duplicate).toBeGreaterThan(0);
    expect(install).toBeGreaterThan(duplicate);
    expect(pull).toBeGreaterThan(duplicate);
    expect(build).toBeGreaterThan(install);
    expect(job).toContain('if: steps.duplicates.outputs.skip != \'true\'');
    // No uncontrolled npm install: only the committed lockfile is authoritative.
    expect(job).not.toContain('run: npm install\n');
    expect(job).toContain('needs.canonical_acceptance.result == \'success\'');
    expect(job).toContain('environment: mosaic-preview-canary');
  });
});
