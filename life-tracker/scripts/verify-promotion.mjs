#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { evaluatePromotionEvidence } from './lib/promotion-verification.mjs';

const API_ROOT = 'https://api.github.com';

function sanitizeOutput(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function writeOutputs(result) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  appendFileSync(
    output,
    [
      `eligible=${result.eligible ? 'true' : 'false'}`,
      `source_sha=${sanitizeOutput(result.sourceSha)}`,
      `source_branch=${sanitizeOutput(result.sourceBranch)}`,
      `reason=${sanitizeOutput(result.reason)}`,
      '',
    ].join('\n')
  );
}

async function githubJson(path, token) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mosaic-promotion-check',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${path}`);
  }
  return response.json();
}

async function verifyPromotion() {
  const token = process.env.GITHUB_TOKEN ?? '';
  const repository = process.env.CI_REPOSITORY ?? '';
  const headSha = process.env.CI_HEAD_SHA ?? '';
  const beforeSha = process.env.CI_BEFORE_SHA ?? '';
  const targetBranch = process.env.CI_TARGET_BRANCH ?? 'dev';

  if (!token || !repository || !headSha) {
    return {
      eligible: false,
      reason: 'promotion verifier is missing required GitHub context',
    };
  }

  try {
    const encodedHead = encodeURIComponent(headSha);
    const headCommit = await githubJson(
      `/repos/${repository}/commits/${encodedHead}`,
      token
    );
    const sourceSha = headCommit?.parents?.[1]?.sha ?? '';
    if (!sourceSha) {
      return {
        eligible: false,
        reason: 'promotion is not a two-parent merge commit',
      };
    }

    const encodedSource = encodeURIComponent(sourceSha);
    const [sourceCommit, pulls, checks] = await Promise.all([
      githubJson(`/repos/${repository}/commits/${encodedSource}`, token),
      githubJson(
        `/repos/${repository}/commits/${encodedHead}/pulls?per_page=100`,
        token
      ),
      githubJson(
        `/repos/${repository}/commits/${encodedSource}/check-runs?per_page=100`,
        token
      ),
    ]);

    return evaluatePromotionEvidence({
      targetBranch,
      headSha,
      beforeSha,
      headCommit,
      sourceCommit,
      pulls: Array.isArray(pulls) ? pulls : [],
      checkRuns: Array.isArray(checks?.check_runs) ? checks.check_runs : [],
    });
  } catch (error) {
    return {
      eligible: false,
      reason: `promotion evidence lookup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

const result = await verifyPromotion();
writeOutputs(result);
console.log(
  result.eligible
    ? `Promotion evidence accepted: ${result.sourceBranch}@${result.sourceSha}`
    : `Promotion evidence not reusable: ${result.reason}`
);
