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
  // through Vitest's changed-file graph. Cover all maintained project Markdown
  // so MCP, project-intake and manual guides receive the same focused check.
  const docsContract = changed.some((path) =>
    path === 'AGENTS.md' ||
    path.startsWith('life-tracker/') && path.endsWith('.md')
  );
  return { lintable, broad, docsContract };
}
