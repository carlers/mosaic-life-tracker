import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROTECTED_ROUTES } from '../../src/lib/protectedRoutes';

const hostingConfig = JSON.parse(readFileSync(
  new URL('../../vercel.json', import.meta.url),
  'utf8'
)) as { rewrites: Array<{ source: string; destination: string }> };

function servesAppShell(pathname: string): boolean {
  // Vercel's explicit route list supports exact paths and named splat prefixes.
  return hostingConfig.rewrites.some(({ source, destination }) =>
    destination === '/index.html' && (
      source === pathname ||
      (source.endsWith('/:path*') &&
        pathname.startsWith(source.slice(0, -'/:path*'.length) + '/'))
    )
  );
}

describe('hosted BrowserRouter deep links', () => {
  it('serves the SPA for every registered protected route on a direct request', () => {
    for (const route of PROTECTED_ROUTES) {
      const pathname = route.path.replace(/:[^/]+/g, 'sample');
      expect(servesAppShell(pathname), pathname).toBe(true);
    }
  });

  it('lets unauthenticated nested Settings URLs reach the auth guard', () => {
    for (const pathname of [
      '/settings/notifications',
      '/settings/preferences',
      '/settings/releases',
      '/settings/notifcations',
    ]) {
      expect(servesAppShell(pathname), pathname).toBe(true);
    }
  });

  it('serves the public login and password-reset routes directly', () => {
    expect(servesAppShell('/login')).toBe(true);
    expect(servesAppShell('/reset-password')).toBe(true);
  });

  it('does not turn unrelated paths and static assets into the SPA', () => {
    expect(servesAppShell('/assets/index.js')).toBe(false);
    expect(servesAppShell('/some-unrelated-path')).toBe(false);
    expect(hostingConfig.rewrites.some(({ source }) => source === '/(.*)')).toBe(false);
  });
});
