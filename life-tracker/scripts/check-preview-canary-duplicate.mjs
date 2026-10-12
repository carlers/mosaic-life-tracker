#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canaryHistoryStart, findExistingCanary, OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID } from './lib/preview-canary-context.mjs';

try {
  const token = process.env.VERCEL_TOKEN;
  const branch = process.env.PREVIEW_DEPLOY_BRANCH;
  const sha = process.env.PREVIEW_DEPLOY_SHA;
  if (!token) throw new Error('Vercel token is unavailable');
  const git = (...args) => execFileSync('git', args, {
    encoding: 'utf8', timeout: 10000,
  }).trim();
  if (git('rev-parse', 'HEAD') !== sha) {
    throw new Error('Canary candidate is not the checked-out exact SHA');
  }
  // Verify branch/SHA input even if Vercel returns an empty history.
  findExistingCanary([], branch, sha);
  const since = canaryHistoryStart(git('show', '-s', '--format=%ct', 'HEAD'), Date.now());
  let until;
  let existing = null;
  let complete = false;
  // Bounded and fail-closed: a truncated window is never evidence of no duplicate.
  for (let page = 0; page < 5; page += 1) {
    const url = new URL('https://api.vercel.com/v6/deployments');
    url.searchParams.set('teamId', OFFICIAL_VERCEL_ORG_ID);
    url.searchParams.set('projectId', OFFICIAL_VERCEL_PROJECT_ID);
    url.searchParams.set('limit', '100');
    url.searchParams.set('since', String(since));
    if (until != null) url.searchParams.set('until', String(until));
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Cannot inspect canary deployments: HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.deployments) || !data.pagination ||
        typeof data.pagination !== 'object') {
      throw new Error('Missing Vercel deployment or pagination evidence');
    }
    existing = findExistingCanary(data.deployments, branch, sha);
    if (existing) break;
    const next = data.pagination.next;
    if (next == null) { complete = true; break; }
    if (!Number.isSafeInteger(Number(next)) || Number(next) <= 0 ||
        (until != null && Number(next) >= until)) {
      throw new Error('Vercel deployment cursor is invalid or did not advance');
    }
    until = Number(next);
  }
  if (!existing && !complete) throw new Error('Canary deployment history exceeded bounded candidate-time inspection');
  if (existing) {
    console.log('Existing active or READY exact branch/SHA canary: no additional deployment.');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
  } else {
    console.log('No active canary was found in the inspected deployment history.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Canary duplicate check unavailable');
  process.exitCode = 1;
}
