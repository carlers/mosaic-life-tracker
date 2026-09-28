import {
  evaluateBuildSizeBudget,
  formatBuildSizeResult,
  validateBuildSizeBudget,
} from '../../scripts/lib/build-size-guard.mjs';
import { readFile } from 'node:fs/promises';

const budget = {
  schemaVersion: 1,
  baseline: {
    measuredAt: '2026-09-20',
    commit: 'example',
    metrics: {
      entryRawBytes: 100,
      entryGzipBytes: 50,
      appAssetsRawBytes: 200,
      appAssetsGzipBytes: 90,
      precacheUniqueBytes: 240,
    },
  },
  limits: {
    entryRawBytes: 110,
    entryGzipBytes: 55,
    appAssetsRawBytes: 220,
    appAssetsGzipBytes: 99,
    precacheUniqueBytes: 264,
  },
};

describe('build-size guard', () => {
  // Regression: PLAN.md — Phase 3.6 Build-size guard
  it('reports every metric at or below its limit', () => {
    const result = evaluateBuildSizeBudget(budget, {
      entryRawBytes: 110,
      entryGzipBytes: 54,
      appAssetsRawBytes: 219,
      appAssetsGzipBytes: 99,
      precacheUniqueBytes: 250,
    });

    expect(result.passed).toBe(true);
    expect(result.metrics).toHaveLength(5);
    expect(result.metrics.every((metric) => metric.passed)).toBe(true);
    expect(formatBuildSizeResult(result)).toContain('Build-size budget passed');
  });

  // Regression: PLAN.md — Phase 3.6 Build-size guard
  it('identifies each exceeded metric and its byte overage', () => {
    const result = evaluateBuildSizeBudget(budget, {
      entryRawBytes: 111,
      entryGzipBytes: 56,
      appAssetsRawBytes: 221,
      appAssetsGzipBytes: 100,
      precacheUniqueBytes: 265,
    });

    expect(result.passed).toBe(false);
    expect(result.metrics.map(({ overByBytes }) => overByBytes)).toEqual([1, 1, 1, 1, 1]);
    expect(formatBuildSizeResult(result)).toContain('Build-size budget failed');
  });

  // Regression: PLAN.md — Phase 3.6 Build-size guard
  it('rejects malformed or incomplete budget files', () => {
    expect(() => validateBuildSizeBudget(budget)).not.toThrow();
    expect(() => validateBuildSizeBudget({ ...budget, schemaVersion: 2 })).toThrow(/schemaVersion/);
    expect(() => validateBuildSizeBudget({
      ...budget,
      limits: { ...budget.limits, entryRawBytes: 0 },
    })).toThrow(/entryRawBytes/);
    expect(() => validateBuildSizeBudget({
      ...budget,
      baseline: { ...budget.baseline, metrics: { ...budget.baseline.metrics, entryGzipBytes: -1 } },
    })).toThrow(/entryGzipBytes/);
  });

  // Regression: §24.14 (reviewed aggregate bundle headroom).
  it('keeps configured aggregate limits near five percent above the reviewed baseline', async () => {
    const configuredBudget = JSON.parse(await readFile(
      new URL('../../config/build-size-budget.json', import.meta.url),
      'utf8',
    ));

    expect(configuredBudget.baseline).toMatchObject({
      measuredAt: '2026-09-28',
      commit: 'dff7f45',
    });

    for (const metric of [
      'appAssetsRawBytes',
      'appAssetsGzipBytes',
      'precacheUniqueBytes',
    ]) {
      const baselineBytes = configuredBudget.baseline.metrics[metric];
      const limitBytes = configuredBudget.limits[metric];
      const ratio = limitBytes / baselineBytes;
      expect(ratio).toBeGreaterThanOrEqual(1.049);
      expect(ratio).toBeLessThanOrEqual(1.051);
    }
  });

  // Regression: PLAN.md — Phase 3.6 Build-size guard
  it('keeps the reviewed budget in the production build command', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
    const configuredBudget = JSON.parse(await readFile(
      new URL('../../config/build-size-budget.json', import.meta.url),
      'utf8',
    ));

    expect(() => validateBuildSizeBudget(configuredBudget)).not.toThrow();
    expect(packageJson.scripts.build).toContain('node scripts/check-build-size.mjs');
    expect(packageJson.scripts['build:size']).toBe('node scripts/check-build-size.mjs');
  });
});
