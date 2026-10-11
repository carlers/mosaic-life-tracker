#!/usr/bin/env node
// Read-only exact-SHA promotion preflight. Never creates a PR, merge, or deployment.
// Requirements: local full Git history plus read-scoped GITHUB_TOKEN/VERCEL_TOKEN.
// Run from life-tracker/: npm run promotion:preflight -- <stable-branch> <expected-dev-sha>
import { execFileSync } from 'node:child_process';
import { evaluatePromotionPreflight } from './lib/promotion-preflight.mjs';

const REPOSITORY = 'carlers/mosaic-life-tracker';
const PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
const [sourceBranch, expectedTargetSha] = process.argv.slice(2);
const githubToken = process.env.GITHUB_TOKEN;
const vercelToken = process.env.VERCEL_TOKEN;
const versionImpact = process.env.PROMOTION_VERSION_IMPACT;
const backendDependent = process.env.PROMOTION_BACKEND_DEPENDENT;
const team = process.env.VERCEL_TEAM_ID;
if (!sourceBranch || !/^(feature|fix|perf|security|refactor)\/[\w./-]+$/.test(sourceBranch) ||
  !/^[a-f0-9]{40}$/.test(expectedTargetSha ?? '') ||
  !githubToken || !vercelToken || !['none', 'user-visible'].includes(versionImpact) ||
  !['true', 'false'].includes(backendDependent ?? '')) {
  console.error('Usage: GITHUB_TOKEN=<read-token> VERCEL_TOKEN=<read-token> PROMOTION_VERSION_IMPACT=none|user-visible PROMOTION_BACKEND_DEPENDENT=true|false npm run promotion:preflight -- <stable-preview-branch> <exact-expected-dev-SHA>');
  process.exit(2);
}
const github = 'https://api.github.com';
const vercel = 'https://api.vercel.com';
const teamQuery = team ? `&teamId=${encodeURIComponent(team)}` : '';
async function getJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Read-only provider lookup failed: HTTP ${response.status}`);
  return response.json();
}
const gh = path => getJson(github + path, githubToken);
const vc = path => getJson(vercel + path + (path.includes('?') ? teamQuery : teamQuery.replace('&', '?')), vercelToken);
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: '..' }).trim();
}
function versionAt(sha) {
  const content = git('show', `${sha}:life-tracker/src/lib/appVersion.ts`);
  return content.match(/APP_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/)?.[1] ?? '';
}
try {
  const [target, source] = await Promise.all([
    gh(`/repos/${REPOSITORY}/branches/dev`),
    gh(`/repos/${REPOSITORY}/branches/${encodeURIComponent(sourceBranch)}`),
  ]);
  const targetSha = target.commit?.sha;
  const sourceSha = source.commit?.sha;
  if (!/^[a-f0-9]{40}$/.test(targetSha ?? '') || !/^[a-f0-9]{40}$/.test(sourceSha ?? '')) {
    throw new Error('Cannot resolve exact Git refs');
  }
  // Fetch commits into the local object database without changing HEAD or remotes.
  git('fetch', '--no-tags', '--quiet', 'origin', targetSha, sourceSha);
  const sourceTree = git('rev-parse', `${sourceSha}^{tree}`);
  let mergedTree = '';
  let mergeConflict = false;
  try {
    mergedTree = git('merge-tree', '--write-tree', targetSha, sourceSha).split('\n')[0];
    if (!/^[a-f0-9]{40}$/.test(mergedTree)) mergeConflict = true;
  } catch { mergeConflict = true; }
  const [checks, vercelDeployments, env, currentTarget, currentSource] = await Promise.all([
    gh(`/repos/${REPOSITORY}/commits/${sourceSha}/check-runs?per_page=100`),
    vc(`/v6/deployments?projectId=${PROJECT}&sha=${sourceSha}&limit=100`),
    vc(`/v9/projects/${PROJECT}/env`),
    gh(`/repos/${REPOSITORY}/branches/dev`),
    gh(`/repos/${REPOSITORY}/branches/${encodeURIComponent(sourceBranch)}`),
  ]);
  const deployments = Array.isArray(vercelDeployments.deployments) ? vercelDeployments.deployments : [];
  const chosen = deployments.find(dep =>
    dep.meta?.githubCommitSha === sourceSha &&
    dep.meta?.githubCommitRef === sourceBranch &&
    dep.state === 'READY' && dep.target !== 'production');
  const rows = Array.isArray(env.envs) ? env.envs : [];
  // Remove secret values from evidence before evaluation, even in memory.
  const scopes = rows.map(row => ({ key: row.key, target: row.target, gitBranch: row.gitBranch }));
  const evaluation = evaluatePromotionPreflight({
    targetBranch: 'dev', targetSha, expectedTargetSha, latestTargetSha: currentTarget.commit?.sha,
    sourceBranch, sourceSha, latestSourceSha: currentSource.commit?.sha,
    sourceTree, mergedTree, mergeConflict,
    checkRuns: checks.check_runs,
    deployment: chosen ? { state: chosen.state, sha: chosen.meta.githubCommitSha,
      branch: chosen.meta.githubCommitRef, target: chosen.target } : null,
    sanitizedEnvScopes: scopes,
    targetVersion: versionAt(targetSha), sourceVersion: versionAt(sourceSha),
    versionImpact, backendDependent: backendDependent === 'true',
    expectedScratchDeployment: process.env.EXPECTED_SCRATCH_DEPLOYMENT_ID,
    observedScratchDeployment: process.env.OBSERVED_SCRATCH_DEPLOYMENT_ID,
  });
  console.log(`Promotion preflight: ${evaluation.outcome}`);
  console.log(`dev=${targetSha} source=${sourceSha}`);
  for (const reason of evaluation.reasons) console.log(`- ${reason}`);
  if (evaluation.outcome === 'safe-to-request-approval') {
    console.log('This is not authorization to merge. Recheck dev HEAD, Vercel readiness and backend provenance immediately before the approved PR merge.');
  }
  process.exitCode = evaluation.outcome === 'safe-to-request-approval' ? 0 : 1;
} catch (error) {
  console.error('Promotion preflight blocked: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
}
