/**
 * #1027 six-domain APP collection bridge — preparatory, NOT app-startup wired.
 * No feature flag enables this module. Original owner escrow, offline-outbox
 * preservation, signed backend lease, historical Appwrite writer fencing and
 * private Bucket target verification are required by the candidate runner.
 */
import { validateCandidateIdentity, type CandidateIdentity } from '../../supabase-poc/candidateMapping';
import {
  createCandidatePersonalRuntime, type CandidatePersonalGuard,
  type CandidatePersonalRuntimeOptions,
} from '../../supabase-poc/candidatePersonalRuntime';
import type { CandidateSessionProvider, CandidateVerifiedSession } from '../../supabase-poc/candidateHttpTransport';
import type { SyncProgress } from './syncStatus';
import { resolveCandidatePersonalCollections } from './supabasePersonalCollections';

export interface AppSupabasePersonalBootstrapOptions {
  selectedBackend: 'supabase-cloud';
  featureProfile: 'personal-review-only';
  baseUrl: string;
  publishableKey: string;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  guard: CandidatePersonalGuard;
  /** Proof that the *current tab* no longer owns an Appwrite sync writer. */
  assertLocalAppwriteStopped(): Promise<void>;
  /** Must verify BOTH owner-private remote referenced rows, not just local IDs. */
  verifyBucketLinkTargets: CandidatePersonalRuntimeOptions['verifyBucketLinkTargets'];
  fetcher?: typeof fetch;
}

type PersonalRun = Awaited<ReturnType<ReturnType<typeof createCandidatePersonalRuntime>['start']>>;
type BridgePhase = 'idle' | 'starting' | 'active' | 'paused' | 'stopping' | 'blocked';

export function createAppSupabasePersonalBootstrap(options: AppSupabasePersonalBootstrapOptions) {
  if (!options || options.selectedBackend !== 'supabase-cloud' ||
      options.featureProfile !== 'personal-review-only')
    throw new Error('Six-domain app bootstrap requires explicit Supabase personal review profile');
  validateCandidateIdentity(options.identity);
  if (!options.session || typeof options.session.getVerifiedSession !== 'function' ||
      typeof options.assertLocalAppwriteStopped !== 'function' ||
      typeof options.verifyBucketLinkTargets !== 'function' ||
      !options.guard ||
      !['verifyLegacyMapping','assertAppwriteWritersFenced','acquireExclusiveLease',
        'assertHostedSixDomainRecoveryReady','assertOriginalOwnerEscrowAndOutboxReady',
        'assertPortableSettingsIsolated'].every(
        name => typeof options.guard[name as keyof CandidatePersonalGuard] === 'function'
      ))
    throw new Error('Six-domain app bootstrap requires all signed owner and writer fences');

  let phase: BridgePhase = 'idle';
  let activeRun: PersonalRun | null = null;

  async function checkedSession(): Promise<CandidateVerifiedSession> {
    const current = await options.session.getVerifiedSession();
    if (!current || current.userId !== options.identity.supabaseUserId ||
        !current.accessToken || !Number.isSafeInteger(current.sessionEpoch) ||
        current.sessionEpoch < 0)
      throw new Error('Six-domain app bootstrap requires a matching verified owner');
    return current;
  }
  const unchanged = (a: CandidateVerifiedSession, b: CandidateVerifiedSession) =>
    a.userId === b.userId && a.accessToken === b.accessToken &&
    a.sessionEpoch === b.sessionEpoch;

  async function pause(): Promise<void> {
    if (phase === 'paused') return;
    if (phase !== 'active' || !activeRun)
      throw new Error('Six-domain app writer is not safely active');
    phase = 'stopping';
    try {
      await activeRun.pause();
      phase = 'paused';
    } catch (error) {
      phase = 'blocked';
      throw error; // Never release/reacquire a lease after uncertain local stop.
    }
  }
  async function stop(): Promise<void> {
    if (phase === 'idle') return;
    if (phase === 'active') await pause();
    if (phase !== 'paused' || !activeRun)
      throw new Error('Six-domain app cannot release an unconfirmed writer');
    const run = activeRun;
    phase = 'stopping';
    try {
      await run.stop(); // Only candidate runtime can release its signed lease.
      activeRun = null;
      phase = 'idle';
    } catch (error) {
      phase = 'paused'; // Keep ownership for same-run release retry.
      throw error;
    }
  }
  async function start() {
    if (phase !== 'idle')
      throw new Error('Six-domain app bootstrap already running or blocked');
    phase = 'starting';
    let writerAttempted = false;
    let candidateRun: PersonalRun | null = null;
    try {
      const first = await checkedSession();
      // No database access or account copying until local Appwrite is stopped.
      await options.assertLocalAppwriteStopped();
      const { waitForDatabaseReady } = await import('./databaseBootstrap');
      await waitForDatabaseReady();
      if (!unchanged(first, await checkedSession()))
        throw new Error('Six-domain owner changed while opening local database');
      const { getDatabase } = await import('../db/database');
      const db = getDatabase();
      // Do not accept a stale stop proof across the awaited RxDB opening.
      await options.assertLocalAppwriteStopped();
      if (!unchanged(first, await checkedSession()))
        throw new Error('Six-domain owner changed before writer acquisition');
      // Reject legacy shared profile/social Settings and cross-database aliases.
      const collections = resolveCandidatePersonalCollections(db, options.identity);
      if (!unchanged(first, await checkedSession()))
        throw new Error('Six-domain owner changed while resolving collections');
      const runtime = createCandidatePersonalRuntime({
        selectedBackend: 'supabase',
        featureProfile: 'personal-review-only',
        baseUrl: options.baseUrl,
        publishableKey: options.publishableKey,
        identity: options.identity,
        session: options.session,
        guard: options.guard,
        collections,
        verifyBucketLinkTargets: options.verifyBucketLinkTargets,
        fetcher: options.fetcher,
      });
      writerAttempted = true;
      candidateRun = await runtime.start();
      if (!unchanged(first, await checkedSession()))
        throw new Error('Six-domain owner changed while starting remote writer');
      activeRun = candidateRun;
      phase = 'active';
      const established = candidateRun;
      const assertActive = () => {
        if (phase !== 'active' || activeRun !== established)
          throw new Error('Six-domain app writer no longer owns active session');
      };
      return {
        async awaitInitialReplication() {
          assertActive();
          await established.awaitInitialReplication();
          assertActive();
        },
        async resync() {
          assertActive();
          await established.resync();
          assertActive();
        },
        async verifyLocalReplica(onProgress: (p: SyncProgress) => void) {
          assertActive();
          await established.verifyLocalReplica(onProgress);
          assertActive();
        },
        getPendingConflictCounts() {
          assertActive();
          return established.getPendingConflictCounts();
        },
        async pause() {
          assertActive();
          await pause();
        },
        async stop() {
          if (activeRun !== established)
            throw new Error('Six-domain app writer no longer owns active session');
          await stop();
        },
      };
    } catch (error) {
      if (candidateRun && !activeRun) {
        try { await candidateRun.stop(); }
        catch {
          phase = 'blocked';
          throw new Error('Six-domain startup cleanup unconfirmed; writer lease retained', { cause: error });
        }
      }
      // An attempted lease must never be silently retried without new proofs.
      phase = writerAttempted ? 'blocked' : 'idle';
      throw error;
    }
  }
  return { start, stop, getPhase: () => phase };
}
