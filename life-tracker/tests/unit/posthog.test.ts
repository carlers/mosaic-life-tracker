import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogRef = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  captureException: vi.fn(),
  isFeatureEnabled: vi.fn(),
  onFeatureFlags: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogRef }));

async function loadAdapter(configured = true) {
  vi.resetModules();
  vi.stubEnv('VITE_POSTHOG_TOKEN', configured ? 'phc_test' : '');
  vi.stubEnv('VITE_POSTHOG_HOST', configured ? 'https://example.posthog.test' : '');
  return import('../../src/lib/posthog');
}

describe('PostHog adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthogRef.onFeatureFlags.mockReturnValue(() => {});
    posthogRef.isFeatureEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is a clean no-op when configuration is absent', async () => {
    const adapter = await loadAdapter(false);

    adapter.syncPostHogIdentity('user_1');
    adapter.captureHandledException(new Error('ignored'));
    await adapter.initializePostHog();

    expect(posthogRef.init).not.toHaveBeenCalled();
    expect(posthogRef.identify).not.toHaveBeenCalled();
    expect(posthogRef.captureException).not.toHaveBeenCalled();
    expect(adapter.getPostHogFeatureFlagState('flag')).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: false,
    });
  });

  it('initializes with privacy-minimal exception tracking configuration', async () => {
    const adapter = await loadAdapter();
    await adapter.initializePostHog();

    expect(posthogRef.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://example.posthog.test',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        rageclick: false,
        save_campaign_params: false,
        save_referrer: false,
        disableDeviceModel: true,
        disable_scroll_properties: true,
        enable_recording_console_log: false,
        persistence: 'memory',
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false,
        },
      })
    );
  });

  it('contains initialization failure and keeps callers fail-closed', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    posthogRef.init.mockImplementationOnce(() => {
      throw new Error('init failed');
    });
    const adapter = await loadAdapter();

    await expect(adapter.initializePostHog()).resolves.toBeUndefined();

    expect(adapter.getPostHogFeatureFlagState('flag')).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: true,
    });
    expect(warning).toHaveBeenCalled();
  });

  it('applies identity requested before async initialization completes', async () => {
    const adapter = await loadAdapter();

    adapter.syncPostHogIdentity('user_1');
    await adapter.initializePostHog();
    await Promise.resolve();

    expect(posthogRef.identify).toHaveBeenCalledWith('user_1');
  });

  it('suppresses duplicate identify and resets an identified session on null', async () => {
    const adapter = await loadAdapter();
    await adapter.initializePostHog();

    adapter.syncPostHogIdentity('user_1');
    adapter.syncPostHogIdentity('user_1');
    await Promise.resolve();
    expect(posthogRef.identify).toHaveBeenCalledTimes(1);

    adapter.syncPostHogIdentity(null);
    await Promise.resolve();
    expect(posthogRef.reset).toHaveBeenCalledTimes(1);
  });

  it('captures handled exceptions with only caller-supplied diagnostic context', async () => {
    const adapter = await loadAdapter();
    await adapter.initializePostHog();
    const error = new Error('boundary failed');

    adapter.captureHandledException(error, { boundary: 'HomePage' });
    await Promise.resolve();

    expect(posthogRef.captureException).toHaveBeenCalledWith(error, {
      boundary: 'HomePage',
    });
  });

  it('fails feature flags closed and reads loaded flags without exposure events', async () => {
    let flagsCallback: (() => void) | undefined;
    posthogRef.onFeatureFlags.mockImplementation((callback: () => void) => {
      flagsCallback = callback;
      return () => {};
    });
    posthogRef.isFeatureEnabled.mockReturnValue(true);
    const adapter = await loadAdapter();
    await adapter.initializePostHog();

    expect(adapter.getPostHogFeatureFlagState('new-ui').enabled).toBe(false);

    flagsCallback?.();

    expect(adapter.getPostHogFeatureFlagState('new-ui')).toEqual({
      enabled: true,
      isLoaded: true,
      hasError: false,
    });
    expect(posthogRef.isFeatureEnabled).toHaveBeenCalledWith('new-ui', {
      send_event: false,
      defaultValue: false,
    });
  });

  it('notifies subscribers after flag reloads', async () => {
    let flagsCallback: (() => void) | undefined;
    posthogRef.onFeatureFlags.mockImplementation((callback: () => void) => {
      flagsCallback = callback;
      return () => {};
    });
    const adapter = await loadAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribePostHogFeatureFlags(listener);
    await adapter.initializePostHog();

    flagsCallback?.();

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps flags disabled and reports a load error after a request failure', async () => {
    const adapter = await loadAdapter();
    await adapter.initializePostHog();
    const config = posthogRef.init.mock.calls[0][1] as {
      on_request_error: () => void;
    };

    config.on_request_error();

    expect(adapter.getPostHogFeatureFlagState('new-ui')).toEqual({
      enabled: false,
      isLoaded: false,
      hasError: true,
    });
  });
});
