import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectServiceWorker } from './lib/inspect-service-worker.mjs';

// Run after vite build. An optional output directory supports isolated builds.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist');
const source = await readFile(join(directory, 'sw.js'), 'utf8');
const result = await inspectServiceWorker(source);
if (source.includes('__MOSAIC_ASSETS__')) {
  assert.equal(result.precacheSizes?.length, result.precacheUrls.length,
    'Injected precache must declare every asset size');
}
assert.equal(result.skipWaitingOnStartup, false, 'SW must not skip waiting at startup');
assert.equal(result.skipWaitingOnLifecycle, false, 'SW must not skip waiting during install/activate');
assert.equal(result.skipWaitingOnUnrelatedMessage, false, 'Unrelated messages must not activate an update');
assert.equal(result.clientsClaim, false, 'SW must not claim open clients');
assert.equal(result.navigationFallback, 'index.html', 'Preserve offline SPA navigation');
assert.deepEqual(result.navigationDenylist, ['^\\/v1\\/', '^\\/api\\/'], 'Preserve API navigation exclusions');
assert.deepEqual(
  result.importedScripts,
  ['/push-sw.js'],
  'Generated worker must import only the checked-in push handler'
);

for (const url of result.precacheUrls) {
  assert.ok(!/^(?:[a-z]+:)?\/\//i.test(url), `Precache URL must be same-origin: ${url}`);
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\//, '');
  assert.ok(pathname && !pathname.split('/').includes('..'), `Unsafe precache URL: ${url}`);
  const path = resolve(directory, pathname);
  const emittedPath = relative(directory, path);
  assert.ok(emittedPath && !emittedPath.startsWith('..') && !isAbsolute(emittedPath), `Precache URL escapes build output: ${url}`);
  const info = await stat(path);
  assert.ok(info.isFile(), `Precache URL is not an emitted static file: ${url}`);
  if (result.precacheSizes) {
    const i = result.precacheUrls.indexOf(url);
    assert.equal(result.precacheSizes[i], info.size,
      `Progress byte weight differs from emitted asset size: ${url}`);
  }
}

const importMap = JSON.parse(await readFile(join(directory, 'importmap.json'), 'utf8'));
assert.ok(
  Object.keys(importMap.imports ?? {}).length > 0,
  'Chunk import map must contain emitted chunk mappings'
);
assert.ok(
  result.precacheUrls.includes('importmap.json'),
  'Chunk import map must be precached for offline module resolution'
);

const manifest = JSON.parse(await readFile(join(directory, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.id, '/', 'Manifest must keep a stable app identity');
assert.equal(manifest.scope, '/', 'Manifest must retain root scope');
assert.equal(manifest.start_url, '/', 'Manifest must launch at the app root');
assert.ok(manifest.icons?.some(({ sizes }) => sizes === '192x192'), 'Manifest needs a 192px icon');
assert.ok(manifest.icons?.some(({ sizes }) => sizes === '512x512'), 'Manifest needs a 512px icon');

async function appChunks(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await appChunks(path));
    else if (/\.(js|css)$/.test(entry.name)) files.push(relative(directory, path).replaceAll('\\', '/'));
  }
  return files;
}
const chunks = await appChunks(join(directory, 'assets'));
assert.ok(chunks.length > 0, 'Expected production app chunks');
// The optional local speech engine must not inflate the offline shell.
// All other JS and CSS assets retain strict precache enforcement.
const optionalSpeechWorker = /^assets\/localWhisperWorker-[A-Za-z0-9_-]+\.js$/;
const optionalWorkers = chunks.filter(file => optionalSpeechWorker.test(file));
assert.ok(optionalWorkers.length <= 1, 'At most one optional speech worker is allowed');
for (const file of ['index.html', ...chunks]) {
  if (optionalSpeechWorker.test(file)) {
    assert.ok(!result.precacheUrls.includes(file), 'Optional speech worker must not be precached');
    continue;
  }

  assert.ok(result.precacheUrls.includes(file), `Missing offline precache asset: ${file}`);
}
console.log(`PWA policy passed: no forced activation/claim; ${result.precacheUrls.length} emitted static assets (${chunks.length} app chunks) precached; manifest identity/install metadata valid.`);
