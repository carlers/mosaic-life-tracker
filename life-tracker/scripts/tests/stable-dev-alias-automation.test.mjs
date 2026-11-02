import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const yaml = readFileSync(new URL('../../../.github/workflows/dev-stable-alias-delivery.yml', import.meta.url), 'utf8');
const marker = '\n  stable_dev_alias_delivery:\n';
const jobs = yaml.split(marker);
const job = jobs[1] ?? '';

test('has one protected, canonical-dependent automatic stable-dev alias delivery', () => {
  assert.equal(jobs.length, 2);
  for (const text of [
    'name: stable-dev-alias-delivery',
    'for (let attempt = 0; attempt < 48; attempt++)',
    "github.event_name == 'push'",
    "github.ref == 'refs/heads/dev'",
    'Exact-SHA canonical acceptance failed',
    'environment: mosaic-preview-auto',
    'cancel-in-progress: false',
    'secrets.MOSAIC_PREVIEW_AUTO_VERCEL_TOKEN',
    'mosaic-life-tracker-git-dev-carls-projects-72516fde.vercel.app',
    'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc',
    '/git/ref/heads/dev',
    '/check-runs?per_page=100',
    'canonical-acceptance',
    "'READY'",
    'githubCommitRef',
    'githubCommitSha',
    'deploymentId !== selected.id',
    'await assertHead();',
    'Stable dev alias readback failed',
  ]) assert.ok(job.includes(text), 'Missing delivery control: ' + text);
  assert.ok(!job.includes('actions/checkout@'), 'No candidate code may run with provider token');
  assert.ok(!job.includes('--target=production'), 'Production deployment is out of scope');
  assert.ok(!job.includes('npm ci'), 'No candidate package scripts may run with provider token');
});

test('protected alias writer JavaScript parses as a standalone module', () => {
  const begin = "          node --input-type=module <<'MOSAIC_DEV_ALIAS_NODE'\n";
  const end = '\n          MOSAIC_DEV_ALIAS_NODE';
  const start = job.indexOf(begin);
  assert.ok(start >= 0);
  const finish = job.indexOf(end, start + begin.length);
  assert.ok(finish > start);
  const code = job.slice(start + begin.length, finish)
    .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: code, encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, syntax.stderr);
});
