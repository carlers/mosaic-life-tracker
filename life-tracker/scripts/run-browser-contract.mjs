#!/usr/bin/env node
// Keep the protected-main-reviewed Quality Gate YAML unchanged while making
// WebKit task-entry regression part of its existing required browser job.
// On CI, shard 1 runs WebKit after the unchanged Chromium browser contracts.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(root, 'tests/e2e/node_modules/playwright/cli.js');
const forwarded = process.argv.slice(2);

function run(args) {
  const result = spawnSync(process.execPath, [playwrightCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.signal) process.exit(1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Preserve the original CLI flags and all caller-provided Playwright args.
run(['test', 'tests/e2e', '--config=playwright.config.mjs',
  '--reporter=line', '--grep-invert', '@performance', ...forwarded]);

const shard = forwarded.find(arg => arg.startsWith('--shard='));
const firstShard = !shard || /^--shard=1\/\d+$/.test(shard);
if (process.env.CI === 'true' && firstShard) {
  // GitHub's supported Ubuntu runner provides package management for the
  // pinned Playwright WebKit engine. Fedora local users can run the separate
  // explicit npm run test:webkit-contract command in a supported container.
  run(['install', '--with-deps', 'webkit']);
  run(['test', 'tests/e2e/webkit-task-entry.spec.mjs',
    '--config=playwright.webkit.config.mjs', '--reporter=line']);
}
