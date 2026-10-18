import { describe, expect, it, vi } from 'vitest';
import {
  measureHealthProbe,
  nearestRankPercentile,
  parseHealthProbeArgs,
  validateDisposableEndpoint,
} from '../../scripts/selfhost-health-probe.mjs';

const sample = {
  endpoint: 'https://mosaic-oci-test.example.org/v1',
  confirmHost: 'mosaic-oci-test.example.org',
  disposable: true,
  requests: 5,
  concurrency: 2,
  timeoutMs: 2000,
};

describe('bounded, read-only disposable Appwrite health probe (#975)', () => {
  it('requires an explicitly confirmed disposable endpoint', () => {
    expect(() => parseHealthProbeArgs(['--endpoint', sample.endpoint])).toThrow(/confirm-disposable/);
    expect(() => validateDisposableEndpoint(sample.endpoint, '')).toThrow(/confirm-host/);
    expect(() => validateDisposableEndpoint(sample.endpoint, 'not-the-same.example.org')).toThrow(/confirm-host/);
    expect(validateDisposableEndpoint(sample.endpoint, sample.confirmHost))
      .toBe('https://mosaic-oci-test.example.org/v1/health/version');
  });

  it('rejects Appwrite Cloud, credentials, query strings and non-TLS public URLs', () => {
    for (const input of [
      'https://sgp.cloud.appwrite.io/v1',
      'https://cloud.appwrite.io/v1',
      'https://appwrite.io/v1',
      'https://user:pass@example.org/v1',
      'https://example.org/v1?token=secret',
      'http://example.org/v1',
      'https://example.org/v1/foo',
    ]) {
      const host = new URL(input).hostname;
      expect(() => validateDisposableEndpoint(input, host)).toThrow();
    }
    expect(validateDisposableEndpoint('http://localhost:8080/v1', 'localhost'))
      .toBe('http://localhost:8080/v1/health/version');
  });

  it('bounds requests and concurrency to avoid arbitrary stress', () => {
    expect(() => parseHealthProbeArgs([
      '--endpoint', sample.endpoint, '--confirm-host', sample.confirmHost, '--confirm-disposable',
      '--requests', '101',
    ])).toThrow(/between/);
    expect(() => parseHealthProbeArgs([
      '--endpoint', sample.endpoint, '--confirm-host', sample.confirmHost, '--confirm-disposable',
      '--concurrency', '5',
    ])).toThrow(/between/);
    expect(() => parseHealthProbeArgs(['--unrelated'])).toThrow(/Unsupported/);
  });

  it('computes nearest-rank percentiles without mutating observations', () => {
    const points = [20, 5, 40, 10, 15];
    expect(nearestRankPercentile(points, 50)).toBe(15);
    expect(nearestRankPercentile(points, 95)).toBe(40);
    expect(nearestRankPercentile([], 95)).toBeNull();
    expect(points).toEqual([20, 5, 40, 10, 15]);
  });

  it('uses only anonymous GET health/version, never request bodies or credentials', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, body: { cancel: vi.fn(async () => {}) } }));
    const result = await measureHealthProbe(sample, { fetchImpl });
    expect(result.result).toBe('pass');
    expect(result.attempted).toBe(5);
    expect(result.failed).toBe(0);
    for (const [url, options] of fetchImpl.mock.calls) {
      expect(url).toBe('https://mosaic-oci-test.example.org/v1/health/version');
      expect(options).toMatchObject({
        method: 'GET', redirect: 'error', cache: 'no-store',
        credentials: 'omit', headers: { Accept: 'application/json' },
      });
      expect(options.headers).not.toHaveProperty('Authorization');
    }
  });

  it('fails closed on errors and non-200 HTTP responses', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      if (++call === 1) throw new Error('offline');
      return { status: 503 };
    });
    const result = await measureHealthProbe({ ...sample, requests: 2 }, { fetchImpl });
    expect(result.result).toBe('blocked');
    expect(result.statusCounts).toEqual({ '503': 1, 'network-error': 1 });
    expect(result.latencyMs.p95).toBeNull();
  });

  it('validates programmatic callers before dispatching any requests', async () => {
    const fetchImpl = vi.fn();
    await expect(measureHealthProbe({ ...sample, disposable: false }, { fetchImpl }))
      .rejects.toThrow(/consent/);
    await expect(measureHealthProbe({ ...sample, concurrency: 400 }, { fetchImpl }))
      .rejects.toThrow(/between/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
