import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('failed #592 Git cutover rollback safety', () => {
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