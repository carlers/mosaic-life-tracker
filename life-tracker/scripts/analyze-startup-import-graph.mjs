import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Read-only production-output dependency accounting; no app runtime changes.
// Static closure excludes runtime-triggered dynamic imports, worker downloads,
// account data, CDN negotiation and JavaScript parse/evaluation time.
const root = resolve('dist');
const manifest = JSON.parse(await readFile(join(root, '.vite', 'manifest.json'), 'utf8'));
const entries = Object.entries(manifest);
function findSource(source) {
  return entries.find(([key, chunk]) => key === source || chunk.src === source)?.[0] ?? null;
}
const roots = {
  bootstrap: entries.find(([, chunk]) => chunk.isEntry)?.[0] ?? null,
  home: findSource('src/pages/HomePage.tsx'),
  shell: findSource('src/components/layout/AppDataShell.tsx'),
  database: findSource('src/db/database.ts') ?? entries.find(([, c]) =>
    /^assets\/database-[a-zA-Z0-9_-]+\.js$/.test(c.file))?.[0] ?? null,
  explore: findSource('src/pages/ExplorePage.tsx'),
};
if (!roots.bootstrap || !roots.home) {
  throw new Error('Required bootstrap/Home manifest entry missing');
}
function closure(key, discovered = new Set()) {
  if (!key || discovered.has(key)) return discovered;
  const chunk = manifest[key];
  if (!chunk) throw new Error('Unresolved Vite manifest dependency ' + key);
  discovered.add(key);
  for (const imported of chunk.imports ?? []) closure(imported, discovered);
  return discovered;
}
function assets(keys) {
  const paths = new Set();
  for (const key of keys) {
    const chunk = manifest[key];
    if (chunk.file?.match(/\.(?:js|css)$/)) paths.add(chunk.file);
    for (const css of chunk.css ?? []) paths.add(css);
  }
  return paths;
}
const groups = Object.fromEntries(Object.entries(roots)
  .map(([name, key]) => [name, assets(closure(key))]));
const union = (...sets) => new Set(sets.flatMap(set => [...set]));
const difference = (left, right) => new Set([...left].filter(name => !right.has(name)));
const required = union(groups.bootstrap, groups.home, groups.shell, groups.database);
const incremental = {
  bootstrap: groups.bootstrap,
  homeExtra: difference(groups.home, groups.bootstrap),
  shellExtra: difference(groups.shell, union(groups.bootstrap, groups.home)),
  databaseExtra: difference(groups.database, union(groups.bootstrap, groups.home, groups.shell)),
  exploreExtra: difference(groups.explore, required),
  requiredCombined: required,
};
const sizes = new Map();
async function assetSize(path) {
  if (!sizes.has(path)) {
    const bytes = await readFile(join(root, path));
    sizes.set(path, { rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  }
  return sizes.get(path);
}
async function describe(set) {
  const files = await Promise.all([...set].map(async path => ({ path, ...await assetSize(path) })));
  files.sort((a, b) => b.gzipBytes - a.gzipBytes || a.path.localeCompare(b.path));
  return {
    count: files.length,
    rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
    largest: files.slice(0, 15),
  };
}
const summary = Object.fromEntries(await Promise.all(
  Object.entries(incremental).map(async ([name, files]) => [name, await describe(files)])
));
const report = {
  sourceSha: process.env.MOSAIC_AUDIT_SOURCE_SHA ?? 'local',
  roots,
  summary,
  missingOptionalRoots: Object.entries(roots).filter(([, key]) => !key).map(([name]) => name),
  notes: [
    'Only Vite manifest transitive static imports and associated emitted CSS are counted.',
    'Dynamic imports not statically closed are excluded and may be loaded at runtime.',
    'Do not equate the static gzip total with browser resource transfer timings.',
    'No network calls, app data, or source rewriting are performed.',
  ],
};
await mkdir(resolve('.mosaic/slow-startup'), { recursive: true });
await writeFile(resolve('.mosaic/slow-startup/import-graph.json'),
  JSON.stringify(report, null, 2) + '\n');
console.log('MOSAIC_858_IMPORT_GRAPH_SUMMARY ' + JSON.stringify({
  roots,
  groupGzip: Object.fromEntries(Object.entries(summary).map(([name, stats]) =>
    [name, { count: stats.count, gzipBytes: stats.gzipBytes, largest: stats.largest.slice(0, 7) }])),
}));
