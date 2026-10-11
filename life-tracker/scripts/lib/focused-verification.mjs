import { existsSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const hasOwn = (value, key) => Object.hasOwn(value, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// A version stamp is not a dependency or test-runner configuration change.
// Compare complete parsed files and normalize only the explicitly allowed metadata.
// Missing, malformed, inconsistent or otherwise changed JSON always needs broad tests.
export function isOnlyVersionMetadataChange(path, beforeText, afterText) {
  if (path !== 'package.json' && path !== 'package-lock.json') return false;
  try {
    const before = JSON.parse(beforeText);
    const after = JSON.parse(afterText);
    if (!isRecord(before) || !isRecord(after) ||
        !hasOwn(before, 'version') || !hasOwn(after, 'version') ||
        typeof before.version !== 'string' || typeof after.version !== 'string' ||
        before.version === after.version) return false;

    if (path === 'package-lock.json') {
      const beforeRoot = before.packages?.[''];
      const afterRoot = after.packages?.[''];
      if (!isRecord(beforeRoot) || !isRecord(afterRoot) ||
          !hasOwn(beforeRoot, 'version') || !hasOwn(afterRoot, 'version') ||
          beforeRoot.version !== before.version || afterRoot.version !== after.version) return false;
      afterRoot.version = beforeRoot.version;
    }
    after.version = before.version;
    return isDeepStrictEqual(before, after);
  } catch {
    return false;
  }
}

// Keep deleted paths in the change set: they can still require a broad gate.
// Only ESLint needs paths that exist in the current checkout.
// Package metadata is exempt only after the caller verifies its exact base/HEAD contents.
export function planFocusedVerification(changed, fileExists = existsSync, verifiedVersionOnly = new Set()) {
  const projectFiles = changed
    .filter((path) => path.startsWith('life-tracker/'))
    .map((path) => path.slice('life-tracker/'.length));
  const lintable = projectFiles.filter((path) =>
    /\.(?:[cm]?[jt]sx?)$/.test(path) && fileExists(path)
  );
  const broad = projectFiles.some((path) =>
    ((path === 'package.json' || path === 'package-lock.json') && !verifiedVersionOnly.has(path)) ||
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
