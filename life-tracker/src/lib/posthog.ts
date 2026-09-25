type FeatureFlagState = {
  enabled: boolean;
  isLoaded: boolean;
  hasError: boolean;
};

type PostHogConfig = {
  token: string;
  host: string;
};

type FlagValue = boolean | string;

type StackFrame = {
  platform: 'web:javascript';
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  chunk_id?: string;
};

type ExceptionMechanism = {
  type: string;
  handled: boolean;
};

type FallbackFrame = {
  filename?: string;
  lineno?: number;
  colno?: number;
};

type InjectedPostHogGlobals = typeof globalThis & {
  _posthogChunkIds?: Record<string, string>;
  _posthogReleaseId?: string;
};

const FLAG_REFRESH_MS = 5 * 60 * 1000;
const flagListeners = new Set<() => void>();

let config: PostHogConfig | null = null;
let configured = true;
let initializePromise: Promise<void> | null = null;
let desiredUserId: string | null = null;
let anonymousDistinctId = createAnonymousId();
let flags: Record<string, FlagValue> = {};
let flagsLoaded = false;
let flagsFailed = false;
let flagRequestGeneration = 0;
let errorHandler: ((event: ErrorEvent) => void) | null = null;
let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
let onlineHandler: (() => void) | null = null;
let refreshTimer: number | null = null;

function createAnonymousId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `mosaic_anon_${randomId}`;
  return `mosaic_anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getConfig(): PostHogConfig | null {
  const token = import.meta.env.VITE_POSTHOG_TOKEN?.trim();
  const rawHost = import.meta.env.VITE_POSTHOG_HOST?.trim();
  if (!token || !rawHost) return null;
  return {
    token,
    host: rawHost.replace(/\/+$/, ''),
  };
}

function currentDistinctId(): string {
  return desiredUserId ?? anonymousDistinctId;
}

function notifyFlags(): void {
  for (const listener of flagListeners) listener();
}

function markFlagsPending(): void {
  flags = {};
  flagsLoaded = false;
  flagsFailed = false;
  notifyFlags();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFlagValues(payload: unknown): Record<string, FlagValue> {
  if (!isRecord(payload)) return {};

  const result: Record<string, FlagValue> = {};
  const v2Flags = payload.flags;
  if (isRecord(v2Flags)) {
    for (const [key, detail] of Object.entries(v2Flags)) {
      if (typeof detail === 'boolean' || typeof detail === 'string') {
        result[key] = detail;
        continue;
      }
      if (!isRecord(detail)) continue;
      const variant = detail.variant;
      const enabled = detail.enabled;
      if (typeof variant === 'string') {
        result[key] = variant;
      } else if (typeof enabled === 'boolean') {
        result[key] = enabled;
      }
    }
    return result;
  }

  const legacyFlags = payload.featureFlags;
  if (Array.isArray(legacyFlags)) {
    for (const key of legacyFlags) {
      if (typeof key === 'string') result[key] = true;
    }
  } else if (isRecord(legacyFlags)) {
    for (const [key, value] of Object.entries(legacyFlags)) {
      if (typeof value === 'boolean' || typeof value === 'string') {
        result[key] = value;
      }
    }
  }

  return result;
}

async function reloadFeatureFlags(): Promise<void> {
  const activeConfig = config;
  if (!activeConfig) return;

  const generation = ++flagRequestGeneration;
  markFlagsPending();

  try {
    const response = await fetch(`${activeConfig.host}/flags/?v=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: activeConfig.token,
        distinct_id: currentDistinctId(),
      }),
    });
    if (!response.ok) throw new Error(`PostHog flags request failed: ${response.status}`);
    const payload: unknown = await response.json();
    if (generation !== flagRequestGeneration) return;

    flags = parseFlagValues(payload);
    flagsLoaded = true;
    flagsFailed = false;
    notifyFlags();
  } catch {
    if (generation !== flagRequestGeneration) return;
    flags = {};
    flagsLoaded = false;
    flagsFailed = true;
    notifyFlags();
  }
}

function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];

  const frames: StackFrame[] = [];
  for (const rawLine of stack.split('\n')) {
    const line = rawLine.trim();
    let match = /^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!match) {
      match = /^(.*?)@(.+?):(\d+):(\d+)$/.exec(line);
    }
    if (!match) continue;

    const [, functionName, filename, lineNumber, columnNumber] = match;
    frames.push({
      platform: 'web:javascript',
      filename,
      function: functionName?.trim() || '?',
      lineno: Number(lineNumber),
      colno: Number(columnNumber),
    });
    if (frames.length >= 50) break;
  }

  return frames.reverse();
}

