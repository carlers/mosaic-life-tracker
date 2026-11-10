#!/usr/bin/env node
import { globSync } from 'node:fs';
import { TEST_PROJECTS } from './lib/test-projects.mjs';
import { evaluateTestDiscovery } from './lib/test-discovery.mjs';

const normalize = (value) => value.replaceAll('\\', '/');
// Detect test-like files anywhere in the checkout, including colocated and Node tests.
// Ignore dependency/output directories, never unregistered source tests.
const excluded = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**'];
const testLikeFiles = [
  ...globSync('**/*.test.*', { exclude: excluded }),
  ...globSync('**/*.spec.*', { exclude: excluded }),
].map(normalize);

const projectFiles = Object.fromEntries(
  TEST_PROJECTS.map((project) => [
    project.name,
    project.include.flatMap((pattern) => globSync(pattern).map(normalize)),
  ])
);

// Mirror the actual Node runner selections. MCP uses tests/*.test.mjs;
// the root contract command uses the two top-level script-test globs below.
// Nested test-like files stay unowned until their runner command is expanded.
const nodeProjectFiles = {
  'mcp-node': globSync('mcp-server/tests/*.test.mjs').map(normalize),
  'contracts-node': globSync('scripts/tests/*.test.mjs').map(normalize),
  'project-intake-node': globSync('scripts/project-intake/*.test.mjs').map(normalize),
};

const { total, counts, invalid } = evaluateTestDiscovery(testLikeFiles, projectFiles, nodeProjectFiles);
if (invalid.length > 0) {
  for (const { file, owners } of invalid) {
    const detail = owners.length === 0
      ? 'not assigned to a Vitest project, Node runner or supported Playwright spec (*.spec.mjs in tests/e2e/)'
      : `matched by ${owners.join(', ')}`;
    console.error(`${file}: ${detail}`);
  }
  process.exit(1);
}

const summary = [...TEST_PROJECTS.map((project) => project.name), 'browser', ...Object.keys(nodeProjectFiles)]
  .map((name) => `${name}=${counts[name]}`).join(', ');
console.log(`Test discovery passed: ${total} files (${summary}).`);
