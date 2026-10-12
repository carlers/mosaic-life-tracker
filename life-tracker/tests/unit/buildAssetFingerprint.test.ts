import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareBuildAssetFingerprints, readBuildAssetFingerprint } from '../../scripts/lib/build-asset-fingerprint.mjs';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

async function fixture(js: string, filename = 'entry-hashA.js') {
  const directory = await mkdtemp(join(tmpdir(), 'mosaic-parity-'));
  roots.push(directory);
  await mkdir(join(directory, 'assets'), { recursive: true });
  await mkdir(join(directory, '.vite'), { recursive: true });
  await writeFile(join(directory, 'assets', filename), js);
  await writeFile(join(directory, 'assets', 'unmapped-X.css'), '.x{display:block}');
  await writeFile(join(directory, '.vite', 'manifest.json'), JSON.stringify({
    'src/main.tsx': { file: 'assets/' + filename, isEntry: true },
  }));
  return directory;
}

describe('JS/CSS artifact parity fingerprints (#592)', () => {
  it('compares the same logical assets regardless of hashed filename and temporary build directory', async () => {
    const ci = await readBuildAssetFingerprint(await fixture('console.log(1)', 'entry-aaaa1111.js'));
    const hosted = await readBuildAssetFingerprint(await fixture('console.log(1)', 'entry-bbbb2222.js'));
    expect(ci.digest).toBe(hosted.digest);
    expect(ci.assetCount).toBe(2); // including plugin-emitted, non-manifest CSS
    expect(compareBuildAssetFingerprints(ci, hosted)).toEqual({ matched: true, changes: [] });
  });

  it('detects feature-dependent JavaScript divergence without exposing bundled source or env values', async () => {
    const ci = await readBuildAssetFingerprint(await fixture('const KEY = "";'));
    const hosted = await readBuildAssetFingerprint(await fixture('const KEY = "secret";'));
    const result = compareBuildAssetFingerprints(ci, hosted);
    expect(result.matched).toBe(false);
    expect(result.changes).toMatchObject([{ key: 'src/main.tsx:js:0', state: 'changed', rawDeltaBytes: 6 }]);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(ci)).not.toContain('const KEY');
  });

  it('rejects structurally invalid comparison inputs', () => {
    expect(() => compareBuildAssetFingerprints({ assets: [] }, { assets: [] })).toThrow(/fingerprints/);
  });

  it('detects missing and added unmapped assets', async () => {
    const ci = await readBuildAssetFingerprint(await fixture('same'));
    const hostedDir = await fixture('same');
    await writeFile(join(hostedDir, 'assets', 'additional.css'), 'h1{font-weight:bold}');
    const hosted = await readBuildAssetFingerprint(hostedDir);
    expect(compareBuildAssetFingerprints(ci, hosted).changes).toMatchObject([
      { key: 'unmapped:assets/additional.css', state: 'added' },
    ]);
  });
});
