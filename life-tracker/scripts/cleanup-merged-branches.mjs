#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { assessBranch } from './lib/branch-hygiene.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const dryRun = process.env.DRY_RUN === 'true';
const maxDeletes = 100;

if (repository !== 'carlers/mosaic-life-tracker' ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    !['schedule', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) ||
    !token) {
  throw new Error('Cleanup runs only with an authenticated main-branch schedule or manual dispatch in Mosaic.');
}

const root = 'https://api.github.com/repos/' + repository;
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: 'Bearer ' + token,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'mosaic-branch-hygiene',
};

async function github(path, method = 'GET') {
  const response = await fetch(root + path, { method, headers });
  if (!response.ok) {
    const error = new Error('GitHub ' + method + ' ' + path + ': ' +
      response.status + ' ' + (await response.text()).slice(0, 500));
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function allPages(path) {
  const items = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= 100; page++) {
    const batch = await github(path + separator + 'per_page=100&page=' + page);
    if (!Array.isArray(batch)) throw new Error('Expected a paginated GitHub array: ' + path);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error('GitHub pagination exceeded safety limit: ' + path);
}

function branchPath(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}

function queryParam(value) {
  return encodeURIComponent(value);
}

async function recheck(branch, nowMs) {
  let current;
  try {
    current = await github('/branches/' + branchPath(branch.name));
  } catch (error) {
    if (error.status === 404) return { eligible: false, reason: 'already-removed' };
    throw error;
  }
  if (current.protected || current.commit?.sha !== branch.commit.sha) {
    return { eligible: false, reason: 'branch-changed-or-protected' };
  }
  // Re-query per candidate: a new PR or a newer promotion may have appeared
  // since the initial snapshot. This step is fail-closed on API errors.
  const head = await allPages('/pulls?state=all&head=' +
    queryParam(repository.split('/')[0] + ':' + branch.name));
  const openBase = await github('/pulls?state=open&base=' +
    queryParam(branch.name) + '&per_page=1');
  return assessBranch(current, [...head, ...openBase], repository, nowMs);
}

async function main() {
  const nowMs = Date.now();
  // Finish both inventories before considering any deletion.
  const [branches, prs] = await Promise.all([
    allPages('/branches'),
    allPages('/pulls?state=all'),
  ]);
  const candidates = [];
  const reasons = {};
  for (const branch of branches) {
    const decision = assessBranch(branch, prs, repository, nowMs);
    reasons[decision.reason] = (reasons[decision.reason] || 0) + 1;
    if (decision.eligible) candidates.push({ branch, decision });
  }

  const results = [];
  for (const { branch, decision } of candidates.slice(0, maxDeletes)) {
    if (dryRun) {
      results.push({ name: branch.name, status: 'would-delete', pr: decision.pr });
      continue;
    }
    const fresh = await recheck(branch, Date.now());
    if (!fresh.eligible) {
      results.push({ name: branch.name, status: 'preserved (' + fresh.reason + ')' });
      continue;
    }
    try {
      await github('/git/refs/heads/' + branchPath(branch.name), 'DELETE');
      results.push({ name: branch.name, status: 'deleted', pr: fresh.pr });
    } catch (error) {
      if (error.status === 404 || error.status === 422) {
        results.push({ name: branch.name, status: 'preserved (missing or protected)' });
        continue;
      }
      throw error;
    }
  }

  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'delete',
    inspected: branches.length,
    eligible: candidates.length,
    maxDeletes,
    reasons,
    results,
  }, null, 2));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = results.map((result) =>
      '| ' + result.name.replaceAll('|', '\\|') + ' | ' +
      result.status + ' | ' + (result.pr ? '#' + result.pr : '—') + ' |');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Mosaic branch hygiene',
      '',
      'Mode: **' + (dryRun ? 'dry run' : 'live') + '**. Inspected ' +
        branches.length + ' branches; ' + candidates.length +
        ' met the 72-hour merged-PR rule.',
      '',
      '| Branch | Result | PR |',
      '| --- | --- | --- |',
      ...rows,
      '',
      candidates.length > maxDeletes ?
        'Remaining eligible branches will be reconsidered in the next run.' : '',
    ].join('\n'));
  }
}

await main();
