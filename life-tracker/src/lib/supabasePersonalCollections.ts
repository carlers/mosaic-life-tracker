/**
 * #1027 isolated wiring of the actual app RxDB personal collections.
 * Does not start replication, copy local/Appwrite data, or authenticate.
 * The caller must separately provide all five server-backed escrow/owner
 * guards and a current exclusive writer lease to createCandidatePersonalRuntime.
 */
import { CORE_BACKEND } from './coreBackendConfig';
import { validateCandidateIdentity, type CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { CandidatePersonalRuntimeOptions } from '../../supabase-poc/candidatePersonalRuntime';
import type { AppDatabaseCollections } from '../db/database';

export function resolveCandidatePersonalCollections(
  db: AppDatabaseCollections,
  identity: CandidateIdentity,
): CandidatePersonalRuntimeOptions['collections'] {
  validateCandidateIdentity(identity);
  if (CORE_BACKEND.driver !== 'supabase')
    throw new Error('Six-domain personal collections require the isolated Supabase backend');
  const portable = db.portableSettings;
  // A wrong or shared Settings collection is never a safe personal sync target.
  if (!portable || portable === db.settings || portable.name !== 'portableSettings' ||
      db.settings.name !== 'settings' || portable.database !== db.settings.database)
    throw new Error('Personal Settings must use the distinct Supabase-only portable collection');
  const selected = {
    tasks: db.tasks,
    categories: db.categories,
    diary: db.diary,
    portableSettings: portable,
    bucketList: db.bucketList,
    bucketTaskLinks: db.bucketTaskLinks,
  };
  if (new Set(Object.values(selected)).size !== 6)
    throw new Error('Six-domain owner collections must be distinct');
  return selected;
}
