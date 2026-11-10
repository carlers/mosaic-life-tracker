// Regression: TEST_WORKFLOW.md (every test-like file must have one runner).
import { globSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

  it('accounts for colocated source tests and independently run Node suites', () => {
    const files = [
      'src/lib/timelinePlanner.test.ts',
      'mcp-server/tests/security.test.mjs',
      'scripts/tests/stable-dev-deployment.test.mjs',
      'scripts/project-intake/route-issue.test.mjs',
    ];
    const result = evaluateTestDiscovery(files, {
      ...matches,
      unit: [...matches.unit, files[0]],
    }, {
      'mcp-node': [files[1]],
      'contracts-node': [files[2]],
      'project-intake-node': [files[3]],
    });
    expect(result.invalid).toEqual([]);
    expect(result.counts).toEqual({
      unit: 1, handlers: 0, dom: 0,
      'mcp-node': 1, 'contracts-node': 1, 'project-intake-node': 1, browser: 0,
    });
  });

  it('rejects unregistered colocated source and Node tests', () => {
    const result = evaluateTestDiscovery([
      'src/components/unowned.test.ts',
      'scripts/other/unowned.test.mjs',
      'mcp-server/server/unowned.spec.mjs',
    ], matches, { 'mcp-node': [] });
    expect(result.invalid.map(({ file }) => file)).toEqual([
      'mcp-server/server/unowned.spec.mjs',
      'scripts/other/unowned.test.mjs',
      'src/components/unowned.test.ts',
    ]);
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

  it('matches Node ownership to actual runner globs and rejects nested tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'mosaic-discovery-node-'));
    try {
      const write = (path: string) => {
        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, '// regression fixture\\n');
      };
      write('mcp-server/tests/covered.test.mjs');
      write('mcp-server/tests/nested/unowned.test.mjs');
      write('scripts/tests/covered.test.mjs');
      write('scripts/tests/nested/unowned.test.mjs');
      write('scripts/project-intake/covered.test.mjs');
      write('scripts/project-intake/nested/unowned.test.mjs');

      const script = fileURLToPath(new URL('../../scripts/check-test-discovery.mjs', import.meta.url));
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      for (const path of [
        'mcp-server/tests/nested/unowned.test.mjs',
        'scripts/tests/nested/unowned.test.mjs',
        'scripts/project-intake/nested/unowned.test.mjs',
      ]) {
        expect(result.stderr).toContain(path);
      }
      for (const path of [
        'mcp-server/tests/covered.test.mjs',
        'scripts/tests/covered.test.mjs',
        'scripts/project-intake/covered.test.mjs',
      ]) {
        expect(result.stderr).not.toContain(path);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps Node discovery globs aligned with executed package commands', () => {
    const appPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const mcpPackage = JSON.parse(readFileSync(new URL('../../mcp-server/package.json', import.meta.url), 'utf8'));
    const discovery = readFileSync(new URL('../../scripts/check-test-discovery.mjs', import.meta.url), 'utf8');

    expect(mcpPackage.scripts.test).toContain('node --test tests/*.test.mjs');
    expect(appPackage.scripts['contracts:check']).toContain(
      'node --test scripts/tests/*.test.mjs scripts/project-intake/*.test.mjs'
    );
    const browserCorrectness = appPackage.scripts['test:browser-contract'];
    expect(browserCorrectness).toContain('playwright test tests/e2e');
    expect(browserCorrectness).toContain('--grep-invert @performance');

    const performanceSpecs = globSync('tests/e2e/**/*.spec.mjs')
      .filter(file => readFileSync(file, 'utf8').includes('@performance'));
    const performanceCommands = Object.entries(appPackage.scripts)
      .filter(([name]) => name.startsWith('test:performance'));

    expect(performanceSpecs.length).toBeGreaterThan(0);
    for (const file of performanceSpecs) {
      expect(performanceCommands.some(([, command]) => command.includes(file))).toBe(true);
    }
    for (const [, command] of performanceCommands) {
      expect(command).toContain('--grep @performance');
      expect(performanceSpecs.some(file => command.includes(file))).toBe(true);
    }
    expect(discovery).toContain("globSync('mcp-server/tests/*.test.mjs')");
    expect(discovery).toContain("globSync('scripts/tests/*.test.mjs')");
    expect(discovery).toContain("globSync('scripts/project-intake/*.test.mjs')");
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
