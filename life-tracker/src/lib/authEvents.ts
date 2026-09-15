export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

export async function guardedCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isUnauthorizedError(err)) dispatchUnauthorized();
    throw err;
  }
}
