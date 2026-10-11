import {
  evaluateBuildSizeBudget,
  formatBuildSizeResult,
  measureManifestStaticClosure,
  measureBuildInfoPayloadBytes,
  validateBuildSizeBudget,
} from '../../scripts/lib/build-size-guard.mjs';
import { readFile } from 'node:fs/promises';

const budget = {
  schemaVersion: 2,
  baseline: {
    measuredAt: '2026-09-20',
    commit: 'example',
    metrics: {
      entryRawBytes: 100,
      entryGzipBytes: 50,
      initialClosureGzipBytes: 70,
      homeClosureGzipBytes: 85,
      appAssetsRawBytes: 200,
      appAssetsGzipBytes: 90,
      precacheUniqueBytes: 240,
    },
  },
  limits: {
    entryRawBytes: 110,
    entryGzipBytes: 55,
    initialClosureGzipBytes: 77,
    homeClosureGzipBytes: 94,
    appAssetsRawBytes: 220,
    appAssetsGzipBytes: 99,
    precacheUniqueBytes: 264,
  },
};

describe('build-size guard', () => {
  // Regression: §24.14 (production size ceilings include startup/Home closures).
  it('reports every metric at or below its limit', () => {
    const result = evaluateBuildSizeBudget(budget, {
      entryRawBytes: 110,
      entryGzipBytes: 54,
      initialClosureGzipBytes: 76,
      homeClosureGzipBytes: 94,
      appAssetsRawBytes: 219,
      appAssetsGzipBytes: 99,
      precacheUniqueBytes: 250,
    });

    expect(result.passed).toBe(true);
    expect(result.metrics).toHaveLength(7);
    expect(result.metrics.every((metric) => metric.passed)).toBe(true);
    expect(formatBuildSizeResult(result)).toContain('Build-size budget passed');
  });

  // Regression: §24.14 (every guarded metric reports exact overage).
  it('identifies each exceeded metric and its byte overage', () => {
    const result = evaluateBuildSizeBudget(budget, {
      entryRawBytes: 111,
      entryGzipBytes: 56,
      initialClosureGzipBytes: 78,
      homeClosureGzipBytes: 95,
      appAssetsRawBytes: 221,
      appAssetsGzipBytes: 100,
      precacheUniqueBytes: 265,
    });

    expect(result.passed).toBe(false);
    expect(result.metrics.map(({ overByBytes }) => overByBytes)).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(formatBuildSizeResult(result)).toContain('Build-size budget failed');
  });

  it('rejects malformed or incomplete budget files', () => {
    expect(() => validateBuildSizeBudget(budget)).not.toThrow();
    expect(() => validateBuildSizeBudget({ ...budget, schemaVersion: 1 })).toThrow(/schemaVersion/);
    expect(() => validateBuildSizeBudget({
      ...budget,
      limits: { ...budget.limits, initialClosureGzipBytes: 0 },
    })).toThrow(/initialClosureGzipBytes/);
    expect(() => validateBuildSizeBudget({
      ...budget,
      baseline: {
        ...budget.baseline,
        metrics: { ...budget.baseline.metrics, homeClosureGzipBytes: -1 },
      },
    })).toThrow(/homeClosureGzipBytes/);
  });

  // Regression: §24.14 (static closure follows only static imports and deduplicates shared assets).
  it('measures a manifest static closure without following dynamic imports', () => {
    const manifest = {
      'src/main.tsx': {
        file: 'assets/entry.js',
        isEntry: true,
        imports: ['_shared.js'],
        dynamicImports: ['src/pages/HomePage.tsx'],
        css: ['assets/app.css'],
      },
      '_shared.js': {
        file: 'assets/shared.js',
      },
      'src/pages/HomePage.tsx': {
        file: 'assets/home.js',
        isDynamicEntry: true,
        imports: ['_shared.js'],
        css: ['assets/home.css'],
      },
    };
    const sizes = new Map([
      ['assets/entry.js', { rawBytes: 100, gzipBytes: 40 }],
      ['assets/shared.js', { rawBytes: 80, gzipBytes: 30 }],
      ['assets/app.css', { rawBytes: 20, gzipBytes: 10 }],
      ['assets/home.js', { rawBytes: 60, gzipBytes: 25 }],
      ['assets/home.css', { rawBytes: 10, gzipBytes: 5 }],
    ]);

    expect(measureManifestStaticClosure(manifest, sizes, ['src/main.tsx'])).toEqual({
      files: ['assets/app.css', 'assets/entry.js', 'assets/shared.js'],
      rawBytes: 200,
      gzipBytes: 80,
    });
    expect(measureManifestStaticClosure(
      manifest,
      sizes,
      ['src/main.tsx', 'src/pages/HomePage.tsx'],
    )).toEqual({
      files: [
        'assets/app.css',
        'assets/entry.js',
        'assets/home.css',
        'assets/home.js',
        'assets/shared.js',
      ],
      rawBytes: 270,
      gzipBytes: 110,
    });
  });

  // Regression: §24.14 (reviewed startup closure headroom).
  it('keeps startup closure limits near five percent above the reviewed baseline', async () => {
    const configuredBudget = JSON.parse(await readFile(
      new URL('../../config/build-size-budget.json', import.meta.url),
      'utf8',
    ));

    expect(configuredBudget.baseline).toMatchObject({
      measuredAt: '2026-10-03',
      commit: '9ca52e2',
    });

    for (const metric of ['entryRawBytes']) {
      const baselineBytes = configuredBudget.baseline.metrics[metric];
      const limitBytes = configuredBudget.limits[metric];
      const ratio = limitBytes / baselineBytes;
      expect(ratio).toBeGreaterThanOrEqual(1.049);
      expect(ratio).toBeLessThanOrEqual(1.052);
    }
    // v0.17.2 integrates the lazy Backlogs route with current Settings history.
    // The combined build measures 131,925 B entry gzip; cap at 132,200 B
    // without changing the entry raw limit or allowing unbounded future growth.
    expect(configuredBudget.limits.entryGzipBytes).toBe(132200);
    expect(configuredBudget.limits.entryGzipBytes /
      configuredBudget.baseline.metrics.entryGzipBytes).toBeLessThanOrEqual(1.056);

    // v0.14.1 brings recipient Calendar and owner labels into Home. The
    // measured Home closure was 359,732 B gzip. Cap its one-time increase
    // tightly rather than weakening entry/initial startup limits.
    // Combined Backlogs + shared-task workspace measures 362,385 B gzip.
    expect(configuredBudget.limits.homeClosureGzipBytes).toBe(362900);
    expect(configuredBudget.limits.homeClosureGzipBytes /
      configuredBudget.baseline.metrics.homeClosureGzipBytes).toBeLessThanOrEqual(1.068);
    // v0.14.0 adds lazy, durable share queues and their account/reconnect
    // lifecycle. The measured Vercel initial closure was 144,049 B gzip:
    // this exceptional bound gives only 801 B headroom and preserves the
    // stricter entry and Home budgets.
    // Combined route metadata measures 144,883 B gzip.
    expect(configuredBudget.limits.initialClosureGzipBytes).toBe(145200);
    expect(configuredBudget.limits.initialClosureGzipBytes /
      configuredBudget.baseline.metrics.initialClosureGzipBytes).toBeLessThanOrEqual(1.061);
  });

  // Regression: §24.14 (aggregate/precache ceilings include reviewed shipped
  // product growth without widening startup/Home limits).
  it('preserves the reviewed aggregate and precache ceilings', async () => {
    const configuredBudget = JSON.parse(await readFile(
      new URL('../../config/build-size-budget.json', import.meta.url),
      'utf8',
    ));

    // v0.16.8 adds a lazy release-history Markdown renderer. The first
    // Preview Vercel build measured 2,394,877 B app raw and 2,479,228 B
    // precache; keep the new caps narrowly bounded while all startup/Home
    // and aggregate gzip ceilings remain unchanged.
    // v0.16.9 includes the historical PR-backed archive in the lazy
    // ReleaseHistoryPage. Verified Vercel measured 2,398,474 B raw,
    // 740,359 B gzip, and 2,482,825 B precache. These narrow caps
    // preserve the independently enforced entry/initial/Home budgets.
    // The v0.16.10 dev merge uses the byte-identical accepted Preview tree,
    // but its live Vercel build measured 2,400,745 B raw, 741,191 B gzip,
    // and 2,485,096 B precache. Raise only these aggregate caps with
    // 555–609 B headroom; startup/Home bounds stay unchanged.
    // v0.17.0: byte-identical accepted source uses 2,050 additional raw/
    // precache bytes on the dev Vercel target; measured overages were
    // 54 B and 5 B. Keep these dev-specific headroom increases below 150 B.
    // v0.17.2 measured 2,404,437 B raw / 743,010 B gzip /
    // 2,489,652 B precache. Keep <700 B margin per aggregate budget.
    expect(configuredBudget.limits).toMatchObject({
      appAssetsRawBytes: 2405100,
      appAssetsGzipBytes: 743700,
      precacheUniqueBytes: 2490300,
    });
  });

  // Regression: a longer release commit body must not consume PWA code-size
  // headroom solely by changing the build-info meta attribute in index.html.
  it('excludes only variable build-info bytes from the precache measurement', () => {
    const short = '<meta name="mosaic-build-info" content="one">';
    const long = '<meta name="mosaic-build-info" content="long &quot;description&quot; and Unicode 🧩">';
    const shell = '<script type="module" src="/assets/index.js"></script>';
    const normalizedBytes = html => Buffer.byteLength(html, 'utf8') - measureBuildInfoPayloadBytes(html);
    expect(normalizedBytes(short + shell)).toBe(normalizedBytes(long + shell));
    expect(measureBuildInfoPayloadBytes(short)).toBe(3);
    expect(measureBuildInfoPayloadBytes(long)).toBe(Buffer.byteLength('long &quot;description&quot; and Unicode 🧩'));
    expect(measureBuildInfoPayloadBytes(shell)).toBe(0);
    expect(() => measureBuildInfoPayloadBytes('<meta name="mosaic-build-info">')).toThrow(/content/);
    expect(() => measureBuildInfoPayloadBytes(short + short)).toThrow(/one mosaic-build-info/);
  });

  // Regression: §24.14 (deployment metadata must not perturb hashed JS size).
  it('keeps variable build identity out of Vite define replacements', async () => {
    const viteConfig = await readFile(
      new URL('../../vite.config.ts', import.meta.url),
      'utf8',
    );

    expect(viteConfig).toContain("name: 'mosaic-build-info-meta'");
    expect(viteConfig).toContain("name: 'mosaic-build-info'");
    expect(viteConfig).not.toContain(
      "'import.meta.env.VITE_APP_BUILD_COMMIT'",
    );
    expect(viteConfig).not.toContain(
      "'import.meta.env.VITE_APP_BUILD_MESSAGE'",
    );
    expect(viteConfig).not.toContain(
      "'import.meta.env.VITE_APP_BUILD_BRANCH'",
    );
  });

  // Regression: §24.14 (production build always executes the guard).
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
