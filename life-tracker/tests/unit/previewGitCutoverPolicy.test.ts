import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { matchesGlob } from 'node:path';

describe('#592 exact canary Git deployment exclusion', () => {
  it('uses a non-overlapping allowlist, retaining main/dev and other Preview categories', async () => {
    const config = JSON.parse(await readFile('vercel.json', 'utf8'));
    const rules = config.git?.deploymentEnabled;
    expect(rules['*']).toBe(false);
    expect(rules.main).toBe(true);
    expect(rules.dev).toBe(true);
    expect(rules['fix/*']).toBeUndefined();
    expect(rules['fix/!(592-trusted-archive-20261014)']).toBe(true);
    expect(rules['fix/592-trusted-archive-20261014']).toBe(false);
    expect(rules['feature/*']).toBe(true);
    expect(rules['perf/*']).toBe(true);
    expect(rules['security/*']).toBe(true);
    expect(rules['refactor/*']).toBe(true);
    expect(rules['chatgpt/*']).toBe(false);
    expect(rules['codex/*']).toBe(false);
    expect(Object.keys(rules)).toHaveLength(11);
  });
  it('resolves branch-matching rules without an unmatched default or overlapping true', async () => {
    const config = JSON.parse(await readFile('vercel.json', 'utf8'));
    const rules = config.git.deploymentEnabled as Record<string, boolean>;
    const decisions = (branch: string) => {
      const matches = Object.entries(rules).filter(([pattern]) =>
        matchesGlob(branch, pattern));
      // Vercel defaults an unmatched branch to enabled and ANY true match wins.
      return matches.length === 0 || matches.some(([, enabled]) => enabled);
    };
    const canary = 'fix/592-trusted-archive-20261014';
    expect(matchesGlob(canary, '*')).toBe(false);
    expect(matchesGlob(canary, 'fix/!(592-trusted-archive-20261014)')).toBe(false);
    expect(matchesGlob(canary, canary)).toBe(true);
    expect(decisions(canary)).toBe(false);
    for (const branch of ['dev', 'main', 'fix/other-bug', 'feature/diary',
      'perf/speed', 'security/hardening', 'refactor/cleanup']) {
      expect(decisions(branch), branch).toBe(true);
    }
    for (const branch of ['chatgpt/test', 'codex/test']) {
      expect(decisions(branch), branch).toBe(false);
    }
    const badRules = { ...rules, 'fix/*': true };
    const badMatches = Object.entries(badRules).filter(([pattern]) =>
      matchesGlob(canary, pattern));
    expect(badMatches.some(([, enabled]) => enabled)).toBe(true);
  });
  it('preserves exact SPA routing, headers, static config and public app behavior', async () => {
    const cfg = JSON.parse(await readFile('vercel.json', 'utf8'));
    expect(cfg.framework).toBe('vite');
    expect(cfg.buildCommand).toBe('npm run build');
    expect(cfg.outputDirectory).toBe('dist');
    expect(cfg.rewrites).toHaveLength(15);
    expect(cfg.rewrites.every((x: { destination: string }) =>
      x.destination === '/index.html')).toBe(true);
    expect(cfg.headers[0].source).toBe('/(.*)');
    expect(Object.fromEntries(cfg.headers[0].headers.map(
      (x: { key: string; value: string }) => [x.key, x.value])))
      .toMatchObject({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      });
  });
});