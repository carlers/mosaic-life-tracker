export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export function isUnauthorizedError(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === 401) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /unauthorized|missing scope|user_unauthorized/i.test(msg);
}

export function dispatchUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
}