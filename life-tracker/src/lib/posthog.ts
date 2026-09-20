type FeatureFlagState = {
  enabled: boolean;
  isLoaded: boolean;
  hasError: boolean;
};

type PostHogClient = {
  init: (token: string, config: Record<string, unknown>) => unknown;
  identify: (distinctId: string) => void;
  reset: () => void;
  captureException: (
    error: unknown,
    additionalProperties?: Record<string, unknown>
  ) => unknown;
  isFeatureEnabled: (
    key: string,
    options?: { send_event?: boolean; defaultValue?: boolean }
  ) => boolean | undefined;
  onFeatureFlags: (callback: () => void) => () => void;
};

let client: PostHogClient | null = null;
let initializePromise: Promise<void> | null = null;
let configured = true;
let initializationFailed = false;
let flagsLoaded = false;
let flagsFailed = false;
let desiredUserId: string | null = null;
let identifiedUserId: string | null = null;
let unsubscribeFlags: (() => void) | null = null;
const flagListeners = new Set<() => void>();

function getConfig() {
  const token = import.meta.env.VITE_POSTHOG_TOKEN?.trim();
  const host = import.meta.env.VITE_POSTHOG_HOST?.trim();
  return token && host ? { token, host } : null;
}

function notifyFlags(): void {
  for (const listener of flagListeners) listener();
}

function markFlagsPending(): void {
  flagsLoaded = false;
  flagsFailed = false;
  notifyFlags();
}

function applyDesiredIdentity(): void {
  if (!client) return;

  if (desiredUserId) {
    if (identifiedUserId === desiredUserId) return;
    markFlagsPending();
    client.identify(desiredUserId);
    identifiedUserId = desiredUserId;
    return;
  }

  if (identifiedUserId !== null) {
    markFlagsPending();
    client.reset();
    identifiedUserId = null;
  }
}

export function initializePostHog(): Promise<void> {
  if (initializePromise) return initializePromise;

  const config = getConfig();
  if (!config) {
    configured = false;
    initializePromise = Promise.resolve();
    return initializePromise;
  }

  configured = true;
  initializePromise = import('posthog-js')
    .then((module) => {
      const posthog = module.default as unknown as PostHogClient;
      posthog.init(config.token, {
        api_host: config.host,
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
        capture_exceptions: true,
        on_request_error: () => {
          if (!flagsLoaded) {
            flagsFailed = true;
            notifyFlags();
          }
        },
      });
      client = posthog;
      unsubscribeFlags = posthog.onFeatureFlags(() => {
        flagsLoaded = true;
        flagsFailed = false;
        notifyFlags();
      });
      applyDesiredIdentity();
    })
    .catch((error) => {
      initializationFailed = true;
      flagsFailed = true;
      notifyFlags();
      console.warn('[PostHog] Initialization failed:', error);
    });

  return initializePromise;
}

export function syncPostHogIdentity(userId: string | null): void {
  desiredUserId = userId;
  void initializePostHog().then(applyDesiredIdentity);
}

export function captureHandledException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  void initializePostHog().then(() => {
    client?.captureException(error, context);
  });
}

export function getPostHogFeatureFlagState(flagKey: string): FeatureFlagState {
  if (
    !configured ||
    initializationFailed ||
    flagsFailed ||
    !flagsLoaded ||
    !client
  ) {
    return {
      enabled: false,
      isLoaded: flagsLoaded && !flagsFailed,
      hasError: initializationFailed || flagsFailed,
    };
  }

  return {
    enabled:
      client.isFeatureEnabled(flagKey, {
        send_event: false,
        defaultValue: false,
      }) === true,
    isLoaded: true,
    hasError: false,
  };
}

export function subscribePostHogFeatureFlags(listener: () => void): () => void {
  flagListeners.add(listener);
  void initializePostHog();
  return () => {
    flagListeners.delete(listener);
  };
}

export function disposePostHog(): void {
  unsubscribeFlags?.();
  unsubscribeFlags = null;
}
