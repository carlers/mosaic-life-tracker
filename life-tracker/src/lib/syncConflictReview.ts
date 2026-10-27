/** Provider-neutral, current-account review surface. Drafts stay in RxDB. */
export interface SyncConflict {
  domain: import('../../supabase-poc/candidatePersonalRuntime').PersonalDomain;
  documentId: string;
  title: string;
  revision: string | null;
  canKeepLocal: boolean;
  fields: Array<{ label: string; local: string; remote: string }>;
}
export interface SyncConflictActions {
  refresh(conflict: SyncConflict): Promise<void>;
  keepLocal(conflict: SyncConflict): Promise<void>;
}
const EMPTY: readonly SyncConflict[] = [];
let current: {
  ownerId: string; actions: SyncConflictActions; conflicts: readonly SyncConflict[];
} | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function registerSyncConflictReview(ownerId: string, actions: SyncConflictActions) {
  const registration = { ownerId, actions, conflicts: EMPTY };
  current = registration;
  emit();
  return {
    publish(conflicts: readonly SyncConflict[]) {
      if (current !== registration) return;
      registration.conflicts = structuredClone(conflicts);
      emit();
    },
    unregister() {
      if (current !== registration) return;
      current = null;
      emit();
    },
  };
}
export function getSyncConflicts(ownerId: string | undefined): readonly SyncConflict[] {
  return current && current.ownerId === ownerId ? current.conflicts : EMPTY;
}
export function subscribeSyncConflicts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function resolveSyncConflict(
  ownerId: string, conflict: SyncConflict, action: 'refresh' | 'keepLocal',
) {
  const registration = current;
  if (!registration || registration.ownerId !== ownerId ||
      !registration.conflicts.includes(conflict) ||
      (action === 'keepLocal' && (!conflict.canKeepLocal || !conflict.revision)))
    throw new Error('Conflict review changed; reopen the comparison');
  await registration.actions[action](conflict);
  if (current !== registration)
    throw new Error('Conflict account changed during review');
}
