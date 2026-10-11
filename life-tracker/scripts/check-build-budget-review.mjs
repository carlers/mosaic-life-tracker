#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReviewedBudgetChange } from './lib/build-budget-review.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const relativePath = 'life-tracker/config/build-size-budget.json';
const ref = process.argv[2];
if (!ref || ref.startsWith('-')) {
  console.error('Usage: node scripts/check-build-budget-review.mjs <base-sha-or-HEAD^>');
  process.exitCode = 2;
} else {
  try {
    const previous = JSON.parse(execFileSync('git', ['show', `${ref}:${relativePath}`], {
      cwd: resolve(root, '..'), encoding: 'utf8', timeout: 10000,
    }));
    const candidate = JSON.parse(await readFile(resolve(root, 'config/build-size-budget.json'), 'utf8'));
    const { changed } = assertReviewedBudgetChange(previous, candidate);
    console.log(changed.length ? `Budget review contract passed: ${changed.join(', ')}` : 'Budget ceilings unchanged.');
  } catch (error) {
    console.error('Build-size budget change rejected: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
