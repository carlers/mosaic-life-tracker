import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { CandidateSessionProvider } from '../../supabase-poc/candidateHttpTransport';
import type { CandidateCoreGuard } from '../../supabase-poc/candidateCoreRuntime';
import { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import { fromCandidateTaskRow } from '../../supabase-poc/candidateMapping';
import { CandidateBucketTargetsPendingError, fromCandidateBucketRow } from '../../supabase-poc/candidateBucketMapping';
import { resolveCandidatePersonalCollections } from './supabasePersonalCollections';
import type { AppSupabasePersonalBootstrapOptions } from './supabasePersonalBootstrap';

/** Fresh Supabase namespace only. Never treats consent as historical proof. */
export function createSupabasePersonalAuthority(options: {
  baseUrl: string; publishableKey: string; session: CandidateSessionProvider;
  identity: CandidateIdentity; guard: CandidateCoreGuard; fetcher?: typeof fetch;
}): Pick<AppSupabasePersonalBootstrapOptions, 'guard' | 'verifyBucketLinkTargets'> {
  const { identity } = options;
  async function confirmIndependentAccount() {
    const signed = await options.session.getVerifiedSession();
    if (!signed || signed.userId !== identity.supabaseUserId)
      throw new Error('Personal startup requires the signed owner');
    const response = await (options.fetcher ?? fetch)(new URL('/rest/v1/rpc/mosaic_personal_readiness', options.baseUrl), {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { apikey: options.publishableKey, Authorization: `Bearer ${signed.accessToken}`,
        'Content-Type': 'application/json' }, body: '{}',
    });
    if (!response.ok) throw new Error('Personal release readiness was not confirmed');
    const status = await response.json();
    const current = await options.session.getVerifiedSession();
    if (!current || current.userId !== signed.userId || current.accessToken !== signed.accessToken ||
        current.sessionEpoch !== signed.sessionEpoch || status?.version !== 1 ||
        status.provider !== 'supabase-cloud' || status.providerUserId !== signed.userId ||
        status.mosaicAccountId !== identity.legacyUserId || status.provenance !== 'server-enrolled' ||
        !['fresh', 'recovery-pending'].includes(status.historyState) || status.consentVersion !== 1 ||
        status.personalReady !== true)
      throw new Error('Independent personal account or release evidence is unavailable');
  }
  const writer = createCandidateCreateTransport(options);
  return {
    guard: {
      ...options.guard,
      assertHostedSixDomainRecoveryReady: confirmIndependentAccount,
      // No historical rows are claimed, copied or rewritten. The signed
      // server-enrolled namespace plus explicit consent is the new-data proof.
      assertOriginalOwnerEscrowAndOutboxReady: confirmIndependentAccount,
      async assertPortableSettingsIsolated(owner) {
        if (owner.legacyUserId !== identity.legacyUserId || owner.supabaseUserId !== identity.supabaseUserId)
          throw new Error('Personal account changed');
        const { getDatabase } = await import('../db/database');
        resolveCandidatePersonalCollections(getDatabase(), identity);
      },
    },
    async verifyBucketLinkTargets(doc) {
      if (doc.userId !== identity.legacyUserId) throw new Error('Foreign Bucket link owner');
      const [bucketRow, taskRow] = await Promise.all([
        writer.readBucketMaster(doc.bucketListId, identity), writer.readTaskMaster(doc.taskId, identity),
      ]);
      // Newly created local targets may not have reached the server yet. The
      // replication retry retains the link without acknowledging its push.
      if (!bucketRow || !taskRow) throw new CandidateBucketTargetsPendingError();
      const bucket = fromCandidateBucketRow(bucketRow, identity);
      const task = fromCandidateTaskRow(taskRow, identity);
      return { buckets: new Map([[bucket.id, bucket]]), tasks: new Map([[task.id, task]]) };
    },
  };
}
