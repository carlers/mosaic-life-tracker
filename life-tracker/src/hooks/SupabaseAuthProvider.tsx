import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext, type AuthContextValue, type MosaicUser } from './authContext';
import type { CoreBackendConfig } from '../lib/coreBackendConfig';
import { createCandidateAuthSession } from '../../supabase-poc/candidateAuthSession';
import { createSupabaseCoreAuthCoordinator } from '../lib/supabaseCoreAuth';
import { createSupabaseCoreAuthority } from '../lib/supabaseCoreAuthority';
import { scopeAccountWork } from '../lib/accountWorkScope';
import { publishSyncStatus, scopeSyncStatusToUser } from '../lib/syncStatus';
import { registerCoreSync } from '../lib/appSync';
import { reportConnectivityResult } from '../lib/connectivity';

function createRuntime(config: Extract<CoreBackendConfig, { driver: 'supabase' }>) {
  // Memory-only credentials in this first disposable-account slice: no shared
  // refresh token can race across tabs. Reload requires fresh authentication.
  const session = createCandidateAuthSession(config);
  const authority = createSupabaseCoreAuthority({ ...config, session });
  const coordinator = createSupabaseCoreAuthCoordinator({
    ...config, selectedBackend: 'supabase-cloud', featureProfile: 'core-only',
    session, guard: authority.guard, resolveIdentity: authority.resolveIdentity,
    async assertLocalAppwriteStopped() {
      const { assertAppwriteSyncStoppedForCore } = await import('../db/sync');
      await assertAppwriteSyncStoppedForCore();
    },
  });
  return { session, authority, coordinator };
}

export default function SupabaseAuthProvider({ config, children }: {
  config: Extract<CoreBackendConfig, { driver: 'supabase' }>;
  children: ReactNode;
}) {
  const [runtime] = useState(() => createRuntime(config));
  const [user, setUser] = useState<MosaicUser | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<'requested' | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scopeAccountWork(null);
      scopeSyncStatusToUser(null);
      if (runtime.coordinator.getPhase() === 'active')
        void runtime.coordinator.signOut().catch(() => {});
    };
  }, [runtime]);

  useEffect(() => {
    if (!user) return;
    const ownerId = user.$id;
    let active = true;
    const catchUp = async () => {
      if (busy.current || !active || navigator.onLine === false) return;
      busy.current = true;
      try {
        if (!await runtime.session.getVerifiedSession()) {
          scopeAccountWork(null);
          scopeSyncStatusToUser(null);
          if (active) setUser(null);
          await runtime.coordinator.signOut();
          throw new Error('Core account authorization was revoked');
        }
        if ((runtime.session.getExpiresAt() ?? 0) - Date.now() < 120_000) {
          await runtime.coordinator.refreshAndRestart();
          if (active) setSyncGeneration(generation => generation + 1);
        }
        await runtime.authority.renew();
        await runtime.coordinator.resync();
        reportConnectivityResult();
      } catch {
        // Retain offline local edits. A rejected session never authorizes
        // remote writes; reauthentication is explicit.
        if (active) publishSyncStatus({ errors: ['Core sync unavailable. Reconnect or sign in again.'] });
      } finally { busy.current = false; }
    };
    const unregister = registerCoreSync(ownerId, catchUp);
    const states = runtime.coordinator.getReplicationStates();
    if (states) {
      void Promise.all(states.map(async state => {
        await state.awaitInitialReplication();
        await state.awaitInSync();
      })).then(() => {
        if (active) publishSyncStatus({ lastSync: new Date().toISOString(), errors: [] });
      }).catch(() => {
        if (active) publishSyncStatus({ errors: ['Core sync pending. Local changes are retained.'] });
      });
    }
    const activity = [false, false];
    const subscriptions = states?.flatMap((state, index) => [
      state.active$.subscribe(value => {
        if (!active) return;
        activity[index] = value;
        publishSyncStatus({ isSyncing: activity.some(Boolean) });
      }),
      state.error$.subscribe(() => {
        if (active) publishSyncStatus({ errors: ['Core sync pending. Local changes are retained.'] });
      }),
    ]) ?? [];
    const online = () => { void catchUp(); };
    const visible = () => { if (document.visibilityState === 'visible') online(); };
    const timer = window.setInterval(online, 60_000);
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      unregister();
      subscriptions.forEach(subscription => subscription.unsubscribe());
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', online);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [runtime, user, syncGeneration]);

  async function login(email: string, password: string): Promise<boolean> {
    if (busy.current || user) return false;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const identity = await runtime.coordinator.signIn(email, password);
      if (!mounted.current) {
        if (identity) await runtime.coordinator.signOut();
        return false;
      }
      if (!identity) return false;
      scopeAccountWork(identity.legacyUserId);
      scopeSyncStatusToUser(identity.legacyUserId);
      setUser({ $id: identity.legacyUserId, email: email.trim(), name: '', prefs: {} });
      reportConnectivityResult();
      return true;
    } catch {
      if (mounted.current) setError('Could not start the core account. Check sign-in and server authority.');
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
  const value: AuthContextValue = {
    accountNotice: 'Disposable Supabase core preview. Use a new test account. Preferences stay on this device; reload requires sign-in. Existing-account migration and password recovery are not available yet.',
    supportsPasswordRecovery: false,
    user, isLoading, error, isOffline: false, pendingSignup: null,
    recoveryLoading, recoveryError, recoverySuccess, login, logout,
    async signup(email, password) {
      if (busy.current || user || runtime.coordinator.getPhase() !== 'signed-out') return false;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        await runtime.session.signUp(email, password);
        setError('Account created. Confirm your email if required, then sign in.');
      } catch { setError('Account creation could not be completed.'); }
      finally { busy.current = false; setLoading(false); }
      return false;
    },
    async requestPasswordRecovery(email) {
      setRecoveryLoading(true);
      setRecoveryError(null);
      try {
        await runtime.session.requestPasswordRecovery(email);
        setRecoverySuccess('requested');
        return true;
      } catch { setRecoveryError('Password recovery is temporarily unavailable.'); return false; }
      finally { setRecoveryLoading(false); }
    },
    completePasswordRecovery: unsupported, deleteAccount: unsupported,
    updateEmail: unsupported, updatePassword: unsupported,
    async retry() { if (user) await runtime.coordinator.resync(); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
