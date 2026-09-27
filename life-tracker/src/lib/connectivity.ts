export type ConnectivityStatus = 'checking' | 'online' | 'offline';

export interface ConnectivitySnapshot {
  status: ConnectivityStatus;
  reason: string | null;
  lastConfirmedAt: string | null;
}

let snapshot: ConnectivitySnapshot = {
  status:
    typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'offline'
      : 'checking',
  reason:
    typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'browser-offline'
      : 'startup',
  lastConfirmedAt: null,
};

const listeners = new Set<() => void>();
let initialized = false;

function publish(next: ConnectivitySnapshot): void {
  if (
    snapshot.status === next.status &&
    snapshot.reason === next.reason &&
    snapshot.lastConfirmedAt === next.lastConfirmedAt
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return snapshot;
}

export function subscribeToConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markConnectivityChecking(reason = 'checking'): void {
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    markConnectivityOffline('browser-offline');
    return;
  }
  publish({
    status: 'checking',
    reason,
    lastConfirmedAt: snapshot.lastConfirmedAt,
  });
}

export function markConnectivityOnline(reason = 'appwrite-response'): void {
  publish({
    status: 'online',
    reason,
    lastConfirmedAt: new Date().toISOString(),
  });
}

export function markConnectivityOffline(reason = 'appwrite-unreachable'): void {
  publish({
    status: 'offline',
    reason,
    lastConfirmedAt: snapshot.lastConfirmedAt,
  });
}

export function isNetworkFailure(error: unknown): boolean {
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    return true;
  }

  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'number' && code >= 400 && code < 600) {
    return false;
  }
  const status = (error as { responseStatusCode?: unknown } | null)
    ?.responseStatusCode;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('offline')
  );
}

export function reportConnectivityResult(error?: unknown): void {
  if (error === undefined) {
    markConnectivityOnline();
    return;
  }
  if (isNetworkFailure(error)) {
    markConnectivityOffline();
  } else {
    // A 4xx/5xx still proves Appwrite is reachable.
    markConnectivityOnline('appwrite-error-response');
  }
}

export function initializeConnectivity(target: Window): void {
  if (initialized) return;
  initialized = true;

  const handleOffline = () => markConnectivityOffline('browser-offline');
  const handleOnline = () => markConnectivityChecking('browser-online-event');

  target.addEventListener('offline', handleOffline);
  target.addEventListener('online', handleOnline);

  if (target.navigator.onLine === false) {
    handleOffline();
  } else {
    markConnectivityChecking('startup');
  }
}

export function resetConnectivityForTests(
  next: ConnectivitySnapshot = {
    status: 'checking',
    reason: 'test',
    lastConfirmedAt: null,
  }
): void {
  snapshot = next;
  listeners.clear();
  initialized = false;
}
