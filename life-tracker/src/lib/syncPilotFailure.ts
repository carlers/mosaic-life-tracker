/**
 * Display safe, actionable replication failures without exposing row IDs,
 * setting values, or raw Appwrite/RxDB error payloads.
 */
export interface SyncPilotIssue {
  group: string;
  detail: string;
}

function walkError(error: unknown, visit: (value: Record<string, unknown>) => void): void {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  while (pending.length && seen.size < 24) {
    const next = pending.shift();
    if (!next || typeof next !== 'object' || seen.has(next)) continue;
    seen.add(next);
    const value = next as Record<string, unknown>;
    visit(value);
    for (const key of ['cause', 'error', 'originalError', 'innerError', 'parameters', 'errors']) {
      const nested = value[key];
      if (Array.isArray(nested)) pending.push(...nested.slice(0, 8));
      else if (nested && typeof nested === 'object') pending.push(nested);
    }
  }
}

export function replicationHttpStatus(error: unknown): number | null {
  let status: number | null = null;
  walkError(error, (value) => {
    if (status !== null) return;
    for (const candidate of [value.code, value.status]) {
      if (typeof candidate === 'number' && Number.isInteger(candidate) &&
          candidate >= 400 && candidate <= 599) {
        status = candidate;
        return;
      }
    }
  });
  return status;
}

export function isNonRetryableReplicationFailure(error: unknown): boolean {
  const status = replicationHttpStatus(error);
  return status === 400 || status === 401 || status === 403 ||
    status === 404 || status === 413 || status === 422;
}

export function describeSyncPilotFailure(error: unknown): string {
  let stage: string | null = null;
  const labels: Record<string, string> = {
    profile: 'Profile mirror',
    friends: 'Friend preference validation',
    read: 'Remote settings read',
    create: 'Remote settings create',
    update: 'Remote settings update',
    pull: 'Remote settings pull',
  };
  walkError(error, (value) => {
    if (!stage && typeof value.syncStage === 'string' &&
      Object.prototype.hasOwnProperty.call(labels, value.syncStage)) {
      stage = labels[value.syncStage];
    }
  });
  const prefix = stage ? stage + ': ' : '';
  const status = replicationHttpStatus(error);
  if (status === 401) return prefix + 'HTTP 401 — sign-in expired; sign in again.';
  if (status === 403) return prefix + 'HTTP 403 — Appwrite denied access; check permissions.';
  if (status === 404) return prefix + 'HTTP 404 — a required remote resource is missing.';
  if (status === 400 || status === 413 || status === 422) {
    return prefix + 'HTTP ' + status + ' — server rejected the pending data or request.';
  }
  if (status === 429) return prefix + 'HTTP 429 — server rate limit; retry will continue.';
  if (status && status >= 500) return prefix + 'HTTP ' + status + ' — server unavailable; retry will continue.';
  return prefix + 'replication failed; inspect device console logs for the underlying error.';
}
