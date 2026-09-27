const DATA_READY_PREFIX = 'mosaic_offline_data_ready:';
const SHELL_READY_KEY = 'mosaic_offline_shell_ready';

export interface OfflineReadiness {
  dataReadyAt: string | null;
  shellReadyAt: string | null;
  isReady: boolean;
}

const listeners = new Set<() => void>();

function validIso(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function read(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return validIso(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Readiness is advisory metadata; storage failure must never block use.
  }
}

function publish(): void {
  for (const listener of listeners) listener();
}

export function getOfflineReadiness(userId?: string | null): OfflineReadiness {
  const dataReadyAt = userId ? read(`${DATA_READY_PREFIX}${userId}`) : null;
  const shellReadyAt = read(SHELL_READY_KEY);
  return {
    dataReadyAt,
    shellReadyAt,
    isReady: Boolean(dataReadyAt && shellReadyAt),
  };
}

export function markOfflineDataReady(
  userId: string,
  completedAt = new Date().toISOString()
): void {
  write(`${DATA_READY_PREFIX}${userId}`, completedAt);
  publish();
}

export function markOfflineShellReady(
  completedAt = new Date().toISOString()
): void {
  write(SHELL_READY_KEY, completedAt);
  publish();
}

export function clearOfflineDataReadiness(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const remove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(DATA_READY_PREFIX)) remove.push(key);
    }
    for (const key of remove) localStorage.removeItem(key);
  } catch {
    // Best-effort metadata cleanup.
  }
  publish();
}

export function subscribeToOfflineReadiness(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetOfflineReadinessForTests(): void {
  listeners.clear();
}
