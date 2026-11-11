#!/usr/bin/env node
import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';
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


const testRoots = new Set(['it', 'test', 'describe', 'suite', 'bench']);
const exclusiveAliases = new Set(['fit', 'fdescribe', 'ftest', 'fsuite']);

// Parse syntax rather than matching source text: comments, string fixtures and
// unrelated .only() APIs are not exclusive test declarations.
function exclusiveTestSelections(path) {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX
    : path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest, true, kind);
  const violations = [];

  function testRoot(node) {
    while (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) || ts.isCallExpression(node)) {
      node = node.expression;
    }
    return ts.isIdentifier(node) ? node.text : null;
  }

  function report(node, kind) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    violations.push({ path, line, kind });
  }

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'only' &&
      testRoots.has(testRoot(node.expression))) {
      report(node, '.only');
    } else if (ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === 'only' &&
      testRoots.has(testRoot(node.expression))) {
      report(node, '["only"]');
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      exclusiveAliases.has(node.expression.text)) {
      report(node, node.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}

const { total, counts, invalid } = evaluateTestDiscovery(testLikeFiles, projectFiles, nodeProjectFiles);
const exclusive = [...new Set(testLikeFiles)].flatMap(exclusiveTestSelections);
if (invalid.length > 0 || exclusive.length > 0) {
  for (const { file, owners } of invalid) {
    const detail = owners.length === 0
      ? 'not assigned to a Vitest project, Node runner or supported Playwright spec (*.spec.mjs in tests/e2e/)'
      : `matched by ${owners.join(', ')}`;
    console.error(`${file}: ${detail}`);
  }
  for (const { path, line, kind } of exclusive) {
    console.error(path + ':' + line + ': exclusive test selection (' + kind + '); use the ordinary test declaration');
  }
  process.exit(1);
}

const summary = [...TEST_PROJECTS.map((project) => project.name), 'browser', ...Object.keys(nodeProjectFiles)]
  .map((name) => `${name}=${counts[name]}`).join(', ');
console.log(`Test discovery passed: ${total} files (${summary}).`);
