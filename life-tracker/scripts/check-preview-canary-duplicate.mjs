#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { findExistingCanary, OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID } from './lib/preview-canary-context.mjs';

try {
  const token = process.env.VERCEL_TOKEN;
  const branch = process.env.PREVIEW_DEPLOY_BRANCH;
  const sha = process.env.PREVIEW_DEPLOY_SHA;
  if (!token) throw new Error('Vercel token is unavailable');
  let until;
  let existing = null;
  let complete = false;
  // Bounded and fail-closed: a truncated window is never evidence of no duplicate.
  for (let page = 0; page < 5; page += 1) {
    const url = new URL('https://api.vercel.com/v6/deployments');
    url.searchParams.set('teamId', OFFICIAL_VERCEL_ORG_ID);
    url.searchParams.set('projectId', OFFICIAL_VERCEL_PROJECT_ID);
    url.searchParams.set('limit', '100');
    if (until != null) url.searchParams.set('until', String(until));
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Cannot inspect canary deployments: HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.deployments)) throw new Error('Missing Vercel deployment evidence');
    existing = findExistingCanary(data.deployments, branch, sha);
    if (existing) break;
    if (!data.pagination?.next) { complete = true; break; }
    if (data.pagination.next === until) throw new Error('Vercel deployment cursor did not advance');
    until = data.pagination.next;
  }
  if (!existing && !complete) throw new Error('Canary deployment history exceeded bounded inspection');
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
