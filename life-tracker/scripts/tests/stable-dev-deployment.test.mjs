import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStableDevDeployment, STABLE_DEV_ALIAS, MOSAIC_VERCEL_PROJECT,
} from '../lib/stable-dev-deployment.mjs';

const sha = '9b78f9127f3556ee6291b0dac927222c34a01d39';
function valid() {
  return {
    headSha: sha,
    aliasRecord: {
      alias: STABLE_DEV_ALIAS, projectId: MOSAIC_VERCEL_PROJECT,
      deploymentId: 'dpl_correct', redirect: null,
    },
    deployment: {
      id: 'dpl_correct', projectId: MOSAIC_VERCEL_PROJECT,
      readyState: 'READY', target: null,
      meta: {
        githubOrg: 'carlers', githubRepo: 'mosaic-life-tracker',
        githubCommitRef: 'dev', githubCommitSha: sha,
      },
    },
    checks: {
      total_count: 2,
      check_runs: [{name:'canonical-acceptance',status:'completed',conclusion:'success'}],
    },
  };
}

test('accepts an exact SHA-matched READY stable dev alias', () => {
  assert.deepEqual(assertStableDevDeployment(valid()), {
    sha, deploymentId: 'dpl_correct', alias: STABLE_DEV_ALIAS,
  });
});
test('rejects the reported incident: READY new build but stale stable alias', () => {
  const x = valid();
  x.deployment.meta.githubCommitSha = '764a0841d68e55e90cdca4d7a909dbc442195d26';
  assert.throws(() => assertStableDevDeployment(x), /stale/);
});
test('rejects an alias attached to a different deployment', () => {
  const x = valid();
  x.aliasRecord.deploymentId = 'dpl_old';
  assert.throws(() => assertStableDevDeployment(x), /not mapped/);
});
test('rejects wrong project and production target', () => {
  const x = valid();
  x.deployment.projectId = 'wrong';
  assert.throws(() => assertStableDevDeployment(x), /official deployment/);
  x.deployment.projectId = MOSAIC_VERCEL_PROJECT;
  x.deployment.target = 'production';
  assert.throws(() => assertStableDevDeployment(x), /READY Preview/);
});
test('rejects missing canonical acceptance and a pending deployment', () => {
  const x = valid();
  x.checks.check_runs[0].conclusion = 'failure';
  assert.throws(() => assertStableDevDeployment(x), /canonical/);
  x.checks.check_runs[0].conclusion = 'success';
  x.deployment.readyState = 'BUILDING';
  assert.throws(() => assertStableDevDeployment(x), /READY Preview/);
});
test('rejects redirected aliases, foreign repo, and wrong branch', () => {
  const x = valid();
  x.aliasRecord.redirect = 'other.vercel.app';
  assert.throws(() => assertStableDevDeployment(x), /non-redirecting/);
  x.aliasRecord.redirect = null;
  x.deployment.meta.githubRepo = 'another-repo';
  assert.throws(() => assertStableDevDeployment(x), /Git identity/);
  x.deployment.meta.githubRepo = 'mosaic-life-tracker';
  x.deployment.meta.githubCommitRef = 'feature/other';
  assert.throws(() => assertStableDevDeployment(x), /Git identity/);
});
