/**
 * #1027: app-owned bridge from independently verified Supabase Auth to
 * Mosaic's actual RxDB tasks/categories. This is callable integration code,
 * The opt-in fresh-account provider invokes it; default AuthProvider owns Appwrite startup.
 *
 * The caller must supply server-enforced mapping, old-Appwrite-client fencing,
 * an exclusive cross-device writer lease, AND a verified in-tab Appwrite stop.
 * There are no permissive defaults: leaving any guard out denies startup.
 */
import { validateCandidateIdentity, type CandidateIdentity } from '../../supabase-poc/candidateMapping';
import {
  createCandidateCoreRuntime,
  type CandidateCoreGuard,
} from '../../supabase-poc/candidateCoreRuntime';
import type {
  CandidateSessionProvider,
  CandidateVerifiedSession,
} from '../../supabase-poc/candidateHttpTransport';

export interface AppSupabaseCoreBootstrapOptions {
  selectedBackend: 'supabase-cloud';
  featureProfile: 'core-only' | 'core-diary';
  baseUrl: string;
  publishableKey: string;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  guard: CandidateCoreGuard;
  /** A real, awaited Appwrite in-tab replication/writer shutdown proof. */
  assertLocalAppwriteStopped(): Promise<void>;
  fetcher?: typeof fetch;
}

type PilotRun = Awaited<ReturnType<ReturnType<typeof createCandidateCoreRuntime>['start']>>;
type BridgePhase = 'idle' | 'starting' | 'active' | 'paused' | 'stopping' | 'blocked';

