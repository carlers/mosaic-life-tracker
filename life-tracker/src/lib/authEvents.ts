import { reportConnectivityResult } from './connectivity';
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

let verificationRequestQueued = false;

export function isUnauthorizedError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === 401) return true;
  const statusCode = (err as { responseStatusCode?: number } | null)
    ?.responseStatusCode;
  if (statusCode === 401) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /unauthorized|missing scope|user_unauthorized/i.test(msg);
}

export function makeUnauthorizedError(message = 'Unauthorized'): Error {
  const err = new Error(message);
  (err as { code?: number }).code = 401;
  return err;
}

export function dispatchUnauthorized(): void {
  if (typeof window === 'undefined' || verificationRequestQueued) return;

  verificationRequestQueued = true;
  queueMicrotask(() => {
    verificationRequestQueued = false;
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  });
}

/**
 * Distinguishable error for "we could not determine auth/session state
 * because the network or device is offline." Never used to mean "no
 * session" — that case is signalled by a 401 (`isUnauthorizedError`).
 * See docs/PROJECT_REFERENCE.md §10 "Differentiate 'Not Logged In' From 'Couldn't Check'"
 * and §23.6.
 */
export class OfflineError extends Error {
  readonly code = 'OFFLINE';
  constructor(message = 'Offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export function isOfflineError(err: unknown): boolean {
  if (err instanceof OfflineError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'OFFLINE';
}

export async function guardedCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    reportConnectivityResult();
    return result;
  } catch (err) {
    reportConnectivityResult(err);
    if (isUnauthorizedError(err)) dispatchUnauthorized();
    throw err;
  }
}
