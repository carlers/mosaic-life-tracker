#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { compareFeaturePresence, formatFeatureParity } from './lib/build-feature-parity.mjs';

// Read-only preflight. Supply only sanitized key/target/gitBranch metadata;
// never write raw Vercel API responses containing encrypted variable values.
const [sourceBranch, targetBranch = 'dev', metadataPath] = process.argv.slice(2);
if (!sourceBranch || !metadataPath) {
  console.error('Usage: node scripts/check-build-feature-parity.mjs <stable-preview-branch> <target-branch> <sanitized-env-scopes.json>');
  process.exitCode = 2;
} else {
  try {
    const raw = JSON.parse(await readFile(metadataPath, 'utf8'));
    const rows = Array.isArray(raw) ? raw : raw.envs ?? raw.result?.envs;
    if (!Array.isArray(rows) || rows.some(row => row && ('value' in row))) {
      throw new Error('Expected sanitized scopes only (key, target, gitBranch); do not save secret value fields');
    }
    const result = compareFeaturePresence(rows, sourceBranch, targetBranch);
    console.log(formatFeatureParity(result));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error('Cannot verify build-feature scopes: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}
