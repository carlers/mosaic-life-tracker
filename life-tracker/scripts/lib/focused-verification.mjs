import { existsSync } from 'node:fs';

// Keep deleted paths in the change set: they can still require a broad gate.
// Only ESLint needs paths that exist in the current checkout.
export function planFocusedVerification(changed, fileExists = existsSync) {
  const projectFiles = changed
    .filter((path) => path.startsWith('life-tracker/'))
    .map((path) => path.slice('life-tracker/'.length));
  const lintable = projectFiles.filter((path) =>
    /\.(?:[cm]?[jt]sx?)$/.test(path) && fileExists(path)
  );
  const broad = projectFiles.some((path) =>
    path === 'package.json' ||
    path === 'package-lock.json' ||
    path.startsWith('vitest.') ||
    path.startsWith('vite.config') ||
    path.startsWith('scripts/lib/test-projects.')
  );
  return { lintable, broad };
}
