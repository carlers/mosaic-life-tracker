import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isExactPrebuiltSourceOptIn, expectedIsolatedGitConfig,
  expectedDefaultCiFirstGitConfig } from
  '../../scripts/lib/prebuilt-candidate-payload.mjs';
import { sourceOptInStatus } from '../../scripts/lib/prebuilt-github-admission.mjs';
import { PREBUILT_CANARY_BRANCH, PREBUILT_PILOT_BRANCH,
  REVIEWED_GENERIC_QUALITY_GATE_BLOB, assertReviewedGenericQualityGate } from
  '../../scripts/lib/prebuilt-receiver-gate.mjs';

const sha = 'a'.repeat(40);
const repo = 'carlers/mosaic-life-tracker';
const event = (branch: string, conclusion = 'success') => ({
  repository: { full_name: repo },
  workflow_run: { name: 'Quality Gate', event: 'push',
    status: 'completed', conclusion, head_sha: sha, head_branch: branch,
    repository: { full_name: repo }, head_repository: { full_name: repo } },
});
const fileResponse = (body: Buffer) => ({
  ok: true, json: async () => ({
    encoding: 'base64', content: body.toString('base64'),
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('default-off generic CI-first Preview admission #592', () => {
  it('rejects a changed candidate Quality Gate definition before provider admission', () => {
    expect(REVIEWED_GENERIC_QUALITY_GATE_BLOB).toMatch(/^[a-f0-9]{40}$/);
    const generic = 'feature/normal-work';
    expect(assertReviewedGenericQualityGate(generic,
      REVIEWED_GENERIC_QUALITY_GATE_BLOB)).toBe(true);
    for (const changed of [null, undefined, '', 'f'.repeat(40)])
      expect(() => assertReviewedGenericQualityGate(generic, changed))
        .toThrow(/Unreviewed/);
    expect(() => assertReviewedGenericQualityGate('feature/nested/path',
      REVIEWED_GENERIC_QUALITY_GATE_BLOB)).toThrow(/Unreviewed/);
    expect(assertReviewedGenericQualityGate(PREBUILT_CANARY_BRANCH, null)).toBe(true);
    expect(assertReviewedGenericQualityGate(PREBUILT_PILOT_BRANCH, null)).toBe(true);
  });

  it('never performs even a source policy lookup for ordinary stable CI while disabled', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const branch of ['feature/normal-work', 'fix/issue',
      'perf/startup', 'security/review', 'refactor/modules']) {
      expect(await sourceOptInStatus(event(branch))).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('admits only the exact reviewed, source-SHA Git suppression when enabled', async () => {
    const branch = 'feature/normal-work';
    vi.stubEnv('MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED', 'true');
    const optIn = expectedIsolatedGitConfig(branch);
    const fetcher = vi.fn().mockResolvedValue(fileResponse(optIn));
    vi.stubGlobal('fetch', fetcher);
    expect(await sourceOptInStatus(event(branch))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/vercel.json?ref=' + sha);
    const unmodified = await readFile(new URL('../../scripts/lib/trusted-prebuilt-vercel.json',
      import.meta.url));
    expect(isExactPrebuiltSourceOptIn(unmodified, branch)).toBe(false);
    fetcher.mockResolvedValue(fileResponse(unmodified));
    expect(await sourceOptInStatus(event(branch))).toBe(false);
    fetcher.mockResolvedValue(fileResponse(Buffer.from(optIn.toString('utf8')
      .replace('"feature/normal-work": false', '"feature/normal-work": true'))));
    expect(await sourceOptInStatus(event(branch))).toBe(false);
    fetcher.mockResolvedValue(fileResponse(expectedIsolatedGitConfig('feature/other')));
    expect(await sourceOptInStatus(event(branch))).toBe(false);
  });

  it('admits inherited CI-first suppression for every new single-leaf stable category without one-off edits', async () => {
    vi.stubEnv('MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED', 'true');
    const inherited = expectedDefaultCiFirstGitConfig();
    const rules = JSON.parse(inherited.toString()).git.deploymentEnabled;
    expect(rules.main).toBe(true);
    expect(rules.dev).toBe(true);
    for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
      expect(rules[category + '/*']).toBe(false);
      const branch = category + '/issue-852';
      expect(isExactPrebuiltSourceOptIn(inherited, branch)).toBe(true);
      const fetcher = vi.fn().mockResolvedValue(fileResponse(inherited));
      vi.stubGlobal('fetch', fetcher);
      expect(await sourceOptInStatus(event(branch))).toBe(true);
      expect(await sourceOptInStatus(event(branch), { returnSourceBytes: true }))
        .toEqual(inherited);
      vi.unstubAllGlobals();
    }
    for (const branch of ['dev', 'main', 'feature/nested/path',
      PREBUILT_CANARY_BRANCH, PREBUILT_PILOT_BRANCH]) {
      expect(isExactPrebuiltSourceOptIn(inherited, branch)).toBe(false);
    }
    const forged = Buffer.from(inherited.toString()
      .replace('"feature/*": false', '"feature/*": true'));
    expect(isExactPrebuiltSourceOptIn(forged, 'feature/issue-852')).toBe(false);
  });

  it('rejects red, forged, unscoped, nested or quiet task pushes before external requests', async () => {
    vi.stubEnv('MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED', 'true');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const bad = [
      event('feature/other', 'failure'), event('feature/other', 'cancelled'),
      event('feature/nested/path'), event('dev'), event('main'),
      event('chatgpt/other'), event('feature/invalid)'),
      { ...event('feature/other'), repository: { full_name: 'attacker/repo' } },
      { ...event('feature/other'), workflow_run: {
        ...event('feature/other').workflow_run, head_sha: 'invalid' } },
    ];
    for (const input of bad)
      expect(await sourceOptInStatus(input)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves the two existing reviewed pilots with generic rollout disabled', async () => {
    const fetcher = vi.fn((url: string) => Promise.resolve(fileResponse(
      expectedIsolatedGitConfig(url.includes('none') ?
        PREBUILT_PILOT_BRANCH : PREBUILT_CANARY_BRANCH))));
    vi.stubGlobal('fetch', fetcher);
    expect(await sourceOptInStatus(event(PREBUILT_CANARY_BRANCH))).toBe(true);
    fetcher.mockResolvedValueOnce(fileResponse(expectedIsolatedGitConfig(PREBUILT_PILOT_BRANCH)));
    expect(await sourceOptInStatus(event(PREBUILT_PILOT_BRANCH))).toBe(true);
  });

  it('keeps privileged delivery behind read-only admission and the separate rollout switch', async () => {
    const workflow = await readFile(new URL('../../../.github/workflows/trusted-preview-delivery.yml',
      import.meta.url), 'utf8');
    expect(workflow).toContain("needs.trusted_preview.outputs.admitted == 'true'");
    expect(workflow).toContain('id: read_only_admission');
    expect(workflow).toContain('steps.read_only_admission.outputs.admitted');
    expect(workflow).toContain("vars.MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED == 'true'");
    expect(workflow).toContain("vars.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED == 'true'");
    expect(workflow).toContain("MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED: 'false'");
    expect(workflow).toContain("      - 'feature/**'");
    expect(workflow).not.toContain('environment: production');
  });
});
