#!/usr/bin/env node
/**
 * Bounded, unauthenticated, read-only health/version timing probe for
 * disposable self-hosted Appwrite instances. Not a load test or API proof.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULTS = Object.freeze({ requests: 20, concurrency: 2, timeoutMs: 5000 });
const LIMITS = Object.freeze({ requests: 100, concurrency: 4, timeoutMs: 10000 });

function integerFlag(value, name, max, min = 1) {
  if (!/^\d+$/.test(String(value ?? ''))) throw new Error(name + ' must be an integer');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(name + ' must be between ' + min + ' and ' + max);
  }
  return number;
}

export function validateDisposableEndpoint(input, confirmedHost) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Invalid --endpoint URL'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error('HTTPS required unless endpoint is loopback');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Endpoint must not contain credentials, query or fragment');
  }
  if (!['/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('Endpoint must end in exactly /v1');
  }
  if (url.hostname === 'cloud.appwrite.io' ||
      url.hostname.endsWith('.cloud.appwrite.io') ||
      url.hostname === 'appwrite.io' || url.hostname.endsWith('.appwrite.io')) {
    throw new Error('Managed Appwrite Cloud endpoints are prohibited');
  }
  if (!confirmedHost || confirmedHost !== url.hostname) {
    throw new Error('--confirm-host must exactly match the disposable endpoint hostname');
  }
  return url.origin + '/v1/health/version';
}

export function parseHealthProbeArgs(argv) {
  const config = { ...DEFAULTS, endpoint: '', confirmHost: '', disposable: false, json: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--confirm-disposable') config.disposable = true;
    else if (arg === '--json') config.json = true;
    else if (['--endpoint', '--confirm-host', '--requests', '--concurrency', '--timeout-ms'].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(arg + ' requires a value');
      if (arg === '--endpoint') config.endpoint = value;
      if (arg === '--confirm-host') config.confirmHost = value;
      if (arg === '--requests') config.requests = integerFlag(value, arg, LIMITS.requests);
      if (arg === '--concurrency') config.concurrency = integerFlag(value, arg, LIMITS.concurrency);
      if (arg === '--timeout-ms') config.timeoutMs = integerFlag(value, arg, LIMITS.timeoutMs, 250);
    } else if (arg === '--help' && argv.length === 1) return { help: true };
    else throw new Error('Unsupported option: ' + arg);
  }
  if (!config.disposable) throw new Error('Explicit --confirm-disposable is required');
  config.url = validateDisposableEndpoint(config.endpoint, config.confirmHost);
  return config;
}

export function nearestRankPercentile(values, percentage) {
  if (!values.length) return null;
  if (!(percentage > 0 && percentage <= 100)) throw new Error('Invalid percentile');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(percentage / 100 * sorted.length) - 1)];
}

export async function measureHealthProbe(config, {
  fetchImpl = fetch,
  clock = () => performance.now(),
} = {}) {
  // Validation must happen before the first request (including in programmatic use).
  const url = validateDisposableEndpoint(config.endpoint, config.confirmHost);
  if (!config.disposable) throw new Error('Explicit disposable consent is required');
  const requests = integerFlag(config.requests, 'requests', LIMITS.requests);
  const concurrency = integerFlag(config.concurrency, 'concurrency', LIMITS.concurrency);
  const timeoutMs = integerFlag(config.timeoutMs, 'timeoutMs', LIMITS.timeoutMs, 250);
  const results = Array(requests);
  let next = 0;
  const started = clock();
  await Promise.all(Array.from({ length: Math.min(requests, concurrency) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= requests) return;
      const at = clock();
      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          redirect: 'error',
          cache: 'no-store',
          credentials: 'omit',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { Accept: 'application/json' },
        });
        // Body may contain deployment metadata; never log, copy, or retain it.
        await response.body?.cancel?.();
        results[index] = { latencyMs: Math.max(0, clock() - at),
          ok: response.status === 200, status: response.status };
      } catch {
        results[index] = { latencyMs: Math.max(0, clock() - at),
          ok: false, status: 'network-error' };
      }
    }
  }));
  const timings = results.filter(x => x.ok).map(x => x.latencyMs);
  const elapsedMs = Math.max(0, clock() - started);
  const failures = results.filter(x => !x.ok);
  return {
    endpointHost: new URL(url).hostname,
    path: '/v1/health/version',
    attempted: requests,
    succeeded: timings.length,
    failed: failures.length,
    statusCounts: Object.fromEntries([...new Set(results.map(x => String(x.status)))].sort()
      .map(status => [status, results.filter(x => String(x.status) === status).length])),
    latencyMs: {
      min: timings.length ? Math.min(...timings) : null,
      p50: nearestRankPercentile(timings, 50),
      p95: nearestRankPercentile(timings, 95),
      max: timings.length ? Math.max(...timings) : null,
    },
    elapsedMs,
    concurrency,
    result: failures.length ? 'blocked' : 'pass',
    caveat: 'Unauthenticated health endpoint only; not app CRUD/realtime/Function latency, system headroom, or migration readiness.',
  };
}

export async function runHealthProbe(argv = process.argv.slice(2)) {
  const options = parseHealthProbeArgs(argv);
  if (options.help) {
    console.log('Usage: npm run selfhost:health-probe -- --endpoint https://DISPOSABLE-APPWRITE/v1 --confirm-host DISPOSABLE-APPWRITE --confirm-disposable [--requests 20] [--concurrency 2] [--json]');
    return;
  }
  const result = await measureHealthProbe(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log('Disposable Appwrite health probe: ' + JSON.stringify(result));
  if (result.result !== 'pass') process.exitCode = 1;
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHealthProbe().catch(error => {
    console.error(error instanceof Error ? error.message : 'Health probe failed');
    process.exitCode = 2;
  });
}
