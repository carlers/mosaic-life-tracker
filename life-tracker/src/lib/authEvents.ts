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

export function dispatchUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}

/**
 * Wraps an async SDK call and dispatches the global unauthorized event
 * if it rejects with a 401. Re-throws the original error so callers can
 * still handle network errors, 404s, 429s, etc.
 *
 * Use this around every Appwrite SDK call and every raw `fetch` that can
 * return 401. Do NOT call dispatchUnauthorized() manually in call sites —
 * let this wrapper own the behavior so forgetting becomes structurally
 * hard.
 */
export async function guardedCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isUnauthorizedError(err)) dispatchUnauthorized();
    throw err;
  }
}