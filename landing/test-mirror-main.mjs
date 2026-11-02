import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const script = resolve(import.meta.dirname, 'mirror-main.mjs');
const content = readFileSync(script, 'utf8');
assert(content.includes('/actions/workflows/quality-gate.yml/runs?head_sha='),
  'Exact main workflow verification is required');
assert(content.includes('mainSha') && content.includes("main has advanced") === false,
  'The main source identity check must remain available');
assert(content.includes('Main has advanced; reject stale demo build'),
  'Release must fail closed if main advances');
assert(content.includes("const overlay = 'f24ddc175dca6c1c518624e408be8cfc9793ae96'"),
  'The demo adapter must remain pinned to a reviewed immutable SHA');
assert(content.includes("['landing', 'life-tracker/demo'") ||
  content.includes("'life-tracker/src/demo'"),
  'Demo adapter file scope must be explicit');
const rejected = spawnSync(process.execPath, [script], {
  cwd: root,
  env: { ...process.env, VERCEL_GIT_COMMIT_REF: 'dev' },
  encoding: 'utf8',
});
assert.equal(rejected.status, 1, 'A dev ref must fail immediately');
assert.match(rejected.stderr + rejected.stdout, /MOSAIC_DEMO_ONLY_MAIN_ALLOWED/);
console.log('MOSAIC_MAIN_MIRROR_SOURCE_GUARD_PASS');

