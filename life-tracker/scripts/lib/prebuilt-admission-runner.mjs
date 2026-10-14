#!/usr/bin/env node
// Default-main only; trusted scripts, Node built-ins, read-only GitHub APIs.
// Candidate-controlled output is data, never imported, executed or logged.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assessPrebuiltReceiverEvent, selectPrebuiltArtifact } from './prebuilt-receiver-gate.mjs';
import { verifyPrebuiltCandidateBytes } from './prebuilt-candidate-payload.mjs';

const REPO = 'carlers/mosaic-life-tracker';
const MAX_ARCHIVE = 16 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/i;
const endpoint = 'https://api.github.com/repos/' + REPO;
const token = process.env.GITHUB_TOKEN ?? '';

async function githubJson(path) {
  const response = await fetch(endpoint + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('GitHub trusted read failed: HTTP ' + response.status);
  return response.json();
}

async function accepted(event) {
  const workflow = event?.workflow_run;
  if (!SHA.test(workflow?.head_sha ?? '') || !Number.isSafeInteger(workflow?.id))
    throw new Error('Missing trusted triggering workflow identity');
  const branch = workflow.head_branch;
  const source = workflow.head_sha;
  const encoded = branch.split('/').map(encodeURIComponent).join('/');
  const [runs, checks, branchRef, mainRef] = await Promise.all([
    githubJson('/actions/runs?head_sha=' + source + '&per_page=100'),
    githubJson('/commits/' + source + '/check-runs?per_page=100'),
    githubJson('/git/ref/heads/' + encoded),
    githubJson('/git/ref/heads/main'),
  ]);
  if (!Array.isArray(runs.workflow_runs) || runs.total_count > 100 ||
      !Array.isArray(checks.check_runs) || checks.total_count > 100)
    throw new Error('Incomplete or paginated canonical Quality Gate evidence');
  const checkout = execFileSync('git', ['rev-parse', 'HEAD'], {
    timeout: 10000, encoding: 'utf8',
  }).trim();
  const verdict = assessPrebuiltReceiverEvent({
    event, repository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF,
    checkoutSha: checkout, mainHead: mainRef.object?.sha,
    enabled: process.env.MOSAIC_TRUSTED_PREVIEW_ENABLED,
    workflowRuns: runs.workflow_runs, checkRuns: checks.check_runs,
    branchHead: branchRef.object?.sha,
  });
  if (!verdict.eligible) throw new Error('Trusted prebuilt receiver rejected CI: ' +
    verdict.reasons.join('; '));
  return verdict;
}

async function boundedArtifact(id) {
  const url = endpoint + '/actions/artifacts/' + id + '/zip';
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || !response.body)
    throw new Error('Cannot download accepted Actions artifact: HTTP ' + response.status);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_ARCHIVE)
    throw new Error('Accepted Actions artifact exceeds maximum compressed size');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ARCHIVE) throw new Error('Oversized Actions artifact download');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks, size);
}

export async function admitVerifiedArtifact() {
  if (!token) throw new Error('Read-only GitHub workflow token unavailable');

  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const acceptedRun = await accepted(event);
  const artifacts = await githubJson('/actions/runs/' + acceptedRun.runId +
    '/artifacts?per_page=100');
  if (!Array.isArray(artifacts.artifacts) || artifacts.total_count > 100)
    throw new Error('Incomplete or paginated Actions artifact list');
  const metadata = selectPrebuiltArtifact(artifacts.artifacts, acceptedRun);
  const zip = await boundedArtifact(metadata.id);
  if ('sha256:' + createHash('sha256').update(zip).digest('hex') !== metadata.digest)
    throw new Error('Downloaded ZIP differed from GitHub artifact digest');
  const verified = verifyPrebuiltCandidateBytes(zip, {
    sha: acceptedRun.sha, branch: acceptedRun.branch, digest: metadata.digest,
  });
  await accepted(event); // Fresh latest HEAD, main checkout and canonical status.
  return { event, acceptedRun, verified };
}
