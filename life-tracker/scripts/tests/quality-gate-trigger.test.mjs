import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const qualityGate = readFileSync(
  new URL('../../../.github/workflows/quality-gate.yml', import.meta.url),
  'utf8'
);

test('the canonical Quality Gate triggers on changes to other workflow definitions', () => {
  const pushPaths = qualityGate.match(/^    paths:\s*\n((?:      - [^\n]+\n)+)/m)?.[1];
  assert.ok(pushPaths, 'the push event must declare its path filters');

  const patterns = pushPaths
    .split('\n')
    .filter(Boolean)
    .map((line) => line.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, ''));

  assert.ok(
    patterns.includes('.github/workflows/**'),
    'changes to release, deployment, and other workflows must trigger canonical CI'
  );
});
