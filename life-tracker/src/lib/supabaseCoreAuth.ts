/**
 * #1027 - app-owned signed Supabase core account lifecycle.
 *
 * The opt-in fresh-account SupabaseAuthProvider uses this companion to
 * Mosaic's Appwrite provider. It joins verified GoTrue Auth to the real RxDB core
 * bridge without presenting an untrusted stored owner as logged in.
 *
 * Existing-user provider migration remains gated on source writer cutoff,
 * trusted mapping and verified reverse transfers. The fresh-account adapter
 * may not be used as proof of those migration requirements.
 */
import {
  createCandidateAuthSession,
  CandidateSessionDeniedError,
  type CandidateSessionPersistence,
} from '../../supabase-poc/candidateAuthSession';
import type { CandidateVerifiedSession } from '../../supabase-poc/candidateHttpTransport';
import {
  validateCandidateIdentity,
  type CandidateIdentity,
} from '../../supabase-poc/candidateMapping';
import {
  createAppSupabaseCoreBootstrap,
  type AppSupabaseCoreBootstrapOptions,
} from './supabaseCoreBootstrap';

type SessionManager = ReturnType<typeof createCandidateAuthSession>;
type CoreBootstrap = ReturnType<typeof createAppSupabaseCoreBootstrap>;
type CoreRun = Awaited<ReturnType<CoreBootstrap['start']>>;
type Phase = 'signed-out' | 'authenticating' | 'active' | 'paused' | 'stopping' | 'blocked';

export interface SupabaseCoreAuthOptions extends Omit<
  AppSupabaseCoreBootstrapOptions,
  'identity' | 'session'
> {
  /**
   * Must return a server-verified, canonical Mosaic owner mapping. A decoded
   * JWT, email, localStorage hint or user_metadata is NOT sufficient.
   */
  resolveIdentity(signed: CandidateVerifiedSession): Promise<CandidateIdentity>;
  /**
   * Auth defaults to memory-only. The browser provider injects a session with
   * exclusive Web Lock transactions and durable browser-family fences.
   * Unit and signed-lab tests may inject an explicitly provisioned session.
   */
  session?: SessionManager;
}

interface ActiveOwner {
  identity: CandidateIdentity;
  signed: CandidateVerifiedSession;
  bootstrap: CoreBootstrap;
  run: CoreRun;
}

function sameSession(
  left: CandidateVerifiedSession,
  right: CandidateVerifiedSession | null,
): boolean {
  return Boolean(right &&
    left.userId === right.userId &&
    left.accessToken === right.accessToken &&
    left.sessionEpoch === right.sessionEpoch);
}

