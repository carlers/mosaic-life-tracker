#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareVersions,
  nextVersion,
  updatedAppVersion,
  validateVersionFiles,
} from './lib/versioning.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const paths = {
  package: join(root, 'package.json'),
  lock: join(root, 'package-lock.json'),
  app: join(root, 'src/lib/appVersion.ts'),
};

function main(args) {
  const packageJson = JSON.parse(readFileSync(paths.package, 'utf8'));
  const lockJson = JSON.parse(readFileSync(paths.lock, 'utf8'));
  const appSource = readFileSync(paths.app, 'utf8');
  const current = validateVersionFiles(packageJson, lockJson, appSource);
  if (args[0] === 'check' && args.length === 1) {
    console.log(`Version contract passed: ${current}`);
    return;
  }
  if (args.length !== 2 || !['bump', 'set'].includes(args[0])) {
    throw new Error('Usage: npm run version:check OR npm run version:bump -- minor|patch|major OR npm run version:set -- X.Y.Z');
  }
  const next = args[0] === 'bump' ? nextVersion(current, args[1]) : args[1];
  if (compareVersions(next, current) <= 0) {
    throw new Error(`Refusing non-increasing version ${next} (current: ${current})`);
  }
  const updatedApp = updatedAppVersion(appSource, next);
  packageJson.version = next;
  lockJson.version = next;
  lockJson.packages[''].version = next;
  // Validate all three in memory before writing anything.
  validateVersionFiles(packageJson, lockJson, updatedApp);
  writeFileSync(paths.package, JSON.stringify(packageJson, null, 2) + '\n');
  writeFileSync(paths.lock, JSON.stringify(lockJson, null, 2) + '\n');
  writeFileSync(paths.app, updatedApp);
  console.log(`Version updated: ${current} -> ${next}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
