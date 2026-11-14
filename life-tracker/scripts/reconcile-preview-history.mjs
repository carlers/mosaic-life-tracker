#!/usr/bin/env node
// Main-owned reconciliation of active accepted stable Previews whose delivery
// preceded the history publisher or whose workflow_run listener was missed.
// Only the per-SHA publisher may write; it independently validates canonical
// acceptance, live branch, ready official Vercel deployment, and Main code.
import { spawnSync } from 'node:child_process';
import { parseHistoryManifest } from './lib/development-history-publisher.mjs';
import { selectPendingPreviewCandidates } from './lib/preview-history-recovery.mjs';

const REPO = 'carlers/mosaic-life-tracker';
const TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
const PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
const token = process.env.GITHUB_TOKEN;
const vercelToken = process.env.VERCEL_TOKEN;
if (process.env.GITHUB_REPOSITORY !== REPO ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    !['workflow_dispatch', 'schedule'].includes(process.env.GITHUB_EVENT_NAME) ||
    !token || !vercelToken) throw new Error('Untrusted Preview recovery invocation');

async function request(url, auth, allow404 = false) {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + auth, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error('Preview recovery provider HTTP ' + response.status);
  return response.json();
}
const gh = (path, allow404 = false) =>
  request('https://api.github.com/repos/' + REPO + path, token, allow404);
const ve = (path) => request('https://api.vercel.com' + path, vercelToken);

async function currentBranches() {
  const result = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh('/branches?per_page=100&page=' + page);
    if (!Array.isArray(batch)) throw new Error('Invalid GitHub branch inventory');
    result.push(...batch);
    if (batch.length < 100) return result;
  }
  throw new Error('Preview branch inventory truncated');
}

async function recentDeployments() {
  const result = [];
  // A bounded recency window avoids unbounded provider reads. A verified
  // older inactive Preview remains omitted, never fabricated.
  const since = Date.now() - 180 * 86400000;
  let until = null;
  for (let page = 0; page < 40; page++) {
    const query = new URLSearchParams({
      teamId: TEAM, projectId: PROJECT, limit: '100', since: String(since),
    });
    if (until != null) query.set('until', String(until));
    const response = await ve('/v6/deployments?' + query);
    if (!Array.isArray(response.deployments) || !response.pagination)
      throw new Error('Invalid Vercel inventory');
    result.push(...response.deployments);
    if (response.pagination.next == null) return result;
    const next = response.pagination.next;
    if (!Number.isSafeInteger(next) || next <= 0 ||
        (until != null && next >= until)) throw new Error('Invalid Vercel pagination');
    until = next;
  }
  throw new Error('Preview deployment inventory truncated');
}
async function recordedEvents() {
  const response = await gh('/contents/history.json?ref=mosaic-release-history', true);
  if (!response) return [];
  if (response.encoding !== 'base64' || typeof response.content !== 'string' ||
      response.size > 2000000) throw new Error('Invalid existing history manifest');
  const parsed = JSON.parse(Buffer.from(response.content, 'base64').toString('utf8'));
  return parseHistoryManifest(parsed).events;
}

const [branches, deployments, events] = await Promise.all([
  currentBranches(), recentDeployments(), recordedEvents(),
]);
const pending = selectPendingPreviewCandidates(branches, deployments, events);
console.log('Eligible active Preview recovery candidates: ' + pending.length);
for (const candidate of pending) {
  const child = spawnSync(process.execPath, ['scripts/publish-development-history.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      HISTORY_STAGE: 'preview',
      HISTORY_BRANCH: candidate.branch,
      HISTORY_SHA: candidate.sha,
      HISTORY_RECONCILE_PREVIEW: 'true',
    },
  });
  if (child.status !== 0) {
    throw new Error('Verified Preview recovery blocked for ' + candidate.branch +
      ' @ ' + candidate.sha + ': ' + (child.stderr || child.error?.message || '').slice(0,500));
  }
  console.log('Recovered Preview ' + candidate.branch + ' @ ' + candidate.sha.slice(0,8));
}
