#!/usr/bin/env node
import { assertPreviewDeployGate } from './lib/preview-deploy-gate.mjs';

const repository = process.env.GITHUB_REPOSITORY ?? '';
const branch = process.env.PREVIEW_DEPLOY_BRANCH ?? '';
const sha = process.env.PREVIEW_DEPLOY_SHA ?? '';
const token = process.env.GITHUB_TOKEN ?? '';

async function githubGet(path, label) {
  const response = await fetch('https://api.github.com' + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Never echo the provider's response body or any environment-variable value.
    throw new Error('GitHub ' + label + ' returned HTTP ' + response.status);
  }
  return response.json();
}

try {
  if (!token || repository !== 'carlers/mosaic-life-tracker') {
    throw new Error('Trusted official-repository GitHub token is required');
  }
  // No deployments, Vercel secrets, or build artefacts are accessed here.
  const ref = branch.split('/').map(encodeURIComponent).join('/');
  const [runData, checkData, refData] = await Promise.all([
    githubGet('/repos/' + repository + '/actions/runs?head_sha=' + encodeURIComponent(sha) + '&per_page=100', 'workflow runs'),
    githubGet('/repos/' + repository + '/commits/' + encodeURIComponent(sha) + '/check-runs?per_page=100', 'check runs'),
    githubGet('/repos/' + repository + '/git/ref/heads/' + ref, 'branch ref'),
  ]);
  if (runData.total_count > 100 || checkData.total_count > 100) {
    throw new Error('GitHub evidence exceeded the inspected page');
  }
  const result = assertPreviewDeployGate({
    repository,
    branch,
    sha,
    headSha: refData.object?.sha,
    workflowRuns: runData.workflow_runs,
    checkRuns: checkData.check_runs,
    currentRunId: process.env.PREVIEW_DEPLOY_ALLOW_CURRENT_RUN === 'true' ?
      Number(process.env.GITHUB_RUN_ID) : undefined,
  });
  console.log('Preview deployment eligibility passed for ' + branch + '@' + sha +
    ' (canonical run ' + result.acceptedRunId + ').');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Preview deployment gate failed');
  process.exitCode = 1;
}