export function createSupabaseCoreAuthCoordinator(options: SupabaseCoreAuthOptions) {
  if (options.selectedBackend !== 'supabase-cloud' ||
      !['core-only', 'core-diary'].includes(options.featureProfile))
    throw new Error('Signed Supabase core requires explicit Supabase personal profile selection');
  if (typeof options.resolveIdentity !== 'function')
    throw new Error('Signed Supabase core requires a trusted legacy identity resolver');
  if (typeof options.assertLocalAppwriteStopped !== 'function' ||
      !options.guard ||
      typeof options.guard.verifyLegacyMapping !== 'function' ||
      typeof options.guard.assertAppwriteWritersFenced !== 'function' ||
      typeof options.guard.acquireExclusiveLease !== 'function') {
    throw new Error('Signed Supabase core requires all server and local writer guards');
  }

  // Persistence belongs to the injected browser adapter, never this coordinator.
  const session = options.session ?? createCandidateAuthSession({
    baseUrl: options.baseUrl,
    publishableKey: options.publishableKey,
    fetcher: options.fetcher,
  });
  let phase: Phase = 'signed-out';
  let active: ActiveOwner | null = null;
  let pendingBootstrap: CoreBootstrap | null = null;

  async function verified(signed: CandidateVerifiedSession) {
    const current = await session.getVerifiedSession();
    if (!sameSession(signed, current))
      throw new Error('Supabase core signed account changed during authentication');
  }

  async function activate(signed: CandidateVerifiedSession): Promise<ActiveOwner> {
    await verified(signed);
    const identity = await options.resolveIdentity(signed);
    validateCandidateIdentity(identity);
    if (identity.supabaseUserId !== signed.userId)
      throw new Error('Supabase core server identity mapping has a different signed owner');
    await verified(signed);
    const bootstrap = createAppSupabaseCoreBootstrap({
      selectedBackend: options.selectedBackend,
      featureProfile: options.featureProfile,
      baseUrl: options.baseUrl,
      publishableKey: options.publishableKey,
      fetcher: options.fetcher,
      identity,
      session,
      guard: options.guard,
      assertLocalAppwriteStopped: options.assertLocalAppwriteStopped,
    });
    pendingBootstrap = bootstrap;
    const run = await bootstrap.start();
    try {
      await verified(signed);
    } catch (error) {
      // A late account switch must never leave the acquired writer running.
      try { await run.stop(); }
      catch {
        throw new Error('Supabase core authentication cleanup unconfirmed; writer lease retained', { cause: error });
      }
      throw error;
    }
    pendingBootstrap = null;
    return { signed, identity, bootstrap, run };
  }

  async function clearLocalAuth(): Promise<void> {
    // A failed remote revocation is still a locally cleared session; the
    // underlying session manager must not keep access/refresh tokens active.
    await session.signOut();
  }

  async function startSigned(
    action: () => Promise<CandidateVerifiedSession | null>,
    retainOnOutage = false,
  ) {
    if (phase !== 'signed-out')
      throw new Error('Supabase core session is active, busy or blocked');
    phase = 'authenticating';
    try {
      const signed = await action();
      if (!signed) {
        phase = 'signed-out';
        return null;
      }
      const established = await activate(signed);
      active = established;
      phase = 'active';
      return { ...established.identity };
    } catch (error) {
      const blocked = pendingBootstrap?.getPhase() === 'blocked' ||
        (error instanceof Error && /cleanup unconfirmed|writer lease retained/.test(error.message));
      active = null;
      // A restore outage does not revoke the durable refresh family or its
      // previously verified local-data hint. No writer/remote owner is exposed.
      try {
        if (retainOnOutage && !blocked && !(error instanceof CandidateSessionDeniedError))
          session.discardMemory();
        else await clearLocalAuth();
      }
      catch { /* local Auth cleanup failure is also a hard block */ phase = 'blocked'; throw error; }
      phase = blocked ? 'blocked' : 'signed-out';
      throw error;
    } finally {
      pendingBootstrap = null;
    }
  }

  async function signIn(email: string, password: string) {
    return startSigned(() => session.signIn(email, password));
  }

  async function restore() {
    return startSigned(() => session.restoreFromPersistence(), true);
  }

  /** View teardown stops local writers without signing out other browser tabs.
   * Keep the lease/owner so this lifecycle cannot silently switch accounts. */
  async function suspend() {
    if ((phase !== 'active' && phase !== 'paused') || !active) return;
    const established = active;
    phase = 'stopping';
    try {
      await established.run.pause();
      phase = 'paused';
    } catch (error) {
      phase = 'blocked';
      throw error;
    }
  }

  async function signOut(): Promise<boolean> {
    if (phase === 'blocked')
      throw new Error('Supabase core writer state is uncertain; cannot permit another provider');
    if (phase === 'signed-out') return session.signOut();
    if ((phase !== 'active' && phase !== 'paused') || !active)
      throw new Error('Supabase core account operation already in progress');
    phase = 'stopping';
    const established = active;
    active = null;
    try {
      await established.run.stop();
    } catch (error) {
      phase = 'blocked';
      throw new Error('Supabase core writer stop unconfirmed; account switch blocked', { cause: error });
    }
    try {
      const revoked = await session.signOut();
      // False means remote revocation is uncertain; local credentials were
      // cleared by the candidate manager.
      phase = 'signed-out';
      return revoked;
    } catch (error) {
      // An exception may mean local credential storage could not be cleared.
      phase = 'blocked';
      throw error;
    }
  }

  /**
   * Refresh-token rotation invalidates the previous RxDB session epoch.
   * Stop BOTH writers before refreshing, then re-run trusted identity +
   * Appwrite cutoff + exclusive lease checks before resuming replication.
   * A failed cancellation is never followed by token rotation/reacquisition.
   */
  async function refreshAndRestart() {
    if ((phase !== 'active' && phase !== 'paused') || !active)
      throw new Error('Supabase core refresh requires one active account');
    const previous = active;
    phase = 'stopping';
    try { await previous.run.pause(); }
    catch (error) {
      active = null;
      phase = 'blocked';
      throw new Error('Supabase core writer stop unconfirmed; cannot refresh', { cause: error });
    }
    let signed: CandidateVerifiedSession;
    try {
      signed = await session.refresh();
      if (signed.userId !== previous.identity.supabaseUserId)
        throw new CandidateSessionDeniedError();
      // Rotation has independently verified this SAME owner. The original
      // session's lease can now be released with a valid access token.
      await previous.run.stop();
    } catch (error) {
      if (error instanceof CandidateSessionDeniedError) {
        active = null;
        phase = 'blocked'; // Remote lease release remains unconfirmed.
        await clearLocalAuth();
      } else {
        // A network outage is not revocation. Both writers stay paused,
        // credentials/local drafts remain available for a bounded retry.
        phase = 'paused';
      }
      throw error;
    }
    active = null;
    phase = 'signed-out';
    return startSigned(async () => signed);
  }

  async function verifyLocalReplica(onProgress: (progress: import('./syncStatus').SyncProgress) => void) {
    if (phase !== 'active' || !active)
      throw new Error('Supabase manual verification requires an active signed owner');
    const established = active;
    await verified(established.signed);
    if (phase !== 'active' || active !== established)
      throw new Error('Supabase account switched before verification');
    await established.run.verifyLocalReplica(onProgress);
    if (phase !== 'active' || active !== established)
      throw new Error('Supabase account switched during verification');
    await verified(established.signed);
  }

  async function resync() {
    if (phase !== 'active' || !active)
      throw new Error('Supabase core is not authenticated and active');
    const established = active;
    await verified(established.signed);
    if (active !== established || phase !== 'active')
      throw new Error('Supabase core account changed before resync');
    await established.run.resync();
    if (active !== established || phase !== 'active')
      throw new Error('Supabase core account changed during resync');
  }

  return {
    signIn,
    restore,
    suspend,
    signOut,
    refreshAndRestart,
    resync,
    verifyLocalReplica,
    getPendingConflicts: () => phase === 'active' && active
      ? active.run.getPendingConflicts() : { tasks: [], categories: [] },
    subscribeConflicts(listener: () => void) {
      if (phase !== 'active' || !active) return () => {};
      return active.run.subscribeConflicts(listener);
    },
    async refreshConflict(domain: 'tasks' | 'categories' | 'diary', id: string) {
      if (phase !== 'active' || !active) throw new Error('Core conflict account is not active');
      return active.run.refreshConflict(domain, id);
    },
    async keepLocalConflict(domain: 'tasks' | 'categories' | 'diary', id: string, revision: string) {
      if (phase !== 'active' || !active) throw new Error('Core conflict account is not active');
      return active.run.keepLocalConflict(domain, id, revision);
    },
    getPhase: () => phase,
    getReplicationStates: () => phase === 'active' && active
      ? [active.run.taskState, active.run.categoryState,
          ...('diaryState' in active.run && active.run.diaryState
            ? [active.run.diaryState] : [])] : null,
    /** No access token or Supabase refresh credential escapes this snapshot. */
    getAuthenticatedOwner: () => phase === 'active' && active
      ? { ...active.identity } : null,
  };
}

// The browser adapter owns persistence; this coordinator grants no authority
// from an injected persistence record or cached identity.
export type { CandidateSessionPersistence };
