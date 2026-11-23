#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateVersionFiles } from './lib/versioning.mjs';
import { validatePwaReleaseNotes } from './lib/pwa-release-notes.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const appSource = readFileSync(resolve(root, 'src/lib/appVersion.ts'), 'utf8');
  validateVersionFiles(pkg, lock, appSource);
  const catalog = JSON.parse(readFileSync(resolve(root, 'src/data/pwaUpdateNotes.json'), 'utf8'));
  const current = validatePwaReleaseNotes(pkg.version, catalog);
  console.log('PWA release notes verified for v' + current.version);
} catch (error) {
  console.error('PWA release-note gate failed: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
