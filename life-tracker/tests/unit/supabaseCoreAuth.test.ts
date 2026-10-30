import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseCoreAuthCoordinator } from '../../src/lib/supabaseCoreAuth';
import { CandidateSessionDeniedError } from '../../supabase-poc/candidateAuthSession';
import { SupabaseAccountStartRequiredError } from '../../src/lib/supabaseAccountRegistry';
import { SupabasePersonalReleasePendingError } from '../../src/lib/supabasePersonalAuthority';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  personalBootstrap: vi.fn(),
}));
vi.mock('../../src/lib/supabaseCoreBootstrap', () => ({
  createAppSupabaseCoreBootstrap: mocks.bootstrap,
}));
vi.mock('../../src/lib/supabasePersonalBootstrap', () => ({
  createAppSupabasePersonalBootstrap: mocks.personalBootstrap,
}));

type Signed = { userId: string; accessToken: string; sessionEpoch: number };
const original = (): Signed => ({
  userId: OWNER, accessToken: 'signed-owner-token-a', sessionEpoch: 11,
});

function fixture() {
  let signed: Signed | null = null;
  let phase: 'idle' | 'active' | 'blocked' = 'idle';
  const run = {
    taskState: {},
    categoryState: {},
    awaitInitialReplication: vi.fn(async () => {}),
    resync: vi.fn(async () => {}),
    verifyLocalReplica: vi.fn(async () => {}),
    getPendingConflicts: vi.fn(() => ({ tasks: [], categories: [] })),
    stop: vi.fn(async () => { phase = 'idle'; }),
    pause: vi.fn(async () => {}),
  };
  const bridge = {
    start: vi.fn(async () => { phase = 'active'; return run; }),
    stop: vi.fn(async () => { await run.stop(); }),
    getPhase: vi.fn(() => phase),
  };
  mocks.bootstrap.mockReturnValue(bridge);
  const session = {
    signIn: vi.fn(async () => { signed = original(); return signed; }),
    restoreFromPersistence: vi.fn(async (): Promise<Signed | null> => {
      signed = original();
      return signed;
    }),
    refresh: vi.fn(async () => {
      if (!signed) throw Error('No stored Auth session');
      signed = { ...signed, sessionEpoch: signed.sessionEpoch + 1, accessToken: 'rotated-owner-token-b' };
      return signed;
    }),
    signOut: vi.fn(async () => { signed = null; return true; }),
    discardMemory: vi.fn(() => { signed = null; }),
    getVerifiedSession: vi.fn(async () => signed),
  };
  const identity = { legacyUserId: 'mosaic_existing_owner', supabaseUserId: OWNER };
  const guard = {
    verifyLegacyMapping: vi.fn(async () => {}),
    assertAppwriteWritersFenced: vi.fn(async () => {}),
    acquireExclusiveLease: vi.fn(async () => ({ isCurrent: () => true, release: vi.fn(async () => {}) })),
  };
  const resolveIdentity = vi.fn(async () => identity);
  const assertLocalAppwriteStopped = vi.fn(async () => {});
  const options = {
    selectedBackend: 'supabase-cloud' as const,
    featureProfile: 'core-only' as const,
    baseUrl: 'https://isolated.test.supabase.co',
    publishableKey: 'sb_publishable_synthetic_only',
    guard,
    resolveIdentity,
    assertLocalAppwriteStopped,
    session: session as never,
  };
  const coordinator = createSupabaseCoreAuthCoordinator(options);
  return {
    coordinator, options, session, bridge, run, guard, identity, resolveIdentity,
    setOwner(id: string) {
      if (!signed) throw Error('Missing synthetic Auth');
      signed = { ...signed, userId: id };
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('app-owned signed Supabase core Auth+RxDB lifecycle (#1027)', () => {
  it('routes all six personal replication states through Auth, refresh and logout', async () => {
    const f=fixture();
    const states=Array.from({length:6},()=>({}));
    Object.assign(f.run,{replicationStates:states});
    mocks.personalBootstrap.mockReturnValue(f.bridge);
    const personal=vi.fn(async()=>({guard:f.guard,verifyBucketLinkTargets:vi.fn()}) as never);
    const coordinator=createSupabaseCoreAuthCoordinator({...f.options,featureProfile:'personal',personal});
    await coordinator.signIn('independent@example.org','independent password');
    expect(personal).toHaveBeenCalledWith(f.identity);
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(coordinator.getReplicationStates()).toEqual(states);
    await coordinator.refreshAndRestart();
    expect(f.run.pause).toHaveBeenCalledOnce();
    expect(personal).toHaveBeenCalledTimes(2);
    await coordinator.signOut();
    expect(coordinator.getReplicationStates()).toBeNull();
  });
  it('waits for explicit account consent without exposing an owner or starting any writer', async () => {
    const f = fixture();
    f.resolveIdentity.mockRejectedValueOnce(new SupabaseAccountStartRequiredError());
    await expect(f.coordinator.signIn('new@example.org', 'separate password')).rejects.toThrow('Choose how');
    expect(f.coordinator.getPhase()).toBe('awaiting-consent');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(await f.coordinator.resumeAfterConsent()).toEqual(f.identity);
    expect(f.resolveIdentity).toHaveBeenCalledTimes(2);
    expect(f.bridge.start).toHaveBeenCalledOnce();
  });

  it('clears prerelease Auth without a writer while keeping signout possible', async () => {
    const f = fixture();
    mocks.personalBootstrap.mockReturnValue(f.bridge);
    f.resolveIdentity.mockRejectedValueOnce(new SupabaseAccountStartRequiredError());
    const personal = vi.fn(async () => ({guard:f.guard,verifyBucketLinkTargets:vi.fn()} as never));
    const coordinator = createSupabaseCoreAuthCoordinator({...f.options,featureProfile:'personal',personal});
    await expect(coordinator.signIn('test@example.org','password')).rejects.toThrow('Choose how');
    expect(coordinator.getPhase()).toBe('awaiting-consent');
    f.bridge.start.mockRejectedValueOnce(new SupabasePersonalReleasePendingError());
    await expect(coordinator.resumeAfterConsent()).rejects.toBeInstanceOf(SupabasePersonalReleasePendingError);
    expect(coordinator.getPhase()).toBe('signed-out');
    expect(f.session.signOut).toHaveBeenCalledOnce();
    expect(coordinator.getAuthenticatedOwner()).toBeNull();
    expect(await coordinator.signOut()).toBe(true);
  });

  it('cancels an unconsented session without ever starting replication', async () => {
    const f = fixture();
    f.resolveIdentity.mockRejectedValue(new SupabaseAccountStartRequiredError());
    await expect(f.coordinator.restore()).rejects.toThrow('Choose how');
    expect(await f.coordinator.signOut()).toBe(true);
    expect(f.coordinator.getPhase()).toBe('signed-out');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    await expect(f.coordinator.resumeAfterConsent()).rejects.toThrow('No pending');
  });
  it('stays passive and publishes no cached owner until signed Auth and trusted mapping succeed', async () => {
    const f = fixture();
    expect(f.coordinator.getPhase()).toBe('signed-out');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(await f.coordinator.signIn('owner@example.test', 'password')).toEqual(f.identity);
    expect(f.resolveIdentity).toHaveBeenCalledWith(original());
    expect(mocks.bootstrap).toHaveBeenCalledWith(expect.objectContaining({
      selectedBackend: 'supabase-cloud',
      featureProfile: 'core-only',
      identity: f.identity,
      session: f.session,
      guard: f.guard,
      assertLocalAppwriteStopped: f.options.assertLocalAppwriteStopped,
    }));
    expect(f.coordinator.getPhase()).toBe('active');
    expect(f.coordinator.getAuthenticatedOwner()).toEqual(f.identity);
    expect(f.coordinator.getAuthenticatedOwner()).not.toHaveProperty('accessToken');
    await f.coordinator.resync();
    await f.coordinator.verifyLocalReplica(() => {});
    expect(f.run.resync).toHaveBeenCalledOnce();
    expect(f.run.verifyLocalReplica).toHaveBeenCalledOnce();
  });

  it('restores only after signed refresh verifies the same owner, never from local hints', async () => {
    const f = fixture();
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(await f.coordinator.restore()).toEqual(f.identity);
    expect(f.session.restoreFromPersistence).toHaveBeenCalledOnce();
    expect(f.coordinator.getAuthenticatedOwner()).toEqual(f.identity);
  });

  it('returns no account when restore finds no credential; never launches a writer', async () => {
    const f = fixture();
    f.session.restoreFromPersistence.mockResolvedValueOnce(null);
    expect(await f.coordinator.restore()).toBeNull();
    expect(f.coordinator.getPhase()).toBe('signed-out');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
  });

  it('retains durable credentials on restore outage without exposing remote authority', async () => {
    const f = fixture();
    f.session.restoreFromPersistence.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(f.coordinator.restore()).rejects.toThrow('network unavailable');
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(f.session.discardMemory).toHaveBeenCalledOnce();
    expect(f.coordinator.getPhase()).toBe('signed-out');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(await f.coordinator.restore()).toEqual(f.identity);
  });

  it('suspends a view without logging out other tabs or permitting a new account', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'password');
    await f.coordinator.suspend();
    expect(f.run.pause).toHaveBeenCalledOnce();
    expect(f.run.stop).not.toHaveBeenCalled();
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(f.coordinator.getPhase()).toBe('paused');
    await expect(f.coordinator.signIn('other@example.test', 'password')).rejects.toThrow();
  });

  it('refuses missing/mismatched legacy mapping and clears session before data access', async () => {
    const f = fixture();
    f.resolveIdentity.mockResolvedValueOnce({ ...f.identity, supabaseUserId: OTHER });
    await expect(f.coordinator.signIn('owner@example.test', 'pass'))
      .rejects.toThrow('different signed owner');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(f.session.signOut).toHaveBeenCalledOnce();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(f.coordinator.getPhase()).toBe('signed-out');
  });

  it('fences delayed mapping after the verified server owner switches', async () => {
    const f = fixture();
    f.resolveIdentity.mockImplementationOnce(async () => {
      f.setOwner(OTHER);
      return f.identity;
    });
    await expect(f.coordinator.signIn('owner@example.test', 'pass'))
      .rejects.toThrow('signed account changed');
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
  });

  it('does not acknowledge a stale authentication after remote writer starts', async () => {
    const f = fixture();
    f.bridge.start.mockImplementationOnce(async () => {
      f.setOwner(OTHER);
      return f.run;
    });
    await expect(f.coordinator.signIn('owner@example.test', 'pass'))
      .rejects.toThrow('signed account changed');
    expect(f.run.stop).toHaveBeenCalledOnce();
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(f.coordinator.getPhase()).toBe('signed-out');
  });

  it('blocks all future authentication if a started writer cannot be stopped', async () => {
    const f = fixture();
    f.bridge.start.mockImplementationOnce(async () => {
      f.setOwner(OTHER);
      return f.run;
    });
    f.run.stop.mockRejectedValueOnce(Error('replicator cannot cancel'));
    await expect(f.coordinator.signIn('owner@example.test', 'pass'))
      .rejects.toThrow('cleanup unconfirmed');
    expect(f.coordinator.getPhase()).toBe('blocked');
    await expect(f.coordinator.signIn('another@example.test', 'pass'))
      .rejects.toThrow('busy or blocked');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
  });

  it('stops all cloud writers before revoking an account and rejects overlapping logins', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    await expect(f.coordinator.signIn('another@example.test', 'pass'))
      .rejects.toThrow('busy or blocked');
    f.session.signOut.mockImplementationOnce(async () => {
      expect(f.run.stop).toHaveBeenCalledOnce();
      return false; // Remote logout unconfirmed; local tokens still cleared by real Auth
    });
    expect(await f.coordinator.signOut()).toBe(false);
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(f.coordinator.getPhase()).toBe('signed-out');
  });

  it('blocks account switching if an active writer cannot be stopped', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    f.run.stop.mockRejectedValueOnce(Error('unconfirmed cancellation'));
    await expect(f.coordinator.signOut()).rejects.toThrow('account switch blocked');
    expect(f.coordinator.getPhase()).toBe('blocked');
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
  });

  it('rotates Auth only after stopping the previous writer and reacquires all mapping/lease gates', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    expect(await f.coordinator.refreshAndRestart()).toEqual(f.identity);
    expect(f.run.stop).toHaveBeenCalledOnce();
    expect(f.run.pause.mock.invocationCallOrder[0]).toBeLessThan(f.session.refresh.mock.invocationCallOrder[0]);
    expect(f.session.refresh.mock.invocationCallOrder[0]).toBeLessThan(f.run.stop.mock.invocationCallOrder[0]);
    expect(f.session.refresh).toHaveBeenCalledOnce();
    expect(f.resolveIdentity).toHaveBeenCalledTimes(2);
    expect(mocks.bootstrap).toHaveBeenCalledTimes(2);
    expect(f.coordinator.getAuthenticatedOwner()).toEqual(f.identity);
  });

  it('does not refresh or reacquire if the previous replication cannot stop', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    f.run.pause.mockRejectedValueOnce(Error('unconfirmed stop'));
    await expect(f.coordinator.refreshAndRestart()).rejects.toThrow('cannot refresh');
    expect(f.session.refresh).not.toHaveBeenCalled();
    expect(f.coordinator.getPhase()).toBe('blocked');
  });

  it('keeps credentials and paused drafts through an outage, then re-verifies and restarts', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    f.session.refresh.mockRejectedValueOnce(Error('temporary outage'));
    await expect(f.coordinator.refreshAndRestart()).rejects.toThrow('outage');
    expect(f.coordinator.getPhase()).toBe('paused');
    expect(f.session.signOut).not.toHaveBeenCalled();
    expect(f.run.stop).not.toHaveBeenCalled();
    await expect(f.coordinator.resync()).rejects.toThrow('not authenticated and active');
    await expect(f.coordinator.signIn('another@example.test', 'pass')).rejects.toThrow('busy or blocked');
    expect(await f.coordinator.refreshAndRestart()).toEqual(f.identity);
    expect(f.coordinator.getPhase()).toBe('active');
    expect(f.resolveIdentity).toHaveBeenCalledTimes(2);
  });

  it('does not start replacement writers until a retained lease release succeeds', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    f.run.stop.mockRejectedValueOnce(Error('release response lost'));
    await expect(f.coordinator.refreshAndRestart()).rejects.toThrow('response lost');
    expect(f.coordinator.getPhase()).toBe('paused');
    expect(mocks.bootstrap).toHaveBeenCalledOnce();
    expect(f.session.signOut).not.toHaveBeenCalled();
    await f.coordinator.refreshAndRestart();
    expect(mocks.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('discards rejected refresh credentials and blocks uncertain remote handoff', async () => {
    const f = fixture();
    await f.coordinator.signIn('owner@example.test', 'pass');
    f.session.refresh.mockRejectedValueOnce(new CandidateSessionDeniedError());
    await expect(f.coordinator.refreshAndRestart()).rejects.toThrow('rejected');
    expect(f.session.signOut).toHaveBeenCalledOnce();
    expect(f.coordinator.getPhase()).toBe('blocked');
    expect(f.coordinator.getAuthenticatedOwner()).toBeNull();
    expect(mocks.bootstrap).toHaveBeenCalledOnce();
  });

  it('rejects invalid provider/profile and missing required server or local safeguards', () => {
    const f = fixture();
    expect(() => createSupabaseCoreAuthCoordinator({
      ...f.options, selectedBackend: 'appwrite-cloud' as never,
    })).toThrow('explicit Supabase');
    expect(() => createSupabaseCoreAuthCoordinator({
      ...f.options, resolveIdentity: undefined as never,
    })).toThrow('trusted legacy');
    expect(() => createSupabaseCoreAuthCoordinator({
      ...f.options, guard: {} as never,
    })).toThrow('all server and local');
  });
});
