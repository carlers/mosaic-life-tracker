// Regression: TEST_WORKFLOW.md (every test-like file must have one runner).
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateTestDiscovery } from '../../scripts/lib/test-discovery.mjs';

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

  it('rejects unsupported filenames and misplaced test files', () => {
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

  it('rejects files claimed by more than one runner', () => {
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

  it('exits nonzero when a test is silently skipped by every runner', () => {
    const root = mkdtempSync(join(tmpdir(), 'mosaic-discovery-'));
    try {
      mkdirSync(join(root, 'tests/unit'), { recursive: true });
      writeFileSync(join(root, 'tests/unit/silently-skipped.spec.ts'), '// regression fixture\n');

      const script = fileURLToPath(new URL('../../scripts/check-test-discovery.mjs', import.meta.url));
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('tests/unit/silently-skipped.spec.ts');
      expect(result.stderr).toContain('not assigned to a Vitest project');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
