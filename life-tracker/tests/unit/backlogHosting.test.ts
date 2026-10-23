import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchProtectedRoute } from '../../src/lib/protectedRoutes';

describe('Backlogs hosted SPA route', () => {
  it('serves the app shell on a direct /backlog request', () => {
    expect(matchProtectedRoute('/backlog')?.id).toBe('backlog');

    const config = JSON.parse(readFileSync(
      fileURLToPath(new URL('../../vercel.json', import.meta.url)),
      'utf8'
    )) as { rewrites: Array<{ source: string; destination: string }> };

    expect(config.rewrites).toContainEqual({
      source: '/backlog',
      destination: '/index.html',
    });
    // Query-based list mode reuses the existing trusted /backlog SPA rewrite.
    expect(config.rewrites.some(rule => rule.source === '/uncompleted')).toBe(false);
    expect(config.rewrites).not.toContainEqual({
      source: '/(.*)',
      destination: '/index.html',
    });
  });
});
