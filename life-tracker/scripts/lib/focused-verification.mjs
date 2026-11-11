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

  // Vitest --changed does not follow CommonJS require/createRequire dependencies
  // used by server Functions. Explicitly verify the owning project whenever
  // executable Function or config files change (including deletions/renames).
  const functionFiles = projectFiles.filter((path) =>
    /\.(?:[cm]?js|tsx?|json)$/.test(path)
  );
  const forcedProjects = [];
  const drBackupChanged = functionFiles.some((path) =>
    path.startsWith('appwrite-functions/dr-backup/')
  );
  // These CommonJS modules are required by security/parity and documentation
  // contract tests in the unit project. Vitest --changed cannot reliably
  // discover native createRequire() dependencies (including tombstone GC).
  // Keep this list in sync with unit tests importing server helpers.
  const messageActionUnitOwners = new Set([
    'appwrite-functions/message-action/account-deletion.js',
    'appwrite-functions/message-action/chat-photo-auth.js',
    'appwrite-functions/message-action/chat-photo-orphans.js',
    'appwrite-functions/message-action/tombstone-gc.js',
    'appwrite-functions/message-action/main.js',
  ]);
  const messageActionUnitChanged = functionFiles.some((path) =>
    messageActionUnitOwners.has(path)
  );
  // DR handler authorization and privacy-deletion tests own the same Function
  // contract as DR unit tests; its config JSON is not imported by either suite.
  if (drBackupChanged || functionFiles.some((path) =>
    path.startsWith('appwrite-functions/message-action/')
  )) {
    forcedProjects.push('handlers');
  }
  if (drBackupChanged || messageActionUnitChanged) {
    forcedProjects.push('unit');
  }

  return { lintable, broad, docsContract, forcedProjects };
}
