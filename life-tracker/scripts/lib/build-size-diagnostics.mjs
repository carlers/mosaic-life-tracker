import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { measureManifestStaticClosure, measureProductionBuild } from './build-size-guard.mjs';

function groupKey(key, kind, index = 0) {
  return `${key}:${kind}:${index}`;
}

// Account for every emitted JS/CSS asset, including files missing from Vite's
// manifest (for example emitted by plugins after Vite's normal file listing).
// Assign each path once: shared CSS entries must not inflate file diagnostics.
export function groupEmittedAssets(manifest, diskSizes) {
  const files = {};
  const assigned = new Set();
  for (const [key, chunk] of Object.entries(manifest)) {
    const paths = [[chunk.file, groupKey(key, 'js')],
      ...(chunk.css ?? []).map((path, index) => [path, groupKey(key, 'css', index)])];
    for (const [path, logical] of paths) {
      if (!diskSizes.has(path) || assigned.has(path)) continue;
      files[logical] = { path, ...diskSizes.get(path) };
      assigned.add(path);
    }
  }
  for (const [path, sizes] of diskSizes) {
    if (!assigned.has(path)) files[`unmapped:${path}`] = { path, ...sizes };
  }
  return files;
}

export function compareSizeSnapshots(before, after) {
  const names = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
  const files = [...names].map(name => {
    const oldFile = before.files[name];
    const newFile = after.files[name];
    return {
      name,
      oldPath: oldFile?.path ?? null,
      path: newFile?.path ?? null,
      rawDelta: (newFile?.rawBytes ?? 0) - (oldFile?.rawBytes ?? 0),
      gzipDelta: (newFile?.gzipBytes ?? 0) - (oldFile?.gzipBytes ?? 0),
      state: !oldFile ? 'added' : !newFile ? 'removed' : 'changed',
    };
  }).filter(item => item.state !== 'changed' || item.rawDelta !== 0 || item.gzipDelta !== 0);
  files.sort((a, b) => Math.abs(b.gzipDelta) - Math.abs(a.gzipDelta) || a.name.localeCompare(b.name));
  const metrics = Object.fromEntries(Object.keys(after.metrics).map(key => [
    key, after.metrics[key] - before.metrics[key],
  ]));
  return { files, metrics };
}

export async function readBuildSizeSnapshot(directory) {
  const metrics = await measureProductionBuild(directory);
  const manifest = JSON.parse(await readFile(join(directory, '.vite', 'manifest.json'), 'utf8'));
  const diskSizes = new Map();
  const entries = await readdir(join(directory, 'assets'));
  for (const file of entries.filter(file => /\.(?:js|css)$/.test(file))) {
    const path = `assets/${file}`;
    const data = await readFile(join(directory, path));
    diskSizes.set(path, { rawBytes: data.length, gzipBytes: gzipSync(data).length });
  }
  const files = groupEmittedAssets(manifest, diskSizes);
  const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry);
  const home = Object.entries(manifest).find(([key, chunk]) =>
    key === 'src/pages/HomePage.tsx' || chunk.src === 'src/pages/HomePage.tsx');
  if (!entry || !home) throw new Error('Missing entry/Home manifest entry');
  const initial = measureManifestStaticClosure(manifest, diskSizes, [entry[0]]);
  const homeClosure = measureManifestStaticClosure(manifest, diskSizes, [entry[0], home[0]]);
  const deferredGzipBytes = metrics.appAssetsGzipBytes - homeClosure.gzipBytes;
  const unmappedGzipBytes = Object.entries(files)
    .filter(([key]) => key.startsWith('unmapped:'))
    .reduce((total, [, asset]) => total + asset.gzipBytes, 0);
  return { metrics, files, initial, homeClosure, deferredGzipBytes, unmappedGzipBytes };
}

export function formatSizeDiagnostics(snapshot, comparison = null) {
  const lines = [
    'Build-size diagnostics (emitted JS/CSS; gzip bytes):',
    `initial static closure: ${snapshot.initial.gzipBytes}`,
    `Home static closure: ${snapshot.homeClosure.gzipBytes}`,
    `other shipped assets outside Home closure: ${snapshot.deferredGzipBytes}`,
    `normalized precache: ${snapshot.metrics.precacheUniqueBytes}`,
    `emitted assets absent from Vite manifest (gzip): ${snapshot.unmappedGzipBytes ?? 'unknown'}`,
  ];
  if (comparison) {
    lines.push('Deltas vs reference build (same manifest key, not hashed filename):');
    for (const [key, delta] of Object.entries(comparison.metrics)) lines.push(`  ${key}: ${delta >= 0 ? '+' : ''}${delta}`);
    for (const file of comparison.files.slice(0, 15)) {
      lines.push(`  ${file.name}: raw ${file.rawDelta >= 0 ? '+' : ''}${file.rawDelta}, gzip ${file.gzipDelta >= 0 ? '+' : ''}${file.gzipDelta} (${file.state}; ${file.path ?? file.oldPath})`);
    }
  } else {
    lines.push('Largest emitted JS/CSS assets (including untracked):');
    for (const [name, file] of Object.entries(snapshot.files)
      .sort((a, b) => b[1].gzipBytes - a[1].gzipBytes).slice(0, 10)) {
      lines.push(`  ${name}: raw ${file.rawBytes}, gzip ${file.gzipBytes} (${file.path})`);
    }
  }
  lines.push('All emitted JS/CSS assets are grouped once; authoritative totals are the seven budget metrics.');
  return lines.join('\n');
}
