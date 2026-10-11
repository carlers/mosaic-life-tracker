import { describe, expect, it } from 'vitest';
import { compareSizeSnapshots, formatSizeDiagnostics } from '../../scripts/lib/build-size-diagnostics.mjs';

describe('build-size artifact diagnostics', () => {
  const before = {
    metrics: { entryGzipBytes: 120, homeClosureGzipBytes: 350, appAssetsRawBytes: 1000, precacheUniqueBytes: 1100 },
    files: {
      'src/main.tsx:js:0': { path: 'assets/index-old.js', rawBytes: 500, gzipBytes: 120 },
      'src/pages/HomePage.tsx:js:0': { path: 'assets/home-old.js', rawBytes: 400, gzipBytes: 230 },
    },
  };
  const after = {
    metrics: { entryGzipBytes: 121, homeClosureGzipBytes: 351, appAssetsRawBytes: 1300, precacheUniqueBytes: 1400 },
    files: {
      'src/main.tsx:js:0': { path: 'assets/index-new.js', rawBytes: 501, gzipBytes: 121 },
      'src/pages/HomePage.tsx:js:0': { path: 'assets/home-new.js', rawBytes: 400, gzipBytes: 230 },
      'src/pages/AlertsPage.tsx:js:0': { path: 'assets/alerts-new.js', rawBytes: 299, gzipBytes: 150 },
    },
    initial: { gzipBytes: 121 },
    homeClosure: { gzipBytes: 351 },
    deferredGzipBytes: 150,
  };
  it('aligns hashed output by source manifest key and shows added lazy modules', () => {
    const comparison = compareSizeSnapshots(before, after);
    expect(comparison.metrics.precacheUniqueBytes).toBe(300);
    expect(comparison.files).toContainEqual(expect.objectContaining({
      name: 'src/pages/AlertsPage.tsx:js:0', state: 'added', rawDelta: 299,
    }));
    const report = formatSizeDiagnostics(after, comparison);
    expect(report).toContain('other shipped assets outside Home closure: 150');
    expect(report).toContain('src/pages/AlertsPage.tsx');
    expect(report).toContain('precacheUniqueBytes: +300');
  });
  it('does not treat hash-only renames as binary growth', () => {
    const same = { ...after, files: { 'src/main.tsx:js:0': { path: 'assets/new-hash.js', rawBytes: 500, gzipBytes: 120 } } };
    const changes = compareSizeSnapshots({ ...before, files: { 'src/main.tsx:js:0': before.files['src/main.tsx:js:0'] } }, same);
    expect(changes.files).toEqual([]);
  });
});
