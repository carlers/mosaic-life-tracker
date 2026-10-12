import { describe, expect, it } from 'vitest';
import { compareBuildEvidence, formatBuildParityReport, parseBuildEvidence } from '../../scripts/lib/build-parity-report.mjs';

const sha = 'e418b9fc6e1ead5b8b9d3864a1506ea920c09164';

function log(numbers: number[], opts: { giphy?: string; node?: number } = {}) {
  const names = ['entryRawBytes', 'entryGzipBytes', 'initialClosureGzipBytes',
    'homeClosureGzipBytes', 'appAssetsRawBytes', 'appAssetsGzipBytes', 'precacheUniqueBytes'];
  return [
    opts.giphy ? `[Mosaic] Build features: GIPHY stickers ${opts.giphy}` : '',
    opts.node ? `[Mosaic] Build runtime: Node.js ${opts.node}.11.0` : '',
    'vite v8.3.0 building client environment for production...',
    ...names.map((name, i) => `PASS  ${name}   ${numbers[i].toLocaleString('en-US')} B / 9,999,999 B`),
  ].join('\n');
}

describe('GitHub CI and Vercel build parity evidence (#592)', () => {
  const ci = [445956, 132703, 145935, 365650, 2458981, 763010, 2546288];
  const hosted = [446120, 132801, 146033, 365790, 2461195, 764012, 2548502];

  it('reproduces exact e418b9fc full CI green / hosted size red differences', () => {
    const result = compareBuildEvidence({
      ci: parseBuildEvidence(log(ci, { giphy: 'disabled', node: 22 })),
      hosted: parseBuildEvidence(log(hosted, { giphy: 'enabled', node: 24 })),
      ciSha: sha,
      hostedSha: sha,
    });
    expect(result.status).toBe('mismatch');
    expect(result.deltas.map(row => row.delta)).toEqual([164, 98, 98, 140, 2214, 1002, 2214]);
    expect(result.issues).toContain('GIPHY feature differs');
    expect(result.issues).toContain('Node major differs');
    expect(formatBuildParityReport(result)).not.toContain('9,999,999'); // no raw log exposure
  });

  it('parses FAIL lines and GitHub timestamp prefixes and ignores ANSI', () => {
    const evidence = parseBuildEvidence('2026-10-12T13:00:00Z \x1b[31mFAIL (+2 B)\x1b[0m  entryRawBytes  446,202 B / 446,200 B');
    expect(evidence.metrics.entryRawBytes).toEqual({ bytes: 446202, limitBytes: 446200 });
  });

  it('fails closed when runtime or feature provenance is missing, even with equal metrics', () => {
    const a = parseBuildEvidence(log(ci));
    const result = compareBuildEvidence({ ci: a, hosted: a, ciSha: sha, hostedSha: sha });
    expect(result.status).toBe('unverified');
    expect(result.unknown).toContain('missing GIPHY feature build context');
  });

  it('rejects different commit SHAs regardless of size equality', () => {
    const a = parseBuildEvidence(log(ci, { giphy: 'enabled', node: 24 }));
    const result = compareBuildEvidence({ ci: a, hosted: a, ciSha: sha, hostedSha: 'f'.repeat(40) });
    expect(result.status).toBe('mismatch');
    expect(result.issues).toContain('different Git commit SHAs');
  });

  it('identical known inputs and measurements are not claimed to be identical artifacts', () => {
    const a = parseBuildEvidence(log(ci, { giphy: 'enabled', node: 24 }));
    const result = compareBuildEvidence({ ci: a, hosted: a, ciSha: sha, hostedSha: sha });
    expect(result.status).toBe('matching-measurements');
    expect(formatBuildParityReport(result)).toContain('do not prove identical emitted assets');
  });

  it('rejects missing SHA or invalid evidence', () => {
    const a = parseBuildEvidence(log(ci));
    expect(() => compareBuildEvidence({ ci: a, hosted: a, ciSha: sha.slice(0, 8), hostedSha: sha })).toThrow();
  });
});
