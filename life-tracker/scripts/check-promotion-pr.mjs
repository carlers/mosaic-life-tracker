#!/usr/bin/env node
// Trusted-base read-only PR guard. Does not fetch Vercel secrets or mutate GitHub.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { waitForPromotionCanonicalEvidence } from './lib/promotion-pr-evidence.mjs';

const token = process.env.GITHUB_TOKEN ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const eventPath = process.env.GITHUB_EVENT_PATH ?? '';
const sha = /^[a-f0-9]{40}$/;
const api = 'https://api.github.com';
function git(...args) {
  return execFileSync('git', args, { cwd: '..', encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
async function github(path) {
  const result = await fetch(api + path, { headers: {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mosaic-promotion-pr-preflight',
  } });
  if (!result.ok) throw new Error('GitHub evidence unavailable: HTTP ' + result.status);
  return result.json();
}
function versionAt(commit) {
  const content = git('show', commit + ':life-tracker/src/lib/appVersion.ts');
  return content.match(/APP_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/)?.[1] ?? '';
}
async function main() {
  if (!token || !eventPath || repository !== 'carlers/mosaic-life-tracker') {
    throw new Error('Missing required read-only GitHub Actions context');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const pr = event.pull_request;
  if (!pr || !Number.isInteger(pr.number)) throw new Error('Missing pull request event');
  const baseBranch = pr.base?.ref ?? '';
  const headBranch = pr.head?.ref ?? '';
  const baseSha = pr.base?.sha ?? '';
  const headSha = pr.head?.sha ?? '';
  if (!sha.test(baseSha) || !sha.test(headSha) ||
      !/^(dev|main)$/.test(baseBranch) ||
      !/^[\w./-]+$/.test(headBranch) ||
      pr.base?.repo?.full_name !== repository ||
      pr.head?.repo?.full_name !== repository) {
    throw new Error('Unsupported promotion branch, repository, or SHA');
  }
  // Avoid shell interpretation of branch/ref names; all git args are literal argv.
  git('fetch', '--no-tags', '--quiet', 'origin', baseSha, headSha);
  let mergedTree = '';
  let mergeConflict = false;
  try {
    mergedTree = git('merge-tree', '--write-tree', baseSha, headSha).split('\n')[0];
  } catch { mergeConflict = true; }
  const sourceTree = git('rev-parse', headSha + '^{tree}');
  const repoPrefix = '/repos/' + repository;
  const immutable = {
    repository, baseRepository: pr.base.repo.full_name, headRepository: pr.head.repo.full_name,
    baseBranch, headBranch, baseSha, headSha, draft: pr.draft,
    prNumber: pr.number, mergedTree, sourceTree, mergeConflict,
    baseVersion: versionAt(baseSha), headVersion: versionAt(headSha),
  };
  const fetchEvidence = async () => {
    const [runs, liveBase, liveHead, livePr] = await Promise.all([
      github(repoPrefix + '/commits/' + headSha + '/check-runs?per_page=100'),
      github(repoPrefix + '/git/ref/heads/' + baseBranch),
      github(repoPrefix + '/git/ref/heads/' + headBranch),
      github(repoPrefix + '/pulls/' + pr.number),
    ]);
    return { ...immutable, livePr,
      liveBaseSha: liveBase.object?.sha, liveHeadSha: liveHead.object?.sha,
      checkRuns: runs.check_runs };
  };
  const result = await waitForPromotionCanonicalEvidence({
    evidence: await fetchEvidence(), refresh: fetchEvidence,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  });
  console.log(result.passed
    ? 'GitHub PR evidence passed; separately verify exact Vercel, feature parity, Scratch if applicable, and explicit user authorization.'
    : 'PR premerge evidence BLOCKED: ' + result.reasons.join('; '));
  process.exitCode = result.passed ? 0 : 1;
}
try { await main(); } catch (error) {
  console.error('PR premerge evidence BLOCKED: ' + (error instanceof Error ? error.message : 'unknown error'));
  process.exitCode = 1;
}
