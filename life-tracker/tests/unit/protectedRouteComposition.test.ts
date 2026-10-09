import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentRoot = fileURLToPath(new URL('../../src/components/', import.meta.url));

function sheetFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sheetFiles(path);
    return entry.name.endsWith('Sheet.tsx') ? [path] : [];
  });
}

describe('UI composition architecture contracts', () => {
  it('generates protected routes from required metadata instead of ad hoc page declarations', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/App.tsx', import.meta.url)), 'utf8');
    expect(source).toContain('PROTECTED_ROUTES.map((route)');
    // Only the auth/reset routes and the canonical / redirect are literal:
    // protected pages are all registered via the typed metadata registry.
    const literals = [...source.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map((match) => match[1]);
    expect(literals).toEqual(['/reset-password', '/login', '/']);
  });

  it('requires all ordinary sheet components to use the shared modal primitive', () => {
    // Explicit architectural exceptions: the primitive itself and the Alerts
    // adapter that delegates into FriendDayViewSheet (a BottomSheet consumer).
    const exceptions = new Set([
      'ui/BottomSheet.tsx',
      'friend/AlertFriendDaySheet.tsx',
    ]);
    for (const file of sheetFiles(componentRoot)) {
      const path = relative(componentRoot, file).replaceAll('\\', '/');
      if (exceptions.has(path)) continue;
      const source = readFileSync(file, 'utf8');
      expect(source, path + ' must reuse BottomSheet (or document an exception)')
        .toContain('<BottomSheet');
    }
  });
});
