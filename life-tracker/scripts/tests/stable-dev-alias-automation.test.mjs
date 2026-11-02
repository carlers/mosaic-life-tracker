import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const yaml = readFileSync(new URL('../../../.github/workflows/dev-stable-alias-delivery.yml', import.meta.url), 'utf8');
const marker = '\n  stable_dev_alias_delivery:\n';
const jobs = yaml.split(marker);
const job = jobs[1] ?? '';

test('has one protected, canonical-dependent automatic stable-dev alias delivery', () => {
  assert.equal(jobs.length, 2);
  for (const text of [
    'name: stable-dev-alias-delivery',
    'for (let attempt = 0; attempt < 48; attempt++)',
    'statuses: read',
    '      checks: read\n      statuses: read',
    '/status?per_page=100',
    'deploymentIdFromStatus',
    'Vercel status points to an untrusted URL',
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
  assert.ok(!job.includes('/v6/deployments?'), 'Do not depend on listing deployment metadata');
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

test('Vercel status parser accepts only official deployment URLs', () => {
  const start = job.indexOf('          function deploymentIdFromStatus(status) {');
  const end = job.indexOf('\n          let selected = null;', start);
  assert.ok(start >= 0 && end > start, 'Safe deployment parser missing');
  const code = job.slice(start, end).split('\n')
    .map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  const parse = runInNewContext(code + '\ndeploymentIdFromStatus');
  const valid = { context: 'Vercel – mosaic-life-tracker', state: 'success',
    target_url: 'https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/7nWVpWBaFm6TzGd3MsnEsLTFVY97' };
  assert.equal(parse(valid), 'dpl_7nWVpWBaFm6TzGd3MsnEsLTFVY97');
  for (const bad of [
    { ...valid, context: 'Vercel – another-project' },
    { ...valid, state: 'failure' },
    { ...valid, target_url: 'https://vercel.com/another-team/mosaic-life-tracker/7nWVpWBaFm6TzGd3MsnEsLTFVY97' },
    { ...valid, target_url: 'https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/dpl_7nWVpWBaFm6TzGd3MsnEsLTFVY97/extra' },
    { ...valid, target_url: 'https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/7nWVpWBaFm6TzGd3MsnEsLTFVY97?redirect=true' },
  ]) assert.equal(parse(bad), null);
});
