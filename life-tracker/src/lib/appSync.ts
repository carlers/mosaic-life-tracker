import { CORE_BACKEND } from './coreBackendConfig';

let core: { ownerId: string; resync: () => Promise<void> } | null = null;

export function registerCoreSync(ownerId: string, resync: () => Promise<void>) {
  const registration = { ownerId, resync };
  core = registration;
  return () => { if (core === registration) core = null; };
}

export async function requestAppSync(ownerId: string, manual = false): Promise<void> {
  if (CORE_BACKEND.driver === 'supabase') {
    if (!core || core.ownerId !== ownerId) throw new Error('Core sync is not active for this account');
    await core.resync();
    return;
  }
  const sync = await import('../db/sync');
  if (manual) await sync.syncNow(ownerId);
  else await sync.forceSync(ownerId);
}
