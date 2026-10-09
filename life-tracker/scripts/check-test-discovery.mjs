#!/usr/bin/env node
import { globSync } from 'node:fs';
import { TEST_PROJECTS } from './lib/test-projects.mjs';
import { evaluateTestDiscovery } from './lib/test-discovery.mjs';

const normalize = (value) => value.replaceAll('\\', '/');
const testLikeFiles = [
  ...globSync('tests/**/*.test.*'),
  ...globSync('tests/**/*.spec.*'),
].map(normalize);

const projectFiles = Object.fromEntries(
  TEST_PROJECTS.map((project) => [
    project.name,
    project.include.flatMap((pattern) => globSync(pattern).map(normalize)),
  ])
);

const { total, counts, invalid } = evaluateTestDiscovery(testLikeFiles, projectFiles);
if (invalid.length > 0) {
  for (const { file, owners } of invalid) {
    const detail = owners.length === 0
      ? 'not assigned to a Vitest project or supported Playwright spec (*.spec.mjs in tests/e2e/)'
      : `matched by ${owners.join(', ')}`;
    console.error(`${file}: ${detail}`);
  }
  process.exit(1);
}

const summary = [...TEST_PROJECTS.map((project) => project.name), 'browser']
  .map((name) => `${name}=${counts[name]}`).join(', ');
console.log(`Test discovery passed: ${total} files (${summary}).`);
