// Diagnostic build only: writes to a unique OS temporary directory, never dist/.
// Run from the project root: node scripts/audit-bundle.mjs
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, version as viteVersion } from 'vite';

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

const files = await measure(outDir);
const sw = await readFile(join(outDir, 'sw.js'), 'utf8');
// Match the literal manifest emitted by the installed generateSW version.
const precacheUrls = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((match) => match[1]);
if (!precacheUrls.length) throw new Error('No precache entries found; inspect the generated SW format.');
const uniqueUrls = [...new Set(precacheUrls)];
const fileSizes = new Map(files.map((file) => [file.file, file.bytes]));
for (const url of uniqueUrls) {
  if (!fileSizes.has(url)) throw new Error(`Missing precache asset: ${url}`);
}
const summary = {
  node: process.version,
  vite: viteVersion,
  files,
  chunks,
  moduleGraph,
  precache: {
    entries: precacheUrls.length,
    uniqueUrls: uniqueUrls.length,
    bytesCountingDuplicates: precacheUrls.reduce((sum, url) => sum + fileSizes.get(url), 0),
    uniqueBytes: uniqueUrls.reduce((sum, url) => sum + fileSizes.get(url), 0),
    urls: precacheUrls,
  },
  serviceWorker: {
    callsSkipWaiting: /\.skipWaiting\(\)/.test(sw),
    callsClientsClaim: /\.clientsClaim\(\)/.test(sw),
  },
  note: 'Artifact bytes/gzip are measured from emitted files. Module renderedLength is a bundler attribution metric, not compressed transfer size or predicted savings.',
};
const report = join(directory, 'report.json');
await writeFile(report, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nAudit metadata: ${report}`);
console.table(files);
console.log('Precache:', summary.precache.entries, 'entries;', summary.precache.uniqueUrls, 'unique URLs;', summary.precache.uniqueBytes, 'unique bytes');
console.log('Service worker:', summary.serviceWorker);
for (const chunk of chunks) {
  console.log(`\nLargest package contributions in ${chunk.file} (renderedLength):`);
  console.table(chunk.packages.slice(0, 15));
}
