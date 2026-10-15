import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { groupEmittedAssets } from './build-size-diagnostics.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Fingerprint only emitted JS/CSS; do not read or print bundled environment
// values. Stable Vite manifest keys allow comparison across changed asset
// filenames and capture emitted files absent from the manifest.
export async function readBuildAssetFingerprint(directory) {
  const manifest = JSON.parse(await readFile(join(directory, '.vite', 'manifest.json'), 'utf8'));
  const disk = new Map();
  const digests = new Map();
  for (const name of await readdir(join(directory, 'assets'))) {
    if (!/\.(?:js|css)$/.test(name)) continue;
    const path = 'assets/' + name;
    const data = await readFile(join(directory, path));
    disk.set(path, { rawBytes: data.length });
    digests.set(path, hash(data));
  }
  const grouped = groupEmittedAssets(manifest, disk);
  const assets = Object.entries(grouped).map(([key, file]) => ({
    key,
    bytes: file.rawBytes,
    digest: digests.get(file.path),
  })).sort((a, b) => a.key.localeCompare(b.key));
  return {
    schemaVersion: 1,
    assetCount: assets.length,
    digest: hash(JSON.stringify(assets)),
    assets,
  };
}

export function compareBuildAssetFingerprints(ci, hosted) {
  if (ci?.schemaVersion !== 1 || hosted?.schemaVersion !== 1 ||
    !Array.isArray(ci.assets) || !Array.isArray(hosted.assets)) {
    throw new Error('Both comparable JS/CSS fingerprints are required');
  }
  const before = new Map(ci.assets.map(file => [file.key, file]));
  const after = new Map(hosted.assets.map(file => [file.key, file]));
  const changes = [...new Set([...before.keys(), ...after.keys()])].sort().flatMap(key => {
    const a = before.get(key);
    const b = after.get(key);
    if (a && b && a.digest === b.digest && a.bytes === b.bytes) return [];
    return [{
      key,
      state: !a ? 'added' : !b ? 'removed' : 'changed',
      rawDeltaBytes: (b?.bytes ?? 0) - (a?.bytes ?? 0),
    }];
  });
  return { matched: changes.length === 0 && ci.digest === hosted.digest, changes };
}
