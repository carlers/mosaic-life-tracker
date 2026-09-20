// Regression: Phase 3.7 PH-1/PH-2/PH-4/PH-5/PH-6.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

function jsonResponse(
  body: unknown,
  options: { ok?: boolean; status?: number } = {}
): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

async function loadAdapter(configured = true) {
  vi.resetModules();
  vi.stubEnv('VITE_POSTHOG_TOKEN', configured ? 'phc_test' : '');
  vi.stubEnv('VITE_POSTHOG_HOST', configured ? 'https://example.posthog.test/' : '');
  return import('../../src/lib/posthog');
}

function requestBody(callIndex: number): Record<string, unknown> {
  const options = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  return JSON.parse(String(options?.body)) as Record<string, unknown>;
}

describe('PostHog adapter', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ flags: {} }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a clean no-op when configuration is absent', async () => {
    const adapter = await loadAdapter(false);

    adapter.syncPostHogIdentity('user_1');
    adapter.captureHandledException(new Error('ignored'));
    await adapter.initializePostHog();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(adapter.getPostHogFeatureFlagState('flag')).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: false,
    });
  });

  it('loads flags with only the public token and current distinct id', async () => {
    const adapter = await loadAdapter();

    await adapter.initializePostHog();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.posthog.test/flags/?v=2'
    );
    const body = requestBody(0);
    expect(body.token).toBe('phc_test');
    expect(String(body.distinct_id)).toMatch(/^mosaic_anon_/);
    expect(Object.keys(body).sort()).toEqual(['distinct_id', 'token']);
  });

  it('uses the requested Appwrite id, suppresses duplicates, and resets to a fresh anonymous id', async () => {
    const adapter = await loadAdapter();

    adapter.syncPostHogIdentity('user_1');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requestBody(0).distinct_id).toBe('user_1');

    adapter.syncPostHogIdentity('user_1');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    adapter.syncPostHogIdentity(null);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const anonymousId = String(requestBody(1).distinct_id);
    expect(anonymousId).toMatch(/^mosaic_anon_/);
    expect(anonymousId).not.toBe('user_1');
  });

  it('captures handled exceptions through the minimal PostHog event endpoint with raw stack frames', async () => {
    const adapter = await loadAdapter();
    await adapter.initializePostHog();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockClear();

    const error = new Error('boundary failed');
    error.stack =
      'Error: boundary failed\n    at render (https://app.test/assets/index.js:10:20)';
    adapter.captureHandledException(error, { boundary: 'HomePage' });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.posthog.test/i/v0/e/'
    );

    const body = requestBody(0);
    expect(body.api_key).toBe('phc_test');
    expect(body.event).toBe('$exception');
    const properties = body.properties as Record<string, unknown>;
    expect(properties.boundary).toBe('HomePage');
    expect(properties.$exception_level).toBe('error');
    expect(properties.$exception_list).toEqual([
      expect.objectContaining({
        type: 'Error',
        value: 'boundary failed',
        mechanism: expect.objectContaining({ handled: true }),
        stacktrace: {
          type: 'raw',
          frames: [
            expect.objectContaining({
              filename: 'https://app.test/assets/index.js',
              function: 'render',
              lineno: 10,
              colno: 20,
              platform: 'web:javascript',
            }),
          ],
        },
      }),
    ]);
  });

  it('fails flags closed, parses v2 variants, and notifies subscribers after identity reload', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          flags: {
            enabled: { enabled: true, variant: null },
            variant: { enabled: true, variant: 'treatment' },
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ flags: { enabled: { enabled: false, variant: null } } })
      );

    const adapter = await loadAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribePostHogFeatureFlags(listener);

    expect(adapter.getPostHogFeatureFlagState('enabled').enabled).toBe(false);
    await vi.waitFor(() =>
      expect(adapter.getPostHogFeatureFlagState('enabled')).toEqual({
        enabled: true,
        isLoaded: true,
        hasError: false,
      })
    );
    expect(adapter.getPostHogFeatureFlagState('variant').enabled).toBe(true);

    listener.mockClear();
    adapter.syncPostHogIdentity('user_2');
    await vi.waitFor(() =>
      expect(adapter.getPostHogFeatureFlagState('enabled')).toEqual({
        enabled: false,
        isLoaded: true,
        hasError: false,
      })
    );
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps flags disabled and reports a load error after a request failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));
    const adapter = await loadAdapter();

    await adapter.initializePostHog();
    await vi.waitFor(() =>
      expect(adapter.getPostHogFeatureFlagState('new-ui')).toEqual({
        enabled: false,
        isLoaded: false,
        hasError: true,
      })
    );
  });

  it('installs only browser error, rejection, and reconnect listeners', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const setInterval = vi.fn(() => 7);
    const clearInterval = vi.fn();
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
      setInterval,
      clearInterval,
    });

    const adapter = await loadAdapter();
    await adapter.initializePostHog();

    expect(addEventListener.mock.calls.map(([name]) => name)).toEqual([
      'error',
      'unhandledrejection',
      'online',
    ]);
    adapter.disposePostHog();
    expect(clearInterval).toHaveBeenCalledWith(7);
  });
});
