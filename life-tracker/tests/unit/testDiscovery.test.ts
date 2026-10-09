// Regression: TEST_WORKFLOW.md (all intended tests must belong to exactly one runner).
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateTestDiscovery } from '../../scripts/lib/test-discovery.mjs';

const fixtures: string[] = [];
afterEach(() => {
  for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true });
});

const matches = {
  unit: ['tests/unit/accepted.test.ts'],
  handlers: ['tests/handlers/accepted.test.ts'],
  dom: ['tests/react/accepted.test.tsx'],
};

describe('test discovery guard', () => {
  it('accepts each configured Vitest project and Playwright specs once', () => {
    const result = evaluateTestDiscovery([
      'tests/unit/accepted.test.ts',
      'tests/handlers/accepted.test.ts',
      'tests/react/accepted.test.tsx',
      'tests/e2e/interaction.spec.mjs',
      'tests/e2e/performance-probe.spec.mjs',
    ], matches);
    expect(result.invalid).toEqual([]);
    expect(result.counts).toEqual({ unit: 1, handlers: 1, dom: 1, browser: 2 });
  });

  it('reports unsupported naming, wrong suite placement and missing project assignment', () => {
    const result = evaluateTestDiscovery([
      'tests/unit/silent.spec.ts',
      'tests/components/silent.test.js',
      'tests/e2e/missed.test.mjs',
      'tests/e2e/missed.spec.ts',
      'tests/integration/missed.test.ts',
      'tests/unit/accepted.test.ts',
    ], matches);
    expect(result.invalid.map(({ file }) => file)).toEqual([
      'tests/components/silent.test.js',
      'tests/e2e/missed.spec.ts',
      'tests/e2e/missed.test.mjs',
      'tests/integration/missed.test.ts',
      'tests/unit/silent.spec.ts',
    ]);
    expect(result.counts.unit).toBe(1);
  });

  it('rejects a file claimed by two runners, not just missing files', () => {
    const result = evaluateTestDiscovery(['tests/unit/accepted.test.ts'], {
      unit: ['tests/unit/accepted.test.ts'],
      handlers: ['tests/unit/accepted.test.ts'],
      dom: [],
    });
    expect(result.invalid).toEqual([{
      file: 'tests/unit/accepted.test.ts',
      owners: ['unit', 'handlers'],
    }]);
  });

  it('fails the actual guard process for a test file the runner would ignore', () => {
    const root = mkdtempSync(join(tmpdir(), 'mosaic-discovery-'));
    fixtures.push(root);
    mkdirSync(join(root, 'tests/unit'), { recursive: true });
    mkdirSync(join(root, 'tests/e2e'), { recursive: true });
    writeFileSync(join(root, 'tests/unit/silently-skipped.spec.ts'), '// should fail discovery\n');
    writeFileSync(join(root, 'tests/e2e/accepted.spec.mjs'), '// Playwright fixture\n');

    const path = fileURLToPath(new URL('../../scripts/check-test-discovery.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [path], { cwd: root, encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tests/unit/silently-skipped.spec.ts');
    expect(result.stderr).toContain('not assigned to a Vitest project');
  });

  it('passes the guard process for valid Vitest and browser test filenames', () => {
    const root = mkdtempSync(join(tmpdir(), 'mosaic-discovery-'));
    fixtures.push(root);
    mkdirSync(join(root, 'tests/unit'), { recursive: true });
    mkdirSync(join(root, 'tests/e2e'), { recursive: true });
    writeFileSync(join(root, 'tests/unit/accepted.test.ts'), '// unit fixture\n');
    writeFileSync(join(root, 'tests/e2e/accepted.spec.mjs'), '// browser fixture\n');

    const path = fileURLToPath(new URL('../../scripts/check-test-discovery.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [path], { cwd: root, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('unit=1, handlers=0, dom=0, browser=1');
  });
});
