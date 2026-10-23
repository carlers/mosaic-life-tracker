import type { SyncProgress, SyncStatus } from './syncStatus';
import { CORE_BACKEND } from './coreBackendConfig';

type CoreRegistration = {
  ownerId: string;
  resync: () => Promise<void>;
  /** Independently verifies signed owner and waits for actual RxDB convergence. */
  refresh?: () => Promise<void>;
  assertOwner?: () => Promise<void>;
  verify?: (onProgress: (progress: SyncProgress) => void) => Promise<void>;
};
let core: CoreRegistration | null = null;

export function registerCoreSync(
  ownerId: string,
  resync: () => Promise<void>,
  checked?: Pick<CoreRegistration, 'refresh' | 'assertOwner' | 'verify'>
) {
  const registration = { ownerId, resync, ...checked };
  core = registration;
  return () => { if (core === registration) core = null; };
}

export async function requestAppSync(ownerId: string, manual = false): Promise<void> {
  if (CORE_BACKEND.driver === 'supabase') {
    if (!core || core.ownerId !== ownerId) throw new Error('Core sync is not active for this account');
    if (manual) {
      if (!core.verify) throw new Error('Manual Supabase verification is unavailable');
      await core.verify(() => {});
    } else {
      await core.resync();
    }
    return;
  }
  const sync = await import('../db/sync');
  if (manual) await sync.syncNow(ownerId);
  else await sync.forceSync(ownerId);
}

/** Never infer a Supabase session from legacy PWA credentials or a local hint. */
export async function assertPersonalImportOwner(ownerId: string): Promise<void> {
  if (CORE_BACKEND.driver === 'supabase') {
    const active = core;
    if (!active || active.ownerId !== ownerId || !active.assertOwner)
      throw new Error('Supabase import requires a currently verified signed account');
    await active.assertOwner();
    if (core !== active) throw new Error('Signed account changed during import');
    return;
  }
  const { getCurrentUserId } = await import('./storage');
  if (await getCurrentUserId() !== ownerId)
    throw new Error('Restore stopped because the signed-in account changed.');
}

/**
 * Provider-specific pre/post restore freshness barrier. Supabase mode may never
 * call Appwrite refreshSync or return from a mere fire-and-forget resync.
 */
export async function refreshPersonalImport(
  ownerId: string,
  timeoutMs?: number,
  options?: { onProgress?: (progress: SyncProgress) => void }
): Promise<{ status: SyncStatus; startedAt: number }> {
  if (CORE_BACKEND.driver !== 'supabase') {
    const { refreshSync } = await import('../db/sync');
    return refreshSync(ownerId, timeoutMs, options);
  }
  const active = core;
  if (!active || active.ownerId !== ownerId || !active.refresh || !active.assertOwner)
    throw new Error('Supabase import requires an active verified sync session');
  const startedAt = Date.now();
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new Error('Reconnect before importing to Supabase');
  options?.onProgress?.({ completed: 0, total: 2, percent: 0, label: 'Checking signed Supabase data' });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await active.assertOwner!();
        await active.refresh!();
        await active.assertOwner!();
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Supabase import freshness check timed out')), timeoutMs ?? 90_000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (core !== active) throw new Error('Signed account changed during import');
  const status: SyncStatus = {
    isSyncing: false, lastSync: new Date().toISOString(), errors: [],
  };
  options?.onProgress?.({ completed: 2, total: 2, percent: 1, label: 'Signed Supabase data verified' });
  return { status, startedAt };
}
