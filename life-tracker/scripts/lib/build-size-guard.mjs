import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inspectServiceWorker } from './inspect-service-worker.mjs';

export const BUILD_SIZE_METRICS = [
  'entryRawBytes',
  'entryGzipBytes',
  'initialClosureGzipBytes',
  'homeClosureGzipBytes',
  'appAssetsRawBytes',
  'appAssetsGzipBytes',
  'precacheUniqueBytes',
];

function assertByteMap(value, label, { positive = false } = {}) {
  if (!value || typeof value !== 'object') throw new Error(`${label} must be an object`);
  for (const metric of BUILD_SIZE_METRICS) {
    const bytes = value[metric];
    if (!Number.isSafeInteger(bytes) || bytes < (positive ? 1 : 0)) {
      throw new Error(`${label}.${metric} must be a ${positive ? 'positive' : 'non-negative'} integer`);
    }
  }
}

export function validateBuildSizeBudget(budget) {
  if (!budget || typeof budget !== 'object') throw new Error('Budget must be an object');
  if (budget.schemaVersion !== 2) throw new Error('Unsupported build-size budget schemaVersion');
  if (!budget.baseline || typeof budget.baseline.measuredAt !== 'string'
    || typeof budget.baseline.commit !== 'string') {
    throw new Error('Budget baseline must include measuredAt and commit');
  }
  assertByteMap(budget.baseline.metrics, 'baseline.metrics');
  assertByteMap(budget.limits, 'limits', { positive: true });
  for (const metric of BUILD_SIZE_METRICS) {
    if (budget.baseline.metrics[metric] > budget.limits[metric]) {
      throw new Error(`baseline.metrics.${metric} exceeds its configured limit`);
    }
  }
  return budget;
}

export function evaluateBuildSizeBudget(budget, actual) {
  validateBuildSizeBudget(budget);
  assertByteMap(actual, 'actual');
  const metrics = BUILD_SIZE_METRICS.map((name) => {
    const bytes = actual[name];
    const limitBytes = budget.limits[name];
    return {
      name,
      bytes,
      baselineBytes: budget.baseline.metrics[name],
      limitBytes,
      overByBytes: Math.max(0, bytes - limitBytes),
      passed: bytes <= limitBytes,
    };
  });
  return { passed: metrics.every((metric) => metric.passed), metrics };
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

export function formatBuildSizeResult(result) {
  const heading = `Build-size budget ${result.passed ? 'passed' : 'failed'}.`;
  const rows = result.metrics.map((metric) => {
    const status = metric.passed ? 'PASS' : `FAIL (+${formatBytes(metric.overByBytes)})`;
    return `${status.padEnd(18)} ${metric.name.padEnd(28)} ${formatBytes(metric.bytes).padStart(12)} / ${formatBytes(metric.limitBytes)}`;
  });
  return [heading, ...rows].join('\n');
}

async function listAppAssets(directory) {
  const assetDirectory = join(directory, 'assets');
  const entries = await readdir(assetDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:js|css)$/.test(entry.name))
    .map((entry) => join(assetDirectory, entry.name));
}

function emittedPath(directory, url) {
  if (/^(?:[a-z]+:)?\/\//i.test(url)) throw new Error(`Precache URL must be same-origin: ${url}`);
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\//, '');
  const path = resolve(directory, pathname);
  const local = relative(directory, path);
  if (!pathname || !local || local.startsWith('..')) throw new Error(`Unsafe precache URL: ${url}`);
  return path;
}

function normalizedRelativePath(directory, path) {
  return relative(directory, path).replaceAll('\\', '/');
}

function findManifestKey(manifest, predicate, label) {
  const matches = Object.entries(manifest)
    .filter(([key, chunk]) => predicate(chunk, key))
    .map(([key]) => key);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} manifest entry; found ${matches.length}`);
  }
  return matches[0];
}

export function measureManifestStaticClosure(manifest, fileSizes, startKeys) {
  const files = new Set();
  const visitedChunks = new Set();
  const pending = [...startKeys];

  while (pending.length > 0) {
    const key = pending.pop();
    if (visitedChunks.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk || typeof chunk !== 'object') {
      throw new Error(`Missing manifest chunk: ${key}`);
    }
    visitedChunks.add(key);
    if (typeof chunk.file !== 'string') {
      throw new Error(`Manifest chunk ${key} is missing its emitted file`);
    }
    files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const imported of chunk.imports ?? []) pending.push(imported);
  }

  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const size = fileSizes.get(file);
    if (!size) throw new Error(`Missing emitted size for static closure asset: ${file}`);
    rawBytes += size.rawBytes;
    gzipBytes += size.gzipBytes;
  }
  return {
    files: [...files].sort(),
    rawBytes,
    gzipBytes,
  };
}

export async function measureProductionBuild(directory) {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const entryUrl = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/i)?.[1];
  if (!entryUrl) throw new Error('Unable to identify the module entry in index.html');
  const entryPath = emittedPath(directory, entryUrl);
  const entryFile = normalizedRelativePath(directory, entryPath);
  const entry = await readFile(entryPath);

  let appAssetsRawBytes = 0;
  let appAssetsGzipBytes = 0;
  const fileSizes = new Map();
  const appAssets = await listAppAssets(directory);
  for (const path of appAssets) {
    const data = await readFile(path);
    const rawBytes = data.length;
    const gzipBytes = gzipSync(data).length;
    appAssetsRawBytes += rawBytes;
    appAssetsGzipBytes += gzipBytes;
    fileSizes.set(normalizedRelativePath(directory, path), { rawBytes, gzipBytes });
  }

  const manifest = JSON.parse(
    await readFile(join(directory, '.vite', 'manifest.json'), 'utf8'),
  );
  const entryKey = findManifestKey(
    manifest,
    (chunk) => chunk.isEntry === true && chunk.file === entryFile,
    'application entry',
  );
  const homeKey = findManifestKey(
    manifest,
    (chunk, key) => key === 'src/pages/HomePage.tsx'
      || chunk.src === 'src/pages/HomePage.tsx',
    'Home route',
  );
  const initialClosure = measureManifestStaticClosure(manifest, fileSizes, [entryKey]);
  const homeClosure = measureManifestStaticClosure(manifest, fileSizes, [entryKey, homeKey]);

  const { precacheUrls } = await inspectServiceWorker(
    await readFile(join(directory, 'sw.js'), 'utf8'),
  );
  let precacheUniqueBytes = 0;
  for (const url of new Set(precacheUrls)) {
    precacheUniqueBytes += (await readFile(emittedPath(directory, url))).length;
  }

  return {
    entryRawBytes: entry.length,
    entryGzipBytes: gzipSync(entry).length,
    initialClosureGzipBytes: initialClosure.gzipBytes,
    homeClosureGzipBytes: homeClosure.gzipBytes,
    appAssetsRawBytes,
    appAssetsGzipBytes,
    precacheUniqueBytes,
  };
}
