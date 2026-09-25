import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inspectServiceWorker } from './inspect-service-worker.mjs';

export const BUILD_SIZE_METRICS = [
  'entryRawBytes',
  'entryGzipBytes',
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
  if (budget.schemaVersion !== 1) throw new Error('Unsupported build-size budget schemaVersion');
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
    return `${status.padEnd(18)} ${metric.name.padEnd(24)} ${formatBytes(metric.bytes).padStart(12)} / ${formatBytes(metric.limitBytes)}`;
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

export async function measureProductionBuild(directory) {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const entryUrl = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/i)?.[1];
  if (!entryUrl) throw new Error('Unable to identify the module entry in index.html');
  const entry = await readFile(emittedPath(directory, entryUrl));

  let appAssetsRawBytes = 0;
  let appAssetsGzipBytes = 0;
  const appAssets = await listAppAssets(directory);
  for (const path of appAssets) {
    const data = await readFile(path);
    appAssetsRawBytes += data.length;
    appAssetsGzipBytes += gzipSync(data).length;
  }

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
    appAssetsRawBytes,
    appAssetsGzipBytes,
    precacheUniqueBytes,
  };
}
