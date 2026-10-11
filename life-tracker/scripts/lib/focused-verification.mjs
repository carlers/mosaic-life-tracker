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
  // Markdown is read via fs by documentationContracts.test.ts, not imported
  // through Vitest's changed-file graph. The exact failure from #520 would
  // otherwise slip through focused CI and fail only on stable Preview.
  const docsContract = changed.some((path) =>
    path === 'AGENTS.md' ||
    path === 'life-tracker/AGENTS.md' ||
    path === 'life-tracker/README.md' ||
    path.startsWith('life-tracker/docs/') && path.endsWith('.md')
  );
  return { lintable, broad, docsContract };
}