export function createAppSupabaseCoreBootstrap(options: AppSupabaseCoreBootstrapOptions) {
  if (options.selectedBackend !== 'supabase-cloud' ||
      !['core-only', 'core-diary'].includes(options.featureProfile)) {
    throw new Error('Supabase core bootstrap requires an explicit provider and core-only profile');
  }
  validateCandidateIdentity(options.identity);
  if (typeof options.assertLocalAppwriteStopped !== 'function' ||
      !options.guard || typeof options.guard.verifyLegacyMapping !== 'function' ||
      typeof options.guard.assertAppwriteWritersFenced !== 'function' ||
      typeof options.guard.acquireExclusiveLease !== 'function') {
    throw new Error('Supabase core bootstrap requires local and server writer fences');
  }

  let phase: BridgePhase = 'idle';
  let activeRun: PilotRun | null = null;

  async function checkedSession(): Promise<CandidateVerifiedSession> {
    const session = await options.session.getVerifiedSession();
    if (!session || session.userId !== options.identity.supabaseUserId ||
        !session.accessToken || !Number.isSafeInteger(session.sessionEpoch) ||
        session.sessionEpoch < 0) {
      throw new Error('Supabase core bootstrap requires a matching server-verified account');
    }
    return session;
  }

  async function pause(): Promise<void> {
    if (phase === 'paused') return;
    if (phase !== 'active' || !activeRun)
      throw new Error('Supabase core bootstrap cannot stop an incomplete writer');
    phase = 'stopping';
    const run = activeRun;
    activeRun = null;
    try {
      await run.pause();
      activeRun = run;
      phase = 'paused';
    } catch (error) {
      // Underlying RxDB cancellation may have failed. Never release/reacquire
      // a second authority through this controller after an uncertain stop.
      phase = 'blocked';
      throw error;
    }
  }

  async function stop(): Promise<void> {
    if (phase === 'idle') return;
    await pause();
    const run = activeRun!;
    phase = 'stopping';
    try {
      await run.stop();
      activeRun = null;
      phase = 'idle';
    } catch (error) {
      // Both local writers are already confirmed stopped. Keep the retained
      // lease and allow a signed release retry, never a replacement start.
      phase = 'paused';
      throw error;
    }
  }

  async function start() {
    if (phase !== 'idle') throw new Error('Supabase core bootstrap is already running or blocked');
    phase = 'starting';
    let writerAttempted = false;
    let candidateRun: PilotRun | null = null;
    try {
      const before = await checkedSession();
      // Do not initialize or reuse the app database before the current
      // Appwrite tab's writer has been fully suspended.
      await options.assertLocalAppwriteStopped();
      const { waitForDatabaseReady } = await import('./databaseBootstrap');
      await waitForDatabaseReady();
      const after = await checkedSession();
      if (after.sessionEpoch !== before.sessionEpoch ||
          after.accessToken !== before.accessToken) {
        throw new Error('Supabase core account changed during local database bootstrap');
      }
      // This is the REAL Mosaic multi-instance RxDB, not a parallel pilot DB.
      const { getDatabase } = await import('../db/database');
      const db = getDatabase();
      // A local Appwrite sync may have restarted while the async DB opened.
      await options.assertLocalAppwriteStopped();
      const recent = await checkedSession();
      if (recent.sessionEpoch !== before.sessionEpoch ||
          recent.accessToken !== before.accessToken) {
        throw new Error('Supabase core account changed before writer acquisition');
      }
      const runtime = createCandidateCoreRuntime({
        baseUrl: options.baseUrl,
        publishableKey: options.publishableKey,
        identity: options.identity,
        session: options.session,
        guard: options.guard,
        collections: {
          tasks: db.tasks, categories: db.categories,
          ...(options.featureProfile === 'core-diary' ? { diary: db.diary } : {}),
        },
        selectedBackend: 'supabase',
        featureProfile: options.featureProfile,
        fetcher: options.fetcher,
      });
      writerAttempted = true;
      candidateRun = await runtime.start();
      const final = await checkedSession();
      if (final.sessionEpoch !== before.sessionEpoch ||
          final.accessToken !== before.accessToken) {
        throw new Error('Supabase core account changed while writer started');
      }
      activeRun = candidateRun;
      phase = 'active';
      const established = candidateRun;
      const ensureActive = () => {
        if (phase !== 'active' || activeRun !== established)
          throw new Error('Supabase core writer no longer owns the active session');
      };
      return {
        taskState: established.taskState,
        categoryState: established.categoryState,
        ...('diaryState' in established ? { diaryState: established.diaryState } : {}),
        async awaitInitialReplication() {
          ensureActive();
          await established.awaitInitialReplication();
          ensureActive();
        },
        async verifyLocalReplica(onProgress: (progress: import('./syncStatus').SyncProgress) => void) {
          ensureActive();
          await established.verifyLocalReplica(onProgress);
          ensureActive();
        },
        async resync() {
          ensureActive();
          await established.resync();
          ensureActive();
        },
        getPendingConflicts() {
          ensureActive();
          return established.getPendingConflicts();
        },
        subscribeConflicts(listener: () => void) {
          ensureActive();
          return established.subscribeConflicts(listener);
        },
        async refreshConflict(domain: import('../../supabase-poc/candidatePersonalRuntime').PersonalDomain, id: string) {
          ensureActive();
          if (domain !== 'tasks' && domain !== 'categories' && domain !== 'diary')
            throw new Error('Unsupported core conflict domain');
          const result = await established.refreshConflict(domain, id);
          ensureActive();
          return result;
        },
        async keepLocalConflict(domain: import('../../supabase-poc/candidatePersonalRuntime').PersonalDomain, id: string, revision: string) {
          ensureActive();
          if (domain !== 'tasks' && domain !== 'categories' && domain !== 'diary')
            throw new Error('Unsupported core conflict domain');
          const result = await established.keepLocalConflict(domain, id, revision);
          ensureActive();
          return result;
        },
        stop: async () => {
          if (activeRun !== established) throw new Error('Supabase core writer no longer owns the active session');
          await stop();
        },
        pause: async () => {
          if (activeRun !== established) throw new Error('Supabase core writer no longer owns the active session');
          await pause();
        },
      };
    } catch (error) {
      if (candidateRun && activeRun === null) {
        // Auth validation can fail AFTER a replication runner has started.
        // Stop it before propagating either denial or network uncertainty.
        try {
          await candidateRun.stop();
        } catch {
          phase = 'blocked';
          throw new Error('Supabase core startup cleanup unconfirmed; writer lease retained', { cause: error });
        }
      }
      // A candidate that attempted to acquire a remote lease is never
      // retried by this controller without fresh proofs.
      phase = writerAttempted ? 'blocked' : 'idle';
      throw error;
    }
  }

  return { start, stop, getPhase: () => phase };
}
