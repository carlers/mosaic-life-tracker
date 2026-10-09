import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('protected route registration architectural contract', () => {
  it('generates protected routes from required metadata instead of ad hoc page declarations', () => {
    const appSource = readFileSync(
      fileURLToPath(new URL('../../src/App.tsx', import.meta.url)), 'utf8'
    );
    expect(appSource).toContain('PROTECTED_ROUTES.map((route)');
    // The only literal paths outside the generated protected entries are
    // public auth/reset and the canonical home redirect.
    const literalPaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map((match) => match[1]);
    expect(literalPaths).toEqual(['/']);
    const multilinePaths = [...appSource.matchAll(/<Route\s*\n\s*path="([^"]+)"/g)]
      .map((match) => match[1]);
    expect(multilinePaths).toEqual(['/reset-password', '/login']);
  });
});
