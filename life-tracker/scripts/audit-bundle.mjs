// Diagnostic build only: writes to a unique OS temporary directory, never dist/.
// Run from the project root: node scripts/audit-bundle.mjs
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, version as viteVersion } from 'vite';
import { inspectServiceWorker } from './lib/inspect-service-worker.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'mosaic-bundle-audit-'));
const outDir = join(directory, 'dist');
const chunks = [];
const moduleGraph = [];
const normalize = (id) => relative(root, id).replaceAll('\\', '/');

function owner(id) {
  const dependency = id.split('/node_modules/').at(-1);
  if (dependency === id) return id.startsWith(`${root}/src/`) ? 'application' : 'other';
  const parts = dependency.split('/');
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

await build({
  root,
  build: { outDir, emptyOutDir: true },
  plugins: [{
    name: 'mosaic-audit-metadata',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const packages = new Map();
        const modules = Object.entries(output.modules).map(([id, module]) => {
          const packageName = owner(id);
          packages.set(packageName, (packages.get(packageName) ?? 0) + module.renderedLength);
          return { id: normalize(id), renderedLength: module.renderedLength };
        });
        chunks.push({
          file: output.fileName,
          isEntry: output.isEntry,
          isDynamicEntry: output.isDynamicEntry,
          imports: output.imports,
          dynamicImports: output.dynamicImports,
          css: [...(output.viteMetadata?.importedCss ?? [])],
          packages: [...packages].map(([name, renderedLength]) => ({ name, renderedLength }))
            .sort((a, b) => b.renderedLength - a.renderedLength),
          modules: modules.sort((a, b) => b.renderedLength - a.renderedLength),
        });
      }
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        moduleGraph.push({
          id: normalize(id),
          imports: info.importedIds.map(normalize),
          dynamicImports: info.dynamicallyImportedIds.map(normalize),
        });
      }
    },
  }],
});

async function measure(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const fullPath = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await measure(fullPath));
    else {
      const data = await readFile(fullPath);
      files.push({ file: relative(outDir, fullPath), bytes: data.length, gzipBytes: gzipSync(data).length });
    }
  }
  return files.sort((a, b) => b.bytes - a.bytes);
}

async function listRuntimeSourceFiles(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const fullPath = join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRuntimeSourceFiles(fullPath));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(normalize(fullPath));
    }
  }
  return files;
}

const files = await measure(outDir);
const sizes = new Map(files.map((file) => [file.file, file]));
const chunkByFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));

function staticClosure(startFiles) {
  const chunkFiles = new Set();
  const assetFiles = new Set();
  const packageNames = new Set();
  const pending = [...startFiles];
  while (pending.length > 0) {
    const file = pending.pop();
    if (chunkFiles.has(file)) continue;
    const chunk = chunkByFile.get(file);
    if (!chunk) throw new Error(`Missing chunk metadata: ${file}`);
    chunkFiles.add(file);
    for (const css of chunk.css) assetFiles.add(css);
    for (const dependency of chunk.imports) pending.push(dependency);
    for (const pkg of chunk.packages) packageNames.add(pkg.name);
  }
  const allFiles = [...chunkFiles, ...assetFiles];
  return {
    files: allFiles.sort(),
    bytes: allFiles.reduce((sum, file) => sum + (sizes.get(file)?.bytes ?? 0), 0),
    gzipBytes: allFiles.reduce((sum, file) => sum + (sizes.get(file)?.gzipBytes ?? 0), 0),
    packages: [...packageNames].sort(),
  };
}

const entry = chunks.find((chunk) => chunk.isEntry);
const home = chunks.find((chunk) =>
  chunk.modules.some((module) => module.id === 'src/pages/HomePage.tsx')
);
if (!entry || !home) {
  throw new Error('Missing app entry or Home route chunk metadata.');
}
const boundaries = {
  initial: staticClosure([entry.file]),
  home: staticClosure([entry.file, home.file]),
  deferredPackages: [
    'browser-image-compression',
    'emoji-picker-react',
    'fflate',
    'photoswipe',
  ],
};
for (const [name, closure] of Object.entries({
  initial: boundaries.initial,
  home: boundaries.home,
})) {
  const leaked = boundaries.deferredPackages.filter((pkg) =>
    closure.packages.includes(pkg)
  );
  if (leaked.length > 0) {
    throw new Error(`${name} closure eagerly includes: ${leaked.join(', ')}`);
  }
}
const sw = await readFile(join(outDir, 'sw.js'), 'utf8');
const { precacheUrls, ...serviceWorker } = await inspectServiceWorker(sw);
const uniqueUrls = [...new Set(precacheUrls)];
const fileSizes = new Map(files.map((file) => [file.file, file.bytes]));
for (const url of uniqueUrls) {
  if (!fileSizes.has(url)) throw new Error(`Missing precache asset: ${url}`);
}
const runtimeModuleIds = new Set(moduleGraph.map(({ id }) => id));
const runtimeUnreachableSourceFiles = (await listRuntimeSourceFiles(join(root, 'src')))
  .filter((file) => !runtimeModuleIds.has(file))
  .sort();
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const runtimePackages = new Set(
  chunks.flatMap((chunk) => chunk.packages.map(({ name }) => name))
    .filter((name) => name !== 'application' && name !== 'other')
);
const declaredProductionDependenciesNotBundled = Object.keys(packageJson.dependencies ?? {})
  .filter((name) => !runtimePackages.has(name))
  .sort();

const summary = {
  node: process.version,
  vite: viteVersion,
  files,
  chunks,
  moduleGraph,
  boundaries,
  precache: {
    entries: precacheUrls.length,
    uniqueUrls: uniqueUrls.length,
    bytesCountingDuplicates: precacheUrls.reduce((sum, url) => sum + fileSizes.get(url), 0),
    uniqueBytes: uniqueUrls.reduce((sum, url) => sum + fileSizes.get(url), 0),
    urls: precacheUrls,
  },
  serviceWorker,
  reachability: {
    runtimeUnreachableSourceFiles,
    declaredProductionDependenciesNotBundled,
  },
  note: 'Artifact bytes/gzip are measured from emitted files. Module renderedLength is a bundler attribution metric, not compressed transfer size or predicted savings.',
};
const report = join(directory, 'report.json');
await writeFile(report, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nAudit metadata: ${report}`);
console.table(files);
console.log('Precache:', summary.precache.entries, 'entries;', summary.precache.uniqueUrls, 'unique URLs;', summary.precache.uniqueBytes, 'unique bytes');
console.log('Service worker:', summary.serviceWorker);
console.log('Runtime source files outside the production module graph:', runtimeUnreachableSourceFiles);
console.log('Declared production dependencies absent from the production graph:', declaredProductionDependenciesNotBundled);
console.log('Static closures:', {
  initial: { bytes: boundaries.initial.bytes, gzipBytes: boundaries.initial.gzipBytes },
  home: { bytes: boundaries.home.bytes, gzipBytes: boundaries.home.gzipBytes },
  deferredPackages: boundaries.deferredPackages,
});
for (const chunk of chunks) {
  console.log(`\nLargest package contributions in ${chunk.file} (renderedLength):`);
  console.table(chunk.packages.slice(0, 15));
}
