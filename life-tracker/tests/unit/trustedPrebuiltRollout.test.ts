import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { assertIsolatedCanaryGitDisable } from '../../scripts/lib/prebuilt-provider-contract.mjs';
import { PREBUILT_CANARY_BRANCH, PREBUILT_PILOT_BRANCH } from
  '../../scripts/lib/prebuilt-receiver-gate.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, matchesGlob } from 'node:path';
import {
  approvedHighLevelConfigHashes, expectedIsolatedGitConfig,
  expectedDefaultCiFirstGitConfig,
  isExactPrebuiltSourceOptIn, TRUSTED_HIGH_LEVEL_CONFIG_SHA256,
} from '../../scripts/lib/prebuilt-candidate-payload.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

describe('one-branch Git-auto cutover safety (#592)', () => {
  it('explicitly suppresses all supported ordinary stable branches without disabling main/dev', async () => {
    const bytes = expectedDefaultCiFirstGitConfig();
    const rules = JSON.parse(bytes.toString()).git.deploymentEnabled as Record<string, boolean>;
    const baseline = JSON.parse((await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'))).toString());
    const inherited = JSON.parse(bytes.toString());
    expect(inherited.rewrites).toEqual(baseline.rewrites);
    expect(inherited.headers).toEqual(baseline.headers);
    expect(inherited.framework).toBe(baseline.framework);
    expect(inherited.buildCommand).toBe(baseline.buildCommand);
    expect(inherited.outputDirectory).toBe(baseline.outputDirectory);
    const deploys = (branch: string) => {
      const matched = Object.entries(rules).filter(([pattern]) => matchesGlob(branch, pattern));
      return matched.length === 0 || matched.some(([, yes]) => yes);
    };
    for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
      expect(rules[category + '/*']).toBe(false);
      expect(deploys(category + '/new-feature'), category).toBe(false);
      expect(deploys(category + '/nested/unsupported'), category).toBe(true);
      expect(assertIsolatedCanaryGitDisable(bytes, category + '/new-feature')).toBe(true);
    }
    for (const branch of ['main', 'dev']) expect(deploys(branch)).toBe(true);
    for (const branch of ['chatgpt/work', 'codex/work'])
      expect(deploys(branch)).toBe(false);
    expect(() => assertIsolatedCanaryGitDisable(bytes, PREBUILT_CANARY_BRANCH)).toThrow();
    expect(() => assertIsolatedCanaryGitDisable(Buffer.from(bytes.toString()
      .replace('"main": true', '"main": false')), 'feature/new-feature')).toThrow();
  });

  it('requires an exact opt-in and preserves non-opted-in category branches', async () => {
    const base = await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'));
    for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
      const branch = category + '/verified-work';
      const raw = expectedIsolatedGitConfig(branch);
      const policy = JSON.parse(raw.toString('utf8')).git.deploymentEnabled as
        Record<string, boolean>;
      expect(isExactPrebuiltSourceOptIn(raw, branch)).toBe(true);
      expect(isExactPrebuiltSourceOptIn(base, branch)).toBe(false);
      expect(isExactPrebuiltSourceOptIn(raw, category + '/other')).toBe(false);
      expect(policy[branch]).toBe(false);
      expect(policy[category + '/*']).toBeUndefined();
      expect(policy[category + '/!(verified-work)']).toBe(true);
      const hosted = (name: string) => {
        const matches = Object.entries(policy).filter(([pattern]) =>
          matchesGlob(name, pattern));
        return matches.length === 0 || matches.some(([, enabled]) => enabled);
      };
      expect(hosted(branch)).toBe(false);
      expect(hosted(category + '/another')).toBe(true);
      for (const unchanged of ['dev','main','chatgpt/task','codex/task',
        'feature/other','fix/other','perf/other','security/other','refactor/other']) {
        if (unchanged === branch) continue;
        expect(hosted(unchanged)).toBe(!unchanged.startsWith('chatgpt/') &&
          !unchanged.startsWith('codex/'));
      }
      for (const forged of [
        Buffer.from(raw.toString('utf8').replace('"main": true', '"main": false')),
        Buffer.from(raw.toString('utf8').replace('"'+branch+'": false',
          '"'+branch+'": true')),
        Buffer.from(raw.toString('utf8').replace(
          '"'+category+'/!(verified-work)": true',
          '"'+category+'/*": true')),
      ]) {
        expect(isExactPrebuiltSourceOptIn(forged, branch)).toBe(false);
        expect(() => assertIsolatedCanaryGitDisable(forged, branch)).toThrow();
      }
      expect(assertIsolatedCanaryGitDisable(raw, branch)).toBe(true);
    }
    for (const unsafe of ['dev', 'main', 'chatgpt/no', 'feature/nested/path',
      'feature/name)', 'security/Name']) {
      expect(isExactPrebuiltSourceOptIn(base, unsafe)).toBe(false);
      expect(() => expectedIsolatedGitConfig(unsafe)).toThrow();
    }
  });

  it('allows only exact reviewed source config or fix-category-disabled variant', async () => {
    const raw = await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'));
    expect(digest(raw)).toBe(TRUSTED_HIGH_LEVEL_CONFIG_SHA256);
    const text = raw.toString('utf8');
    expect(text.split('"fix/*": true,')).toHaveLength(2);
    const off = Buffer.from(text.replace('"fix/*": true,',
      '"fix/!(592-trusted-archive-20261014)": true,\n      "fix/592-trusted-archive-20261014": false,'));
    const allowlist = approvedHighLevelConfigHashes();
    expect(allowlist.size).toBe(2);
    expect(allowlist.has(digest(raw))).toBe(true);
    expect(allowlist.has(digest(off))).toBe(true);
    expect(allowlist.has(digest(Buffer.from(text.replace('"main": true,', '"main": false,')))))
      .toBe(false);
    const initial = JSON.parse(text);
    const disabled = JSON.parse(off.toString('utf8'));
    expect(disabled.git.deploymentEnabled['fix/*']).toBeUndefined();
    expect(disabled.git.deploymentEnabled['fix/!(592-trusted-archive-20261014)'])
      .toBe(true);
    expect(disabled.git.deploymentEnabled['fix/592-trusted-archive-20261014']).toBe(false);
    expect(disabled.git.deploymentEnabled.main).toBe(true);
    expect(disabled.git.deploymentEnabled.dev).toBe(true);
    expect(disabled.git.deploymentEnabled['feature/*']).toBe(true);
    expect(disabled.headers).toEqual(initial.headers);
    expect(disabled.rewrites).toEqual(initial.rewrites);
    expect(disabled.framework).toBe(initial.framework);
    expect(disabled.buildCommand).toBe(initial.buildCommand);
    expect(disabled.outputDirectory).toBe(initial.outputDirectory);
  });

  it('isolates only one feature pilot and preserves every other Git Preview', async () => {
    const isolated = expectedIsolatedGitConfig(PREBUILT_PILOT_BRANCH);
    expect(assertIsolatedCanaryGitDisable(isolated, PREBUILT_PILOT_BRANCH))
      .toBe(true);
    expect(approvedHighLevelConfigHashes(PREBUILT_PILOT_BRANCH).has(
      digest(isolated))).toBe(true);
    expect(expectedIsolatedGitConfig(PREBUILT_CANARY_BRANCH))
      .not.toEqual(isolated);
    expect(() => expectedIsolatedGitConfig('feature/unreviewed/extra')).toThrow();
    expect(() => assertIsolatedCanaryGitDisable(
      expectedIsolatedGitConfig(PREBUILT_CANARY_BRANCH),
      PREBUILT_PILOT_BRANCH)).toThrow();
    const original = JSON.parse(await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'), 'utf8'));
    const next = JSON.parse(isolated.toString('utf8'));
    const rules = next.git.deploymentEnabled as Record<string, boolean>;
    expect(rules['feature/*']).toBeUndefined();
    expect(rules['feature/!(592-prebuilt-pilot-20261014)']).toBe(true);
    expect(rules[PREBUILT_PILOT_BRANCH]).toBe(false);
    for (const keep of ['main','dev','fix/*','perf/*','security/*','refactor/*'])
      expect(rules[keep]).toBe(true);
    for (const quiet of ['chatgpt/*','codex/*','*'])
      expect(rules[quiet]).toBe(false);
    const deploys = (branch: string, policy: Record<string, boolean>) => {
      const matches = Object.entries(policy).filter(([pattern]) =>
        matchesGlob(branch, pattern));
      return matches.length === 0 || matches.some(([, value]) => value);
    };
    expect(deploys(PREBUILT_PILOT_BRANCH, rules)).toBe(false);
    for (const other of ['feature/diary', 'feature/other', 'fix/task',
      'perf/speed', 'security/guard', 'refactor/cleanup', 'dev', 'main'])
      expect(deploys(other, rules), other).toBe(true);
    for (const quiet of ['chatgpt/task', 'codex/task'])
      expect(deploys(quiet, rules)).toBe(false);
    expect(deploys(PREBUILT_PILOT_BRANCH,
      { ...rules, 'feature/*': true })).toBe(true); // provider true wins
    for (const mutated of [
      { ...next, git: { deploymentEnabled: { ...rules, main: false } } },
      { ...next, git: { deploymentEnabled: { ...rules, dev: false } } },
      { ...next, git: { deploymentEnabled: { ...rules, 'feature/*': true } } },
      { ...next, headers: [] },
    ]) expect(() => assertIsolatedCanaryGitDisable(
      Buffer.from(JSON.stringify(mutated)), PREBUILT_PILOT_BRANCH)).toThrow();
    expect(next.rewrites).toEqual(original.rewrites);
    expect(next.headers).toEqual(original.headers);
  });

  it('reproduces the failed unmatched-branch rule and enforces exact suppression', async () => {
    const original = JSON.parse(await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'), 'utf8'));
    const before = { ...original.git.deploymentEnabled };
    const canary = 'fix/592-trusted-archive-20261014';
    const mistaken = { ...before };
    delete mistaken['fix/*'];
    mistaken['fix/!(592-trusted-archive-20261014)'] = true;

    // Node 24 matchesGlob provides standard slash-sensitive glob/extglob behavior.
    // Vercel's documented policy defaults to true when NO pattern matches and
    // also deploys whenever ANY matching rule is true.
    const deploys = (branch: string, rules: Record<string, boolean>) => {
      const matched = Object.entries(rules).filter(([pattern]) =>
        matchesGlob(branch, pattern));
      return matched.length === 0 || matched.some(([, enabled]) => enabled);
    };
    expect(matchesGlob(canary, '*')).toBe(false);
    expect(matchesGlob(canary, 'fix/!(592-trusted-archive-20261014)')).toBe(false);
    expect(deploys(canary, mistaken)).toBe(true); // reproduced real provider waste

    const corrected = { ...mistaken, [canary]: false };
    expect(deploys(canary, corrected)).toBe(false);
    for (const other of ['fix/other-bug', 'fix/592-not-this-one', 'dev',
      'main', 'feature/diary', 'perf/speed', 'security/header', 'refactor/foo'])
      expect(deploys(other, corrected), other).toBe(true);
    for (const quiet of ['chatgpt/work', 'codex/work'])
      expect(deploys(quiet, corrected), quiet).toBe(false);

    const overlap = { ...corrected, 'fix/*': true };
    expect(deploys(canary, overlap)).toBe(true); // true overrides false
  });
});
