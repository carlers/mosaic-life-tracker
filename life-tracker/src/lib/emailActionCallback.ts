/** Keep email-link credentials in memory, outside URLs, logs and durable storage. */
let captured: { pathname: string; hash: string } | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export const isEmailActionPath = (path: string) =>
  path === '/reset-password' || path === '/auth/confirm';

export function captureEmailActionCallback(target: Pick<Window, 'location' | 'history'>) {
  if (!isEmailActionPath(target.location.pathname)) return;
  captured = { pathname: target.location.pathname, hash: target.location.hash };
  // Remove even malformed/unsupported credentials before analytics, rendering,
  // error handling or a request can observe the original URL.
  target.history.replaceState(target.history.state, '', target.location.pathname);
  revision++;
  listeners.forEach(listener => listener());
}

export function readEmailActionCallback() { return captured; }
export function clearEmailActionCallback() { captured = null; }
export function emailActionRevision() { return revision; }
export function subscribeEmailActionCallback(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
