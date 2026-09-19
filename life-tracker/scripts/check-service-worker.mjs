import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectServiceWorker } from './lib/inspect-service-worker.mjs';

// Run after vite build. An optional output directory supports isolated builds.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist');
const result = await inspectServiceWorker(await readFile(join(directory, 'sw.js'), 'utf8'));
assert.equal(result.skipWaitingOnStartup, false, 'SW must not skip waiting at startup');
assert.equal(result.skipWaitingOnLifecycle, false, 'SW must not skip waiting during install/activate');
assert.equal(result.skipWaitingOnUnrelatedMessage, false, 'Unrelated messages must not activate an update');
assert.equal(result.clientsClaim, false, 'SW must not claim open clients');
assert.equal(result.navigationFallback, 'index.html', 'Preserve offline SPA navigation');
assert.deepEqual(result.navigationDenylist, ['^\\/v1\\/', '^\\/api\\/'], 'Preserve API navigation exclusions');

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
for (const file of ['index.html', ...chunks]) {
  assert.ok(result.precacheUrls.includes(file), `Missing offline precache asset: ${file}`);
}
console.log(`Service-worker policy passed: no forced activation/claim; offline shell and ${chunks.length} app chunks precached.`);
