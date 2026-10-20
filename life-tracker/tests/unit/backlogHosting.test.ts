import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchProtectedRoute } from '../../src/lib/protectedRoutes';

describe('Backlogs hosted SPA route', () => {
  it('serves the app shell on a direct /backlog request', () => {
    expect(matchProtectedRoute('/backlog')?.id).toBe('backlog');
    expect(matchProtectedRoute('/uncompleted')?.id).toBe('uncompleted');

    const config = JSON.parse(readFileSync(
      fileURLToPath(new URL('../../vercel.json', import.meta.url)),
      'utf8'
    )) as { rewrites: Array<{ source: string; destination: string }> };

    expect(config.rewrites).toContainEqual({
      source: '/backlog',
      destination: '/index.html',
    });
    expect(config.rewrites).toContainEqual({ source: '/uncompleted', destination: '/index.html' });
    expect(config.rewrites).not.toContainEqual({
      source: '/(.*)',
      destination: '/index.html',
    });
  });
});
