#!/usr/bin/env node
// Keep the protected-main-reviewed Quality Gate YAML unchanged while running
// Chromium and WebKit against the same sharded browser-correctness corpus.
// Playwright diagnostic @performance tests remain in a separate command.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(root, 'tests/e2e/node_modules/playwright/cli.js');
const forwarded = process.argv.slice(2);

function run(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [playwrightCli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.signal) process.exit(1);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['test', 'tests/e2e', '--config=playwright.config.mjs',
  '--reporter=line', '--grep-invert', '@performance', ...forwarded]);

if (process.env.CI === 'true') {
  // BOTH existing CI shards run WebKit with the same sharding argument. Do
  // not run a single unsharded smoke test or weaken the canonical CI YAML.
  run(['install', '--with-deps', 'webkit']);
  run(['test', 'tests/e2e', '--config=playwright.webkit.config.mjs',
    '--reporter=line', '--grep-invert', '@performance', ...forwarded],
  { MOSAIC_WEBKIT: '1' });
}
