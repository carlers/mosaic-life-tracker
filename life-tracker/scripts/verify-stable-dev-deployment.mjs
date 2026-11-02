#!/usr/bin/env node
// Read-only operator gate. No alias mutation, promotion or production access.
import {
  assertStableDevDeployment, MOSAIC_GITHUB_REPO,
  MOSAIC_VERCEL_PROJECT, MOSAIC_VERCEL_TEAM, STABLE_DEV_ALIAS,
} from './lib/stable-dev-deployment.mjs';

const ghToken = process.env.GITHUB_TOKEN ?? '';
const vercelToken = process.env.VERCEL_TOKEN ?? '';
const gh = 'https://api.github.com/repos/' + MOSAIC_GITHUB_REPO;
const v = 'https://api.vercel.com';
const suffix = '?teamId=' + encodeURIComponent(MOSAIC_VERCEL_TEAM);

async function request(url, token, label) {
  const result = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error(label + ' readback HTTP ' + result.status);
  return result.json();
}
const getGithub = path => request(gh + path, ghToken, 'GitHub');
const getVercel = path => request(v + path, vercelToken, 'Vercel');

async function liveHead() {
  const ref = await getGithub('/git/ref/heads/dev');
  return ref?.object?.sha ?? '';
}

try {
  if (!ghToken || !vercelToken) {
    throw new Error('GITHUB_TOKEN (read) and VERCEL_TOKEN (read) are required');
  }
  const headSha = await liveHead();
  if (!/^[a-f0-9]{40}$/.test(headSha)) throw new Error('Invalid live dev ref');
  const [aliasRecord, checks] = await Promise.all([
    getVercel('/v4/aliases/' + encodeURIComponent(STABLE_DEV_ALIAS) + suffix),
    getGithub('/commits/' + encodeURIComponent(headSha) + '/check-runs?per_page=100'),
  ]);
  if (aliasRecord.projectId !== MOSAIC_VERCEL_PROJECT ||
      !aliasRecord.deploymentId) throw new Error('Unexpected Vercel alias ownership or target');
  const deployment = await getVercel('/v13/deployments/' +
    encodeURIComponent(aliasRecord.deploymentId) + suffix);
  const result = assertStableDevDeployment({ headSha, aliasRecord, deployment, checks });
  if (await liveHead() !== headSha) throw new Error('Dev advanced during alias verification');
  console.log('STABLE_DEV_ALIAS=PASS ' + result.sha + ' ' + result.deploymentId +
    ' https://' + result.alias);
} catch (error) {
  console.error('STABLE_DEV_ALIAS=FAIL ' +
    (error instanceof Error ? error.message : 'Unknown verification failure'));
  process.exitCode = 1;
}
