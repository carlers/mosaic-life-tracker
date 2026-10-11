import { describe, expect, it } from 'vitest';
import { compareSizeSnapshots, formatSizeDiagnostics, groupEmittedAssets } from '../../scripts/lib/build-size-diagnostics.mjs';

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
    unmappedGzipBytes: 0,
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
  it('reports plugin/unmanifested output and counts shared CSS only once', () => {
    const assets = new Map([
      ['assets/app.js', { rawBytes: 90, gzipBytes: 60 }],
      ['assets/common.css', { rawBytes: 30, gzipBytes: 20 }],
      ['assets/plugin.js', { rawBytes: 120, gzipBytes: 85 }],
    ]);
    const files = groupEmittedAssets({
      'src/main.tsx': { file: 'assets/app.js', css: ['assets/common.css'] },
      'src/second.tsx': { file: 'assets/app.js', css: ['assets/common.css'] },
    }, assets);
    expect(Object.keys(files)).toHaveLength(3);
    expect(files['unmapped:assets/plugin.js']).toEqual({
      path: 'assets/plugin.js', rawBytes: 120, gzipBytes: 85,
    });
    expect(Object.values(files).reduce((sum, file) => sum + file.rawBytes, 0)).toBe(240);
    expect(formatSizeDiagnostics({ ...after, files, unmappedGzipBytes: 85 }))
      .toContain('emitted assets absent from Vite manifest (gzip): 85');
  });
  it('does not treat hash-only renames as binary growth', () => {
    const same = { ...after, files: { 'src/main.tsx:js:0': { path: 'assets/new-hash.js', rawBytes: 500, gzipBytes: 120 } } };
    const changes = compareSizeSnapshots({ ...before, files: { 'src/main.tsx:js:0': before.files['src/main.tsx:js:0'] } }, same);
    expect(changes.files).toEqual([]);
  });
});
