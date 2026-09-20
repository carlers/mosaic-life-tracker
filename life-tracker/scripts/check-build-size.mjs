import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateBuildSizeBudget,
  formatBuildSizeResult,
  measureProductionBuild,
  validateBuildSizeBudget,
} from './lib/build-size-guard.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist');
const budgetPath = join(root, 'config', 'build-size-budget.json');

const budget = validateBuildSizeBudget(JSON.parse(await readFile(budgetPath, 'utf8')));
const result = evaluateBuildSizeBudget(budget, await measureProductionBuild(directory));
console.log(formatBuildSizeResult(result));
if (!result.passed) process.exitCode = 1;
