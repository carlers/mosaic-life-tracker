export type BackupActivityKind = 'backup' | 'restore';

export interface BackupActivity {
  lastBackupAt: string | null;
  lastRestoreAt: string | null;
}

const STORAGE_PREFIX = 'mosaic_backup_activity:';
const EMPTY_ACTIVITY: BackupActivity = {
  lastBackupAt: null,
  lastRestoreAt: null,
};

function isValidIso(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getBackupActivity(userId?: string | null): BackupActivity {
  if (!userId || typeof window === 'undefined') return { ...EMPTY_ACTIVITY };

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { ...EMPTY_ACTIVITY };
    const parsed = JSON.parse(raw) as Partial<BackupActivity>;
    return {
      lastBackupAt: isValidIso(parsed.lastBackupAt) ? parsed.lastBackupAt : null,
      lastRestoreAt: isValidIso(parsed.lastRestoreAt)
        ? parsed.lastRestoreAt
        : null,
    };
  } catch {
    return { ...EMPTY_ACTIVITY };
  }
}

export function recordBackupActivity(
  userId: string,
  kind: BackupActivityKind,
  completedAt = new Date().toISOString()
): BackupActivity {
  if (!isValidIso(completedAt)) {
    throw new Error('Backup activity timestamp is invalid.');
  }

  const current = getBackupActivity(userId);
  const next: BackupActivity =
    kind === 'backup'
      ? { ...current, lastBackupAt: completedAt }
      : { ...current, lastRestoreAt: completedAt };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // Operational timestamps are convenience metadata only. Backup/restore
      // completion must never fail because localStorage is unavailable.
    }
  }

  return next;
}

export function clearBackupActivity(userId: string): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Best-effort local deletion metadata cleanup.
  }
}
