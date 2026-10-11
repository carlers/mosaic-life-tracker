#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAcceptedMainBudgetInheritance, assertReviewedBudgetChange } from './lib/build-budget-review.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(root, '..');
const relativePath = 'life-tracker/config/build-size-budget.json';
const ref = process.argv[2];
const git = (...args) => execFileSync('git', args, {
  cwd: repoRoot, encoding: 'utf8', timeout: 10000,
}).trim();
const gitBudget = reference => JSON.parse(git('show', `${reference}:${relativePath}`));

async function acceptedSourceBudget() {
  if (process.env.GITHUB_REF !== 'refs/heads/main') return null;
  const [head, ...parents] = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
  if (parents.length !== 2 || head !== git('rev-parse', 'HEAD')) return null;
  const [source] = parents.slice(1);
  const exactSourceTree = git('rev-parse', 'HEAD^{tree}') ===
    git('rev-parse', `${source}^{tree}`);
  if (!exactSourceTree) return null;

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || repository !== 'carlers/mosaic-life-tracker') {
    throw new Error('Cannot validate inherited main budgets without a trusted repository token');
  }
  const response = await fetch(
    `https://api.github.com/repos/${repository}/commits/${source}/check-runs?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!response.ok) throw new Error('Cannot verify source canonical acceptance: HTTP ' + response.status);
  const checks = await response.json();
  const sourceAccepted = checks.check_runs?.some(check =>
    check.name === 'canonical-acceptance' &&
    check.conclusion === 'success' &&
    check.head_sha === source &&
    check.app?.slug === 'github-actions'
  ) === true;
  return { source, sourceAccepted, exactSourceTree, sourceBudget: gitBudget(source) };
}

if (!ref || ref.startsWith('-')) {
  console.error('Usage: node scripts/check-build-budget-review.mjs <base-sha-or-HEAD^>');
  process.exitCode = 2;
} else {
  try {
    const previous = gitBudget(ref);
    const candidate = JSON.parse(await readFile(resolve(root, 'config/build-size-budget.json'), 'utf8'));
    try {
      const { changed } = assertReviewedBudgetChange(previous, candidate);
      console.log(changed.length ? `Budget review contract passed: ${changed.join(', ')}` : 'Budget ceilings unchanged.');
    } catch (originalError) {
      // Main's first parent may be a much older published product. Inherit
      // only a fully accepted identical dev merge tree, never an arbitrary
      // raised ceiling or a changed merge-resolution budget.
      const source = await acceptedSourceBudget();
      if (!source) throw originalError;
      assertAcceptedMainBudgetInheritance({
        sourceAccepted: source.sourceAccepted,
        exactSourceTree: source.exactSourceTree,
        sourceBudget: source.sourceBudget,
        candidate,
      });
      console.log('Accepted main budget inheritance from unchanged canonical source ' + source.source);
    }
  } catch (error) {
    console.error('Build-size budget change rejected: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
