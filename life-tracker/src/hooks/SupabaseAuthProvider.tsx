import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type MosaicUser } from './authContext';
import type { CoreBackendConfig } from '../lib/coreBackendConfig';
import { createCandidateAuthSession, CandidateSessionUnavailableError } from '../../supabase-poc/candidateAuthSession';
import { CandidateAuthUnavailableError } from '../../supabase-poc/candidateVerifiedAuth';
import { createSupabaseCoreAuthCoordinator } from '../lib/supabaseCoreAuth';
import { createSupabaseCoreAuthority } from '../lib/supabaseCoreAuthority';
import { scopeAccountWork } from '../lib/accountWorkScope';
import { publishSyncStatus, scopeSyncStatusToUser, type SyncProgress } from '../lib/syncStatus';
import { registerCoreSync } from '../lib/appSync';
import { markConnectivityOffline, reportConnectivityResult } from '../lib/connectivity';
import { registerSyncConflictReview } from '../lib/syncConflictReview';
import { presentSupabaseConflicts } from '../lib/supabaseConflictReview';
import { createSupabaseBrowserSession } from '../lib/supabaseBrowserSession';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { markOfflineDataReady } from '../lib/offlineReadiness';
import { startCoreRealtimeWake } from '../lib/supabaseRealtimeWake';
import { MOSAIC_FEATURE_PROFILE } from '../lib/backendCapabilities';
import { registerSupabaseMedia } from '../lib/supabaseMedia';
import { createSupabaseAccountRegistry, SupabaseAccountStartRequiredError,
  type AccountStartMode } from '../lib/supabaseAccountRegistry';
import { AccountStartView } from '../components/auth/AccountStartView';

function reportAuthOutage(error: unknown) {
  if (error instanceof CandidateSessionUnavailableError ||
      error instanceof CandidateAuthUnavailableError || error instanceof TypeError)
    markConnectivityOffline('core-auth-unreachable');
}

function createRuntime(config: Extract<CoreBackendConfig, { driver: 'supabase' }>) {
  let browser: ReturnType<typeof createSupabaseBrowserSession> | null = null;
  let cached: ReturnType<ReturnType<typeof createSupabaseBrowserSession>['getCachedIdentity']> = null;
  // Unsupported/private storage keeps the existing memory-only behavior.
  // Never share a rotating refresh token without a real browser mutex.
  try {
    if (navigator.locks) {
      localStorage.getItem('mosaic_storage_availability');
      browser = createSupabaseBrowserSession({
        ...config, storage: localStorage, randomId: () => crypto.randomUUID(),
        exclusive: (name, operation) => navigator.locks.request(name, operation),
      });
      cached = browser.getCachedIdentity();
    }
  } catch { browser = null; }
  const session = browser?.session ?? createCandidateAuthSession({ ...config, logoutScope: 'local' });
  const authority = createSupabaseCoreAuthority({ ...config, session });
  const registry = createSupabaseAccountRegistry({ ...config, session });
  let pendingIdentity: CandidateIdentity | null = null;
  const coordinator = createSupabaseCoreAuthCoordinator({
    ...config, selectedBackend: 'supabase-cloud',
    featureProfile: MOSAIC_FEATURE_PROFILE === 'core-diary' ? 'core-diary' : 'core-only',
    session, guard: authority.guard,
    async resolveIdentity() {
      const identity = await authority.resolveIdentity();
      const account = await registry.read(identity);
      pendingIdentity = null;
      if (account.historyState === 'unconfirmed') {
        pendingIdentity = { ...identity };
        throw new SupabaseAccountStartRequiredError();
      }
      return identity;
    },
    async assertLocalAppwriteStopped() {
      const { assertAppwriteSyncStoppedForCore } = await import('../db/sync');
      await assertAppwriteSyncStoppedForCore();
    },
  });
  return { session, authority, coordinator, browser, cached, registry,
    getPendingIdentity: () => pendingIdentity ? { ...pendingIdentity } : null };
}