function getInjectedReleaseId(): string | undefined {
  const value = (globalThis as InjectedPostHogGlobals)._posthogReleaseId;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getFilenameToChunkIdMap(): Record<string, string> {
  const chunkIds = (globalThis as InjectedPostHogGlobals)._posthogChunkIds;
  if (!chunkIds) return {};

  const result: Record<string, string> = {};
  for (const [stack, chunkId] of Object.entries(chunkIds)) {
    if (typeof chunkId !== 'string' || chunkId.length === 0) continue;
    const injectedFrames = parseStack(stack);
    for (let index = injectedFrames.length - 1; index >= 0; index -= 1) {
      const filename = injectedFrames[index]?.filename;
      if (!filename) continue;
      result[filename] = chunkId;
      break;
    }
  }
  return result;
}

function attachInjectedChunkIds(frames: StackFrame[]): StackFrame[] {
  const chunkIdsByFilename = getFilenameToChunkIdMap();
  return frames.map((frame) => {
    const chunkId = frame.filename
      ? chunkIdsByFilename[frame.filename]
      : undefined;
    return chunkId ? { ...frame, chunk_id: chunkId } : frame;
  });
}

function describeThrown(value: unknown): {
  type: string;
  message: string;
  stack?: string;
} {
  if (value instanceof Error) {
    return {
      type: value.name || 'Error',
      message: value.message || value.name || 'Error',
      stack: value.stack,
    };
  }

  if (isRecord(value)) {
    const type = typeof value.name === 'string' ? value.name : 'Error';
    const message =
      typeof value.message === 'string' ? value.message : String(value);
    const stack = typeof value.stack === 'string' ? value.stack : undefined;
    return { type, message, stack };
  }

  return {
    type: 'Error',
    message: typeof value === 'string' ? value : String(value),
  };
}

function buildExceptionProperties(
  value: unknown,
  mechanism: ExceptionMechanism,
  context?: Record<string, unknown>,
  fallbackFrame?: FallbackFrame
): Record<string, unknown> {
  const described = describeThrown(value);
  const frames = parseStack(described.stack);

  if (frames.length === 0 && fallbackFrame?.filename) {
    frames.push({
      platform: 'web:javascript',
      filename: fallbackFrame.filename,
      function: '?',
      lineno: fallbackFrame.lineno,
      colno: fallbackFrame.colno,
    });
  }

  const framesWithChunkIds = attachInjectedChunkIds(frames);
  const releaseId = getInjectedReleaseId();

  return {
    ...context,
    $lib: 'mosaic',
    $lib_version: 'web',
    $exception_level: 'error',
    ...(releaseId ? { $release_id: releaseId } : {}),
    $exception_list: [
      {
        type: described.type,
        value: described.message,
        mechanism: {
          type: mechanism.type,
          handled: mechanism.handled,
          synthetic: false,
          exception_id: 0,
        },
        ...(framesWithChunkIds.length > 0
          ? { stacktrace: { type: 'raw', frames: framesWithChunkIds } }
          : {}),
      },
    ],
  };
}

async function sendException(
  value: unknown,
  mechanism: ExceptionMechanism,
  context?: Record<string, unknown>,
  fallbackFrame?: FallbackFrame
): Promise<void> {
  const activeConfig = config;
  if (!activeConfig) return;

  try {
    await fetch(`${activeConfig.host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        api_key: activeConfig.token,
        event: '$exception',
        distinct_id: currentDistinctId(),
        properties: buildExceptionProperties(
          value,
          mechanism,
          context,
          fallbackFrame
        ),
      }),
    });
  } catch {
    // Error reporting must never affect application behavior.
  }
}

function installBrowserHandlers(): void {
  if (typeof window === 'undefined' || errorHandler || rejectionHandler) return;

  errorHandler = (event: ErrorEvent) => {
    const value = event.error ?? new Error(event.message || 'Unhandled browser error');
    void sendException(
      value,
      { type: 'generic', handled: false },
      undefined,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );
  };

  rejectionHandler = (event: PromiseRejectionEvent) => {
    void sendException(event.reason, { type: 'generic', handled: false });
  };

  onlineHandler = () => {
    void reloadFeatureFlags();
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', rejectionHandler);
  window.addEventListener('online', onlineHandler);
  refreshTimer = window.setInterval(() => {
    void reloadFeatureFlags();
  }, FLAG_REFRESH_MS);
}

function uninstallBrowserHandlers(): void {
  if (typeof window === 'undefined') return;

  if (errorHandler) window.removeEventListener('error', errorHandler);
  if (rejectionHandler) {
    window.removeEventListener('unhandledrejection', rejectionHandler);
  }
  if (onlineHandler) window.removeEventListener('online', onlineHandler);
  if (refreshTimer !== null) window.clearInterval(refreshTimer);

  errorHandler = null;
  rejectionHandler = null;
  onlineHandler = null;
  refreshTimer = null;
}

export function initializePostHog(): Promise<void> {
  if (initializePromise) return initializePromise;

  config = getConfig();
  if (!config) {
    configured = false;
    initializePromise = Promise.resolve();
    return initializePromise;
  }

  configured = true;
  installBrowserHandlers();
  initializePromise = Promise.resolve();
  void reloadFeatureFlags();
  return initializePromise;
}

export function syncPostHogIdentity(userId: string | null): void {
  if (desiredUserId === userId) return;

  const wasIdentified = desiredUserId !== null;
  desiredUserId = userId;
  if (userId === null && wasIdentified) {
    anonymousDistinctId = createAnonymousId();
  }

  if (initializePromise) {
    void initializePromise.then(() => {
      void reloadFeatureFlags();
    });
  } else {
    void initializePostHog();
  }
}

export function captureHandledException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  void initializePostHog().then(() =>
    sendException(error, { type: 'generic', handled: true }, context)
  );
}

export function getPostHogFeatureFlagState(flagKey: string): FeatureFlagState {
  if (!configured || !config || flagsFailed || !flagsLoaded) {
    return {
      enabled: false,
      isLoaded: flagsLoaded && !flagsFailed,
      hasError: flagsFailed,
    };
  }

  const value = flags[flagKey];
  return {
    enabled: value === true || (typeof value === 'string' && value.length > 0),
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
  flagRequestGeneration += 1;
  uninstallBrowserHandlers();
}
