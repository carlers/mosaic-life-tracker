#!/usr/bin/env node
// Main-owned reconciliation of active accepted stable Previews whose delivery
// preceded the history publisher or whose workflow_run listener was missed.
// Only the per-SHA publisher may write; it independently validates canonical
// acceptance, live branch, ready official Vercel deployment, and Main code.
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { parseHistoryManifest } from './lib/development-history-publisher.mjs';
import { selectPendingPreviewCandidates } from './lib/preview-history-recovery.mjs';

const REPO = 'carlers/mosaic-life-tracker';
const TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
const PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
const token = process.env.GITHUB_TOKEN;
const vercelToken = process.env.VERCEL_TOKEN;
const mainWorkflowRun = process.env.GITHUB_EVENT_NAME === 'workflow_run' &&
  process.env.GITHUB_REF === 'refs/heads/main'
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).workflow_run
  : null;
const acceptedMainQualityGate = mainWorkflowRun?.name === 'Quality Gate' &&
  mainWorkflowRun?.head_repository?.full_name === REPO &&
  mainWorkflowRun?.head_branch === 'main' &&
  mainWorkflowRun?.head_sha === process.env.GITHUB_SHA &&
  mainWorkflowRun?.event === 'push' &&
  mainWorkflowRun?.conclusion === 'success';
if (process.env.GITHUB_REPOSITORY !== REPO ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    !(['workflow_dispatch', 'schedule'].includes(process.env.GITHUB_EVENT_NAME) || acceptedMainQualityGate) ||
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
const omitted = [];
let published = 0;
for (const candidate of pending) {
  const child = spawnSync(process.execPath, ['scripts/publish-development-history.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 45000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      HISTORY_STAGE: 'preview',
      HISTORY_BRANCH: candidate.branch,
      HISTORY_SHA: candidate.sha,
      HISTORY_RECONCILE_PREVIEW: 'true',
      HISTORY_DEPLOYMENT_ID: candidate.deploymentId,
    },
  });
  if (child.status !== 0) {
    // A provider authentication, metadata-write or trusted Main-context error
    // is operational, not an unverifiable individual candidate: fail visibly.
    const details = String(child.stderr || child.error?.message || '');
    if (/HTTP (?:401|403|429|5\\d\\d)\\b/.test(details) ||
        /History provider (?:POST|PATCH)|History write readback mismatch|not from current trusted main|Untrusted history publisher context/.test(details)) {
      throw new Error('Preview history provider or trusted-context failure for ' +
        candidate.branch + ': ' + details.slice(0, 350));
    }
    // A legacy READY deployment may lack the current exact accepted provenance.
    // Never record it, but never block independent, verifiable active Previews.
    const reason = String(child.error?.code ?? child.status ?? 'no-exit')
      .replace(/[^a-zA-Z0-9_-]/g, '').slice(0,32);
    omitted.push({ branch: candidate.branch, sha: candidate.sha, reason });
    console.warn('Omitted unverified Preview ' + candidate.branch +
      ' @ ' + candidate.sha.slice(0,8) + ' (' + reason + ')');
    continue;
  }
  published++;
  console.log('Recovered Preview ' + candidate.branch + ' @ ' + candidate.sha.slice(0,8));
}
console.log('Preview history recovery result: published=' + published +
  ' omitted=' + omitted.length + ' candidates=' + pending.length);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## Active Preview history reconciliation', '',
    'Verified records processed: **' + published + '**',
    'Omitted without publication: **' + omitted.length + '**', '',
    '| Branch | SHA | Result |',
    '| --- | --- | --- |',
    ...omitted.map(item =>
      '| ' + item.branch.replaceAll('|', '') +
      ' | ' + item.sha.slice(0,12) + ' | Not verified (' + item.reason + ') |'),
    '',
    'Omitted deployments are not release records. Scheduled retries retain the full verification gate.',
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
}