export default function SupabaseAuthProvider({ config, children }: {
  config: Extract<CoreBackendConfig, { driver: 'supabase' }>;
  children: ReactNode;
}) {
  const [runtime] = useState(() => createRuntime(config));
  const [user, setUser] = useState<MosaicUser | null>(() => runtime.cached
    ? { $id: runtime.cached.legacyUserId, email: runtime.cached.email, name: '', prefs: {} } : null);
  const [isOffline, setOffline] = useState(Boolean(runtime.cached));
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<'requested' | null>(null);
  const [needsAccountChoice, setNeedsAccountChoice] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const retrySync = useRef(async () => {});
  const conflictReview = useRef<ReturnType<typeof registerSyncConflictReview> | null>(null);

  const adoptIdentity = useCallback(async (identity: CandidateIdentity, email?: string) => {
    try { await runtime.browser?.rememberIdentity(identity, email); }
    catch (error) {
      await runtime.coordinator.suspend();
      throw error;
    }
    if (!mounted.current) {
      await runtime.coordinator.suspend();
      return false;
    }
    scopeAccountWork(identity.legacyUserId);
    scopeSyncStatusToUser(identity.legacyUserId);
    setUser({ $id: identity.legacyUserId, email: email ?? runtime.browser?.getCachedIdentity()?.email ?? '',
      name: '', prefs: {} });
    setOffline(false);
    reportConnectivityResult();
    return true;
  }, [runtime]);

  const restoreAccount = useCallback(async () => {
    try {
      const identity = await runtime.coordinator.restore();
      if (identity) return await adoptIdentity(identity);
      if (mounted.current) {
        scopeAccountWork(null);
        scopeSyncStatusToUser(null);
        setUser(null);
        setOffline(false);
      }
    } catch (error) {
      if (mounted.current) {
        if (error instanceof SupabaseAccountStartRequiredError) {
          scopeAccountWork(null);
          scopeSyncStatusToUser(null);
          setUser(null);
          setOffline(false);
          setNeedsAccountChoice(true);
          setError(null);
          return false;
        }
        const cache = runtime.browser?.getCachedIdentity();
        if (!cache || runtime.coordinator.getPhase() === 'blocked') {
          scopeAccountWork(null);
          scopeSyncStatusToUser(null);
          setUser(null);
          setOffline(false);
          setError('Session could not be restored. Reload and sign in again. Local changes are retained.');
        } else {
          setOffline(true);
          reportAuthOutage(error);
          publishSyncStatus({ errors: ['Core sync unavailable. Local changes are retained.'] });
        }
      }
    }
    return false;
  }, [runtime, adoptIdentity]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (runtime.cached) {
      scopeAccountWork(runtime.cached.legacyUserId);
      scopeSyncStatusToUser(runtime.cached.legacyUserId);
    }
    // StrictMode's discarded mount must not rotate a durable credential.
    queueMicrotask(() => {
      if (!active || !runtime.browser || busy.current || navigator.onLine === false) return;
      busy.current = true;
      void restoreAccount().finally(() => { busy.current = false; });
    });
    const changed = (event: StorageEvent) => {
      if (event.key !== null && event.key !== runtime.browser?.storageKey) return;
      if (!runtime.browser || runtime.browser.isCurrent()) return;
      scopeAccountWork(null);
      scopeSyncStatusToUser(null);
      setUser(null);
      setOffline(false);
      setError('Account changed in another tab. Reload to continue. Local changes are retained.');
      void runtime.coordinator.suspend().catch(() => {});
    };
    window.addEventListener('storage', changed);
    return () => {
      active = false;
      mounted.current = false;
      window.removeEventListener('storage', changed);
      scopeAccountWork(null);
      scopeSyncStatusToUser(null);
      queueMicrotask(() => {
        if (!mounted.current) void runtime.coordinator.suspend().catch(() => {});
      });
    };
  }, [runtime, restoreAccount]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const restart = async () => {
      await runtime.coordinator.refreshAndRestart();
      if (!mounted.current) {
        await runtime.coordinator.suspend();
        throw new Error('Account closed during review');
      }
      if (active) setSyncGeneration(generation => generation + 1);
    };
    const perform = async (action: () => Promise<void>) => {
      if (busy.current || !active || navigator.onLine === false)
        throw new Error('Reconnect and wait for account recovery before reviewing');
      busy.current = true;
      try {
        if (runtime.coordinator.getPhase() === 'signed-out') {
          await restoreAccount();
          return;
        }
        if (runtime.coordinator.getPhase() === 'paused' ||
            (runtime.session.getExpiresAt() ?? 0) <= Date.now()) {
          await restart();
          throw new Error('Connection renewed. Review the current versions again');
        }
        await action();
      } catch (error) {
        if (active && ['blocked', 'signed-out'].includes(runtime.coordinator.getPhase())) {
          scopeAccountWork(null);
          scopeSyncStatusToUser(null);
          setUser(null);
          setError('Session recovery could not be confirmed. Reload and sign in again. Local changes are retained.');
        }
        throw error;
      } finally { busy.current = false; }
    };
    const registration = registerSyncConflictReview(user.$id, {
      refresh: conflict => perform(async () => {
        const result = await runtime.coordinator.refreshConflict(conflict.domain, conflict.documentId);
        // A parked native batch holds its original snapshot. Restart through
        // the normal guarded lifecycle to rebuild review of newer local edits.
        if (result.state === 'local-changed') await restart();
      }),
      keepLocal: conflict => perform(async () => {
        if (!conflict.revision) throw new Error('A current cloud version is required');
        await runtime.coordinator.keepLocalConflict(conflict.domain, conflict.documentId, conflict.revision);
      }),
    });
    conflictReview.current = registration;
    return () => {
      active = false;
      registration.unregister();
      if (conflictReview.current === registration) conflictReview.current = null;
    };
  }, [runtime, user, restoreAccount]);

  useEffect(() => {
    if (!user || MOSAIC_FEATURE_PROFILE !== 'core-diary') return;
    const identity = runtime.coordinator.getAuthenticatedOwner();
    if (!identity || identity.legacyUserId !== user.$id) return;
    return registerSupabaseMedia({
      identity, baseUrl: config.baseUrl, publishableKey: config.publishableKey,
      getVerifiedSession: () => runtime.session.getVerifiedSession(),
      isCurrent: () => mounted.current && user.$id === identity.legacyUserId &&
        runtime.coordinator.getPhase() === 'active' &&
        runtime.coordinator.getAuthenticatedOwner()?.supabaseUserId === identity.supabaseUserId &&
        (!runtime.browser || runtime.browser.isCurrent()),
    });
  }, [config, runtime, user, syncGeneration]);

  useEffect(() => {
    if (!user) return;
    const ownerId = user.$id;
    let active = true;
    const catchUp = async () => {
      if (busy.current || !active || navigator.onLine === false) return;
      busy.current = true;
      try {
        if (runtime.coordinator.getPhase() === 'signed-out') {
          await restoreAccount();
          return;
        }
        // An expired access JWT can still have a valid refresh credential.
        // Pause local writers and rotate before asking Auth to verify it.
        if (runtime.coordinator.getPhase() === 'paused' ||
            (runtime.session.getExpiresAt() ?? 0) - Date.now() < 120_000) {
          await runtime.coordinator.refreshAndRestart();
          if (!mounted.current) {
            await runtime.coordinator.suspend();
            return;
          }
          if (active) setSyncGeneration(generation => generation + 1);
        }
        if (!await runtime.session.getVerifiedSession()) {
          scopeAccountWork(null);
          scopeSyncStatusToUser(null);
          if (active) setUser(null);
          await runtime.coordinator.signOut();
          throw new Error('Core account authorization was revoked');
        }
        await runtime.authority.renew();
        await runtime.coordinator.resync();
        reportConnectivityResult();
        if (active) setOffline(false);
      } catch (error) {
        // Retain offline local edits. A rejected session never authorizes
        // remote writes; reauthentication is explicit.
        if (active) {
          const phase = runtime.coordinator.getPhase();
          if (phase === 'blocked' || phase === 'signed-out') {
            scopeAccountWork(null);
            scopeSyncStatusToUser(null);
            setUser(null);
            setError('Session recovery could not be confirmed. Reload and sign in again. Local changes are retained.');
          } else if (phase === 'paused') setSyncGeneration(generation => generation + 1);
          reportAuthOutage(error);
          publishSyncStatus({ errors: ['Core sync unavailable. Reconnect or sign in again.'] });
        }
      } finally { busy.current = false; }
    };
    let verifying = false;
    const assertSignedImportOwner = async () => {
      if (!active || !mounted.current || user.$id !== ownerId ||
          (runtime.browser && !runtime.browser.isCurrent()) ||
          runtime.coordinator.getPhase() !== 'active')
        throw new Error('Supabase import requires the active signed owner');
      const signed = await runtime.session.getVerifiedSession();
      const identity = runtime.coordinator.getAuthenticatedOwner();
      if (!signed || !identity ||
          signed.userId !== identity.supabaseUserId ||
          identity.legacyUserId !== ownerId)
        throw new Error('Supabase import owner verification failed');
    };
    const refreshForImport = async () => {
      if (busy.current || navigator.onLine === false)
        throw new Error('Reconnect and finish account synchronization before importing');
      await assertSignedImportOwner();
      await runtime.authority.renew();
      await runtime.coordinator.resync();
      const states = runtime.coordinator.getReplicationStates();
      const expected = MOSAIC_FEATURE_PROFILE === 'core-diary' ? 3 : 2;
      if (!states || states.length !== expected)
        throw new Error('All supported Supabase import domains must be actively replicating');
      await Promise.all(states.map(async state => {
        await state.awaitInitialReplication();
        await state.awaitInSync();
      }));
      await assertSignedImportOwner();
      const pending = runtime.coordinator.getPendingConflicts();
      if (Object.values(pending).some(items => items.length > 0))
        throw new Error('Resolve Supabase sync conflicts before importing');
    };
    const verifyNow = async (onProgress: (progress: SyncProgress) => void) => {
      if (verifying || busy.current || navigator.onLine === false)
        throw new Error('Supabase verification needs a free, online signed session');
      verifying = true;
      publishSyncStatus({ isSyncing: true, errors: [], notice: null, progress: {
        completed: 0, total: MOSAIC_FEATURE_PROFILE === 'core-diary' ? 9 : 6,
        percent: 0, phase: 'refresh', label: 'Refreshing signed Supabase data',
      } });
      try {
        await assertSignedImportOwner();
        await runtime.authority.renew();
        let deadline: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            runtime.coordinator.verifyLocalReplica(progress => {
              if (!active || !verifying) return;
              publishSyncStatus({ isSyncing: true, progress });
              onProgress(progress);
            }),
            new Promise<never>((_, reject) => {
              deadline = setTimeout(() => reject(new Error(
                'Supabase verification timed out; local data was not changed'
              )), 90_000);
            }),
          ]);
        } finally {
          if (deadline) clearTimeout(deadline);
        }
        await assertSignedImportOwner();
        if (!active) throw new Error('Supabase account changed during verification');
        const completedAt = new Date().toISOString();
        if (runtime.browser?.isCurrent()) markOfflineDataReady(ownerId, completedAt);
        publishSyncStatus({ isSyncing: false, progress: null, errors: [],
          notice: null, lastSync: completedAt });
      } catch (error) {
        if (active) publishSyncStatus({ isSyncing: false, progress: null,
          errors: [error instanceof Error ? error.message : 'Supabase verification failed'],
          notice: 'Local data was not overwritten. Review sync errors before trusting a full match.' });
        throw error;
      } finally { verifying = false; }
    };
    const unregister = registerCoreSync(ownerId, catchUp, {
      refresh: refreshForImport,
      assertOwner: assertSignedImportOwner,
      verify: verifyNow,
    });
    retrySync.current = catchUp;
    const states = runtime.coordinator.getReplicationStates();
    let settling: Promise<void> | null = null;
    const recordSettled = () => {
      if (!states || settling || !active || verifying) return;
      settling = Promise.all(states.map(async state => {
        await state.awaitInitialReplication();
        await state.awaitInSync();
      })).then(() => {
        if (active && !verifying && runtime.coordinator.getReplicationStates()?.[0] === states[0]) {
          const completedAt = new Date().toISOString();
          if (runtime.browser?.isCurrent()) markOfflineDataReady(ownerId, completedAt);
          publishSyncStatus({ lastSync: completedAt, errors: [] });
        }
      }).catch(() => {
        if (active) publishSyncStatus({ errors: ['Core sync pending. Local changes are retained.'] });
      }).finally(() => {
        settling = null;
      });
    };
    const activity: boolean[] = Array(states?.length ?? 2).fill(false);
    let conflictCount = 0;
    const unsubscribeConflicts = runtime.coordinator.subscribeConflicts(() => {
      if (!active) return;
      const conflicts = presentSupabaseConflicts(runtime.coordinator.getPendingConflicts());
      conflictCount = conflicts.length;
      conflictReview.current?.publish(conflicts);
      publishSyncStatus({
        isSyncing: (verifying || activity.some(Boolean)) && conflictCount === 0,
        notice: conflictCount ? 'Some changes need your review. Your edits are kept on this device.' : null,
      });
    });
    const subscriptions = states?.flatMap((state, index) => [
      state.active$.subscribe(value => {
        if (!active) return;
        activity[index] = value;
        publishSyncStatus({ isSyncing: (verifying || activity.some(Boolean)) && conflictCount === 0 });
        if (!activity.some(Boolean)) recordSettled();
      }),
      state.error$.subscribe(() => {
        if (active) publishSyncStatus({ errors: ['Core sync pending. Local changes are retained.'] });
      }),
    ]) ?? [];
    // Postgres changes only wake the signed incremental RxDB pull. Never
    // apply event contents directly or subscribe for DELETE (RLS does not
    // restrict postgres_changes DELETE).
    const stopRealtime = startCoreRealtimeWake({
      baseUrl: config.baseUrl,
      publishableKey: config.publishableKey,
      session: runtime.session,
      isActive: () => active && mounted.current &&
        runtime.coordinator.getPhase() === 'active' &&
        (runtime.session.getExpiresAt() ?? 0) - Date.now() >= 120_000 &&
        (!runtime.browser || runtime.browser.isCurrent()),
      onWake: catchUp,
      includeDiary: MOSAIC_FEATURE_PROFILE === 'core-diary',
    });
    const online = () => { void catchUp(); };
    const visible = () => { if (document.visibilityState === 'visible') online(); };
    const timer = window.setInterval(online, 60_000);
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      retrySync.current = async () => {};
      unregister();
      stopRealtime();
      unsubscribeConflicts();
      subscriptions.forEach(subscription => subscription.unsubscribe());
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [config, runtime, user, syncGeneration, restoreAccount]);

  async function login(email: string, password: string): Promise<boolean> {
    if (busy.current || user) return false;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const identity = await runtime.coordinator.signIn(email, password);
      if (!mounted.current) {
        if (identity) await runtime.coordinator.suspend();
        return false;
      }
      if (!identity) return false;
      return await adoptIdentity(identity, email.trim());
    } catch (error) {
      if (mounted.current) {
        if (error instanceof SupabaseAccountStartRequiredError) setNeedsAccountChoice(true);
        else setError('Could not start the core account. Check sign-in and server authority.');
      }
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  async function logout(): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    try {
      await runtime.coordinator.signOut();
      scopeAccountWork(null);
      scopeSyncStatusToUser(null);
      setUser(null);
      setOffline(false);
      setNeedsAccountChoice(false);
      return true;
    } catch {
      setError('Writer shutdown could not be confirmed. Account switch is blocked.');
      return false;
    } finally { busy.current = false; }
  }

  const unsupported = async () => {
    setError('This account operation is not available in the disposable core candidate.');
    return false;
  };
  async function completeAccountChoice(mode: AccountStartMode): Promise<boolean> {
    if (busy.current || runtime.coordinator.getPhase() !== 'awaiting-consent') return false;
    const identity = runtime.getPendingIdentity();
    if (!identity) return false;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      await runtime.registry.read(identity, mode);
      const started = await runtime.coordinator.resumeAfterConsent();
      if (!started || !mounted.current) {
        if (started) await runtime.coordinator.suspend();
        return false;
      }
      const adopted = await adoptIdentity(started);
      if (adopted) setNeedsAccountChoice(false);
      return adopted;
    } catch {
      if (mounted.current) setError('Account start could not be confirmed. Your old data has not been imported. Sign out and try again.');
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  const historyPending = runtime.registry.snapshot()?.historyState === 'recovery-pending';
  const value: AuthContextValue = {
    accountNotice: 'Disposable Supabase core preview. Preferences stay on this device. ' +
      (runtime.browser ? 'Previously signed-in personal data is available offline. ' : 'This browser requires sign-in after reload. ') +
      (historyPending ? 'Earlier Mosaic history is recovery-pending. New edits are separate; keep your old app and backups.' :
        'Old Appwrite history is not linked or imported. Keep any earlier app data and backups.'),
    supportsPasswordRecovery: true,
    isLocalOwnerCurrent: ownerId => mounted.current && user?.$id === ownerId &&
      (!runtime.browser || runtime.browser.isCurrent()),
    user, isLoading, error, isOffline, pendingSignup: null,
    recoveryLoading, recoveryError, recoverySuccess, login, logout,
    async signup(email, password) {
      if (busy.current || user || runtime.coordinator.getPhase() !== 'signed-out') return false;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        await runtime.session.signUp(email, password, window.location.origin + '/auth/confirm');
        setError('If this address can be registered, a confirmation link has been sent. Confirm your email, then sign in.');
      } catch { setError('Account creation could not be completed.'); }
      finally { busy.current = false; setLoading(false); }
      return false;
    },
    async requestPasswordRecovery(email) {
      setRecoveryLoading(true);
      setRecoveryError(null);
      try {
        await runtime.session.requestPasswordRecovery(email, window.location.origin + '/reset-password');
        setRecoverySuccess('requested');
        return true;
      } catch { setRecoveryError('Password recovery is temporarily unavailable.'); return false; }
      finally { setRecoveryLoading(false); }
    },
    completePasswordRecovery: unsupported, deleteAccount: unsupported,
    updateEmail: unsupported, updatePassword: unsupported,
    async retry() { if (user) await retrySync.current(); },
  };
  return <AuthContext.Provider value={value}>{needsAccountChoice
    ? <AccountStartView busy={isLoading} error={error} onContinue={completeAccountChoice} onCancel={logout} />
    : children}</AuthContext.Provider>;
}
