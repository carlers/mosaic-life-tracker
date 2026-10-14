import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { preparePreviewRoutes, sha256 } from '../../scripts/lib/preview-build-routes.mjs';

const configPath = join(process.cwd(), 'vercel.json');

async function prepared() {
  const raw = await readFile(configPath);
  return { original: JSON.parse(raw.toString('utf8')), raw, ...preparePreviewRoutes(JSON.parse(raw), raw) };
}

describe('Vercel static prebuilt routing contract (#592)', () => {
  it('generates official version 3 routes from unchanged Mosaic routing and headers', async () => {
    const preparedRoutes = await prepared();
    const { config, serialized, evidence } = preparedRoutes;
    expect(config.version).toBe(3);
    expect(config.routes.length).toBeGreaterThan(15);
    expect(config.routes.some((route: { headers?: Record<string, string> }) =>
      route.headers?.['X-Frame-Options'] === 'DENY' &&
      route.headers?.['X-Content-Type-Options'] === 'nosniff')).toBe(true);
    expect(evidence).toMatchObject({
      deploymentAuthorized: false, rewrites: 15,
      generatedConfigSha256: sha256(serialized),
      vercelConfigSha256: sha256(preparedRoutes.raw),
    });
  });

  it('preserves every declared SPA deep link but not unmatched static/resource paths', async () => {
    const { config } = await prepared();
    const rewrites = config.routes.filter((route: { dest?: string }) => route.dest === '/index.html');
    const served = (url: string) => rewrites.some((rule: { src?: string }) =>
      typeof rule.src === 'string' && new RegExp(rule.src).test(url));
    for (const url of [
      '/reset-password', '/login', '/home', '/backlog', '/bucket-list',
      '/bucket-list/123', '/explore', '/friends/alice', '/notifications',
      '/messages', '/messages/123', '/account', '/settings',
      '/settings/notifications', '/profile',
    ]) expect(served(url), url + ' routes=' + JSON.stringify(rewrites.map((r: { src?: string, dest?: string }) => [r.src, r.dest]))).toBe(true);
    for (const url of ['/assets/missing.js', '/does-not-exist', '/push-sw.js', '/favicon.svg']) {
      expect(served(url), url).toBe(false);
    }
  });

  it('fails closed on any unexpected rewrite, missing header or config capability', async () => {
    const { original, raw } = await prepared();
    expect(() => preparePreviewRoutes({
      ...original, rewrites: [...original.rewrites,
        { source: '/api/:path*', destination: 'https://untrusted.example' }],
    }, raw)).toThrow(/unsafe Preview rewrite/);
    expect(() => preparePreviewRoutes({
      ...original, headers: [],
    }, raw)).toThrow(/security headers/);
    expect(() => preparePreviewRoutes({
      ...original, redirects: [{ source: '/login', destination: 'https://untrusted.example' }],
    }, raw)).toThrow(/Unsupported/);
  });
});
